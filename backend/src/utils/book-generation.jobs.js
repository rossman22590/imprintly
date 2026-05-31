const crypto = require("crypto");
const ENV = require("../configs/env");
const Book = require("../models/Book");
const GenerationJob = require("../models/GenerationJob");
const {
  addStats,
  emptyStats,
  generateGroqBookStructure,
  generateGroqSection,
  getGroqModels,
  summarizeStatsForDisplay,
} = require("./groqbook.generator");
const {
  generateGeminiBookStructure,
  generateGeminiSection,
  getGeminiModels,
} = require("./gemini.generator");
const { generateGeminiImage } = require("./gemini-image.generator");
const { buildEbookCoverPrompt } = require("./book-image-prompts");
const {
  buildImageMarkdown,
  insertImagesThroughoutChapter,
  isGeneratedUploadUrl,
} = require("./chapter-image-markdown");
const {
  assertHasCredits,
  chargeImageUsage,
  chargeTokenUsage,
  getImageCreditEstimate,
} = require("./credits.service");
const { normalizeChapterLength } = require("./chapter-length");
const {
  normalizeBookBiblePayload,
  serializeBookBible,
} = require("./book-bible");
const {
  getChapterImageReferences,
  getCoverImageReferences,
} = require("./image-reference");
const {
  buildVisualReferencePromptContext,
  normalizeVisualBiblePayload,
  serializeVisualBible,
} = require("./visual-bible");
const {
  getDefaultChapterImageCount,
  getBookTypeFamily,
  getBookTypeStructureCount,
  getBookTypeImageGuidance,
} = require("./book-type-guidance");
const {
  sanitizeChildrenSpreadManuscript,
} = require("./children-spread-content");
const {
  buildEnhancedBookContext,
  runPremiumChapterPipeline,
} = require("./book-editorial.pipeline");

const activeJobs = new Set();
let generationQueueScheduled = false;
let generationQueueRunning = false;

function sanitizeInput(input, maxLength = 500) {
  if (!input || typeof input !== "string") return "";

  return input
    .trim()
    .slice(0, maxLength)
    .replace(/<script[^>]*>.*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "");
}

function serializeGenerationCanon(bookBible = {}, visualBible = {}) {
  const textCanon = serializeBookBible(bookBible);
  const visualCanon = serializeVisualBible(visualBible);

  return [
    textCanon,
    visualCanon ? `# Visual Bible / Visual Canon\n${visualCanon}` : "",
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 26000);
}

function normalizeProvider(provider) {
  const selectedProvider = sanitizeInput(
    provider || ENV.DEFAULT_AI_PROVIDER || "groq",
    20
  )
    .toLowerCase()
    .trim();

  return ["groq", "gemini"].includes(selectedProvider)
    ? selectedProvider
    : "groq";
}

function countWords(content = "") {
  return content.split(/\s+/).filter(Boolean).length;
}

function assertGeneratedChapterContent(result = {}, { provider, chapterTitle }) {
  const content = String(result.content || "").trim();

  if (content.length >= 100) {
    return content;
  }

  const providerName = provider === "gemini" ? "Gemini" : "Groq";
  const chapterLabel = chapterTitle ? ` for "${chapterTitle}"` : "";
  const reason = content ? "too-short" : "empty";

  throw new Error(
    `${providerName} returned ${reason} chapter content${chapterLabel}.`
  );
}

function isEnabled(value) {
  return value === true || value === "true" || value === "yes" || value === 1;
}

function shouldIncludeTextGraphics(payload = {}) {
  return isEnabled(
    payload.includeTextGraphics ??
      payload.includeGraphics ??
      payload.allowTextGraphics
  );
}

function buildHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getJobSourceMetadata(job) {
  const payload = job?.payload || {};
  const metadata = {};

  if (payload.apiSource) {
    metadata.source = payload.apiSource;
  }

  if (payload.apiKeyId) {
    metadata.apiKeyId = payload.apiKeyId;
  }

  return metadata;
}

function buildUsageMetadata(job, metadata = {}) {
  return {
    ...metadata,
    ...getJobSourceMetadata(job),
  };
}

function shouldUseBibleForInput(payload = {}) {
  return payload.useBibleForInput !== false && payload.useBible !== false;
}

function excerptContent(content = "", maxLength = 1200) {
  return String(content)
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/[#>*_`~|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeOutlineChapters(outline = []) {
  const serializable = Array.isArray(outline)
    ? outline.map((chapter) =>
        typeof chapter?.toObject === "function" ? chapter.toObject() : chapter
      )
    : [];

  return serializable
    .filter((chapter) => chapter && chapter.title)
    .map((chapter, index) => ({
      title: sanitizeInput(chapter.title, 200) || `Chapter ${index + 1}`,
      description: sanitizeInput(chapter.description || "", 1000),
      content: chapter.content || "",
      generationStatus:
        chapter.generationStatus || (chapter.content ? "complete" : "queued"),
      wordCount: countWords(chapter.content || ""),
      outlinePath: Array.isArray(chapter.outlinePath)
        ? chapter.outlinePath
        : [chapter.title || `Chapter ${index + 1}`],
      generationStats: chapter.generationStats || null,
      images: Array.isArray(chapter.images) ? chapter.images : [],
    }));
}

function buildChapterImagePrompt({
  book,
  chapter,
  content,
  genre,
  audience,
  imageIndex = 0,
  totalImages = 1,
  hasVisualReferences = false,
  referenceMode = "visual",
  visualReferenceContext = "",
}) {
  const excerpt = excerptContent(content);
  const unitLabel =
    getBookTypeFamily(genre) === "children" ? "spread" : "chapter";
  const unitLabelTitleCase = unitLabel === "spread" ? "Spread" : "Chapter";
  const illustrationPlacement =
    unitLabel === "spread"
      ? "separate left-page illustration"
      : "inline ebook illustration";
  const continuityInstruction = hasVisualReferences
    ? referenceMode === "generated"
      ? `\nGenerated art continuity: no Visual Bible image references were supplied, so use the provided earlier generated ${unitLabel} image(s) as the book's visual seed. Preserve the same art direction, lighting logic, palette, design language, and genre feel while creating a new scene that fits this ${unitLabel}. Do not copy the previous scene unchanged.`
      : `\nVisual Bible continuity: the provided reference image(s) are mandatory visual canon. Preserve character identity, setting/world cues, art direction, lighting logic, palette, design language, and genre feel while creating a new scene that fits this ${unitLabel}. Do not copy the previous scene unchanged.`
    : "";
  const bookTypeGuidance = getBookTypeImageGuidance(genre);
  const imageNumber = Math.max(0, Number(imageIndex) || 0) + 1;
  const imageTotal = Math.max(1, Number(totalImages) || 1);
  const multiImageDirection =
    imageTotal > 1
      ? `\nIllustration slot: ${imageNumber} of ${imageTotal}. Create a distinct moment for this ${unitLabel}. For children's books, use slot 1 for the opening scene, middle slots for action/emotion, and the final slot for the ending reaction or resolution. Do not repeat the same pose, composition, or beat across slots.`
      : "";

  return `Create a relevant ${illustrationPlacement} for this ${unitLabel}.

Book title: ${book.title}
Genre: ${genre}
Audience: ${audience}
${bookTypeGuidance}
${unitLabelTitleCase} title: ${chapter.title}
${unitLabelTitleCase} brief: ${chapter.description || "No brief provided."}
${unitLabelTitleCase} excerpt: ${excerpt || `No ${unitLabel} excerpt available.`}
${multiImageDirection}
${continuityInstruction}
${visualReferenceContext}

Requirements:
1. Represent the ${unitLabel}'s actual ideas, not a generic book or writing scene.
2. No title text, captions, logos, UI, or extra words inside the image.
3. Keep the composition readable inside an ebook ${unitLabel}.
4. Match the tone of the genre and audience.
5. Use a polished editorial illustration or tasteful cinematic image style.`;
}

function normalizeGeneratedManuscriptForGenre(content = "", genre = "") {
  return getBookTypeFamily(genre) === "children"
    ? sanitizeChildrenSpreadManuscript(content)
    : content;
}

async function generateStructureForProvider(provider, payload) {
  if (provider === "gemini") {
    return generateGeminiBookStructure(payload);
  }

  return generateGroqBookStructure(payload);
}

async function generateSectionForProvider(provider, payload) {
  if (provider === "gemini") {
    return generateGeminiSection(payload);
  }

  return generateGroqSection(payload);
}

function normalizeJobId(value) {
  if (!value) return "";
  if (value._id) return value._id.toString();

  return value?.toString?.() || "";
}

function getJobBookTitle(job) {
  const populatedTitle = String(job?.bookId?.title || "").trim();

  if (populatedTitle) return populatedTitle;

  return (
    sanitizeInput(job?.payload?.title || job?.payload?.topic || "", 200) ||
    "Untitled book"
  );
}

function publicJob(job) {
  if (!job) return null;

  return {
    id: job.id,
    userId: normalizeJobId(job.userId),
    bookId: normalizeJobId(job.bookId),
    bookTitle: getJobBookTitle(job),
    provider: job.provider,
    retryFailedOnly: Boolean(job.retryFailedOnly),
    status: job.status,
    progress: job.progress,
    failedChapters: job.failedChapters || [],
    error: job.error || "",
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
  };
}

function toPlainValue(value) {
  return typeof value?.toObject === "function"
    ? value.toObject({ depopulate: true })
    : value;
}

function normalizeChapterImageCount(value, genre = "") {
  const parsed = Number.parseInt(value, 10);
  const defaultCount = getDefaultChapterImageCount(genre);

  if (!Number.isFinite(parsed)) return defaultCount;

  return Math.min(Math.max(parsed, 1), 4);
}

function getPayloadChapterImageCount(payload = {}, genre = "") {
  return normalizeChapterImageCount(
    payload.imagesPerChapter ??
      payload.chapterImageCount ??
      payload.imageCountPerChapter,
    genre
  );
}

function countChapterImages(chapter = {}) {
  return Array.isArray(chapter.images)
    ? chapter.images.filter((image) => image?.url).length
    : 0;
}

function isGeneratedChapterImageAsset(image = {}) {
  return image?.source === "gemini" || isGeneratedUploadUrl(image?.url);
}

function hasChapterImage(chapter = {}, requiredImageCount = 1) {
  return countChapterImages(chapter) >= Math.max(1, requiredImageCount);
}

function getMissingChapterImageCount(chapter = {}, requiredImageCount = 1) {
  return Math.max(0, Math.max(1, requiredImageCount) - countChapterImages(chapter));
}

function isIncompleteChapterForRetry(
  chapter = {},
  includeChapterImages = false,
  requiredImageCount = 1
) {
  const status = chapter.generationStatus || "";
  const hasContent = Boolean(String(chapter.content || "").trim());
  const stats = chapter.generationStats || {};

  if (status === "failed") return true;
  if (stats.imageStatus === "failed" || stats.imageError) return true;
  if (
    includeChapterImages &&
    hasContent &&
    !hasChapterImage(chapter, requiredImageCount) &&
    ["queued", "generating", "empty"].includes(status)
  ) {
    return true;
  }
  if (["queued", "generating", "empty"].includes(status) && !hasContent) {
    return true;
  }

  return false;
}

function isImageOnlyRetryChapter(
  chapter = {},
  includeChapterImages = false,
  requiredImageCount = 1
) {
  const hasContent = Boolean(String(chapter.content || "").trim());
  const stats = chapter.generationStats || {};

  return (
    includeChapterImages &&
    hasContent &&
    (stats.imageStatus === "failed" ||
      Boolean(stats.imageError) ||
      !hasChapterImage(chapter, requiredImageCount))
  );
}

function getChapterGenerationStepCount(
  chapter = {},
  includeChapterImages = false,
  retryFailedOnly = false,
  requiredImageCount = 1
) {
  if (
    retryFailedOnly &&
    isImageOnlyRetryChapter(chapter, includeChapterImages, requiredImageCount)
  ) {
    return Math.max(1, getMissingChapterImageCount(chapter, requiredImageCount));
  }

  return includeChapterImages ? 1 + Math.max(1, requiredImageCount) : 1;
}

async function saveJob(job) {
  if (!job?._id) return;

  await GenerationJob.updateOne(
    { _id: job._id },
    {
      $set: {
        bookId: job.bookId?._id || job.bookId || null,
        provider: job.provider,
        payload: toPlainValue(job.payload || {}),
        retryFailedOnly: Boolean(job.retryFailedOnly),
        cancelled: Boolean(job.cancelled),
        status: job.status,
        progress: toPlainValue(job.progress || {}),
        failedChapters: Array.isArray(job.failedChapters)
          ? job.failedChapters.map(toPlainValue)
          : [],
        error: job.error || "",
        startedAt: job.startedAt || null,
        completedAt: job.completedAt || null,
      },
    }
  );
}

async function createGenerationJob({ userId, payload, retryFailedOnly = false }) {
  const id = crypto.randomUUID();
  const provider = normalizeProvider(payload.provider);
  const job = await GenerationJob.create({
    id,
    userId,
    bookId: payload.bookId || null,
    provider,
    payload,
    retryFailedOnly,
    cancelled: false,
    status: "queued",
    progress: {
      total: 0,
      completed: 0,
      failed: 0,
      currentChapterIndex: null,
      currentChapterTitle: "",
      message: "Queued",
    },
    failedChapters: [],
    error: "",
  });

  scheduleGenerationQueue();

  return publicJob(job);
}

async function validateFullBookJobRequest({ userId, payload = {} }) {
  const includesImages = isEnabled(payload.includeImages ?? payload.generateImages);
  const includesCover = isEnabled(payload.generateCover ?? payload.includeCover);
  const safeGenre = sanitizeInput(payload.genre, 100) || "Nonfiction";
  const chapterImageCount = getPayloadChapterImageCount(payload, safeGenre);
  const outlineCount = Array.isArray(payload.outline) ? payload.outline.length : 0;
  const chapterCountEstimate = Math.max(
    1,
    outlineCount ||
      getBookTypeStructureCount(
        safeGenre,
        Number.parseInt(payload.chapterCount, 10) || 1
      )
  );
  const imageCountEstimate =
    (includesCover ? 1 : 0) +
    (includesImages ? chapterCountEstimate * chapterImageCount : 0);

  await assertHasCredits(
    userId,
    imageCountEstimate > 0
      ? getImageCreditEstimate({
          provider: "gemini",
          model: payload.coverModel || payload.imageModel,
          imageSize: payload.coverImageSize || payload.imageSize,
        }) * imageCountEstimate
      : 0.0001
  );

  if (!payload.bookId) return;

  const book = await Book.findById(payload.bookId);

  if (!book) {
    throw buildHttpError(404, "Book not found!");
  }

  if (book.userId.toString() !== userId.toString()) {
    throw buildHttpError(403, "Forbidden: You cannot update this book!");
  }
}

async function listGenerationJobs(userId, { limit = 50 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const jobs = await GenerationJob.find({ userId })
    .populate("bookId", "title author")
    .sort({ createdAt: -1 })
    .limit(safeLimit);

  return jobs.map(publicJob);
}

async function getGenerationJob(jobId, userId) {
  return GenerationJob.findOne({
    id: jobId,
    userId,
  });
}

async function cancelGenerationJob(jobId, userId) {
  const job = await getGenerationJob(jobId, userId);

  if (!job) return null;

  if (["complete", "failed", "cancelled"].includes(job.status)) {
    return publicJob(job);
  }

  job.cancelled = true;

  if (job.status === "queued") {
    job.status = "cancelled";
    job.completedAt = new Date();
    job.progress.message = "Cancelled";
    await saveJob(job);

    return publicJob(job);
  }

  job.status = "cancelling";
  job.progress.message = "Cancelling after the current chapter";
  await saveJob(job);

  return publicJob(job);
}

async function retryGenerationJob(jobId, userId, { payloadOverrides = {} } = {}) {
  const job = await getGenerationJob(jobId, userId);

  if (!job || !job.bookId) return null;

  return createGenerationJob({
    userId,
    retryFailedOnly: true,
    payload: {
      ...(job.payload || {}),
      bookId: job.bookId.toString(),
      provider: job.provider,
      ...payloadOverrides,
    },
  });
}

async function updateBookProgress(book, job, extraGeneration = {}) {
  const currentGeneration =
    typeof book.generation?.toObject === "function"
      ? book.generation.toObject()
      : book.generation || {};

  book.generation = {
    ...currentGeneration,
    ...extraGeneration,
    provider: job.provider,
    status: job.status,
    jobId: job.id,
    progress: job.progress,
  };
  await saveJob(job);
  await Book.updateOne(
    { _id: book._id },
    {
      $set: {
        title: book.title,
        subtitle: book.subtitle,
        genre: book.genre,
        audience: book.audience,
        language: book.language,
        chapters: (book.chapters || []).map(toPlainValue),
        coverImage: book.coverImage || "",
        coverGeneration: toPlainValue(book.coverGeneration || {}),
        visualBible: toPlainValue(book.visualBible || {}),
        generation: toPlainValue(book.generation || {}),
      },
    }
  );
}

async function resolveBookForJob(job) {
  const payload = job.payload || {};
  const existingBook = payload.bookId ? await Book.findById(payload.bookId) : null;

  if (existingBook) {
    if (existingBook.userId.toString() !== job.userId.toString()) {
      throw new Error("Forbidden: You cannot update this book.");
    }

    if (!job.bookId) {
      job.bookId = existingBook._id;
      await saveJob(job);
    }

    return existingBook;
  }

  const title = sanitizeInput(payload.title || payload.topic, 200);
  const author = sanitizeInput(payload.author || "Unknown Author", 100);
  const language = sanitizeInput(payload.language, 50) || "English";
  const modelConfig =
    job.provider === "groq"
      ? getGroqModels({
          model: payload.model,
          structureModel: payload.structureModel,
          sectionModel: payload.sectionModel,
        })
      : getGeminiModels();

  if (!title || !author) {
    throw new Error("Title and author are required.");
  }

  const book = await Book.create({
    userId: job.userId,
    title,
    subtitle: sanitizeInput(payload.subtitle || "", 300),
    author,
    genre: sanitizeInput(payload.genre, 100) || "Nonfiction",
    audience: sanitizeInput(payload.audience, 200) || "General readers",
    language,
    chapters: normalizeOutlineChapters(payload.outline || []),
    bible: normalizeBookBiblePayload(payload.bible),
    visualBible: normalizeVisualBiblePayload(payload.visualBible),
    generation: {
      provider: job.provider,
      status: "queued",
      jobId: job.id,
      sourcePrompt: sanitizeInput(payload.topic || title, 300),
      style: sanitizeInput(payload.style, 50) || "Informative",
      structureModel: modelConfig.structureModel,
      sectionModel: modelConfig.sectionModel,
      useGoogleSearch:
        job.provider === "gemini" &&
        isEnabled(payload.useGoogleSearch ?? payload.googleSearch),
      includeTextGraphics: shouldIncludeTextGraphics(payload),
      chapterLength: normalizeChapterLength(payload.chapterLength),
      progress: job.progress,
    },
  });

  job.bookId = book._id;
  await saveJob(job);

  return book;
}

async function refreshJob(jobId) {
  return GenerationJob.findOne({ id: jobId });
}

async function runGenerationJob(jobId) {
  if (activeJobs.has(jobId)) return;

  activeJobs.add(jobId);

  try {
    const job = await GenerationJob.findOneAndUpdate(
      { id: jobId, status: "queued" },
      {
        $set: {
          status: "generating",
          startedAt: new Date(),
          completedAt: null,
          error: "",
          "progress.message": "Preparing book",
        },
      },
      { new: true }
    );

    if (!job) return;

    const payload = job.payload || {};
    const provider = job.provider;
    const safeStyle = sanitizeInput(payload.style, 50) || "Informative";
    let safeGenre = sanitizeInput(payload.genre, 100) || "Nonfiction";
    const safeAudience =
      sanitizeInput(payload.audience, 200) || "General readers";
    const includeChapterImages = isEnabled(
      payload.includeImages ?? payload.generateImages
    );
    const includeTextGraphics = shouldIncludeTextGraphics(payload);
    let chapterLength = normalizeChapterLength(
      payload.chapterLength || payload.generation?.chapterLength
    );
    const includeCover = isEnabled(payload.generateCover ?? payload.includeCover);
    const useGoogleSearch =
      provider === "gemini" &&
      isEnabled(payload.useGoogleSearch ?? payload.googleSearch);
    const modelPayload = {
      model: payload.model,
      structureModel: payload.structureModel,
      sectionModel: payload.sectionModel,
    };
    const { structureModel, sectionModel } =
      provider === "groq" ? getGroqModels(modelPayload) : getGeminiModels();
    let totalStats = emptyStats(provider);
    const book = await resolveBookForJob(job);
    safeGenre = sanitizeInput(payload.genre || book.genre, 100) || "Nonfiction";
    const chapterImageCount = includeChapterImages
      ? getPayloadChapterImageCount(payload, safeGenre)
      : 0;
    const safeLanguage =
      sanitizeInput(payload.language || payload.bookLanguage, 50) ||
      book.language ||
      "English";
    chapterLength = normalizeChapterLength(
      payload.chapterLength ||
        payload.generation?.chapterLength ||
        book.generation?.chapterLength
    );
    let chapters = normalizeOutlineChapters(
      !job.retryFailedOnly && payload.outline?.length
        ? payload.outline
        : book.chapters || []
    );
    const generatedChapterImageUrls = [];
    const imageCountEstimate =
      (includeCover ? 1 : 0) +
      (includeChapterImages ? chapters.length * chapterImageCount : 0);
    await assertHasCredits(
      job.userId,
      imageCountEstimate > 0
        ? getImageCreditEstimate({
            provider: "gemini",
            model: payload.coverModel,
            imageSize: payload.coverImageSize || "1K",
          }) * imageCountEstimate
        : 0.0001
    );

    let outlineTree = payload.outline || book.generation?.outlineTree || null;
    let outlineGrounding = book.generation?.grounding || null;
    const useBibleForInput = shouldUseBibleForInput(payload);
    const useVisualBibleForImages =
      includeChapterImages ||
      includeCover ||
      isEnabled(payload.useBibleForImages);
    const visualBibleForImages = useVisualBibleForImages
      ? normalizeVisualBiblePayload(payload.visualBible || book.visualBible)
      : normalizeVisualBiblePayload({ enabled: false });
    const visualBibleForText = useBibleForInput
      ? visualBibleForImages
      : normalizeVisualBiblePayload({ enabled: false });
    let currentBookBible = normalizeBookBiblePayload(
      useBibleForInput ? payload.bible || book.bible || {} : {}
    );

    if (payload.visualBible && (useBibleForInput || useVisualBibleForImages)) {
      book.visualBible = {
        ...visualBibleForImages,
        updatedAt: new Date(),
      };
    }

    if (useBibleForInput && (payload.bible || !book.bible)) {
      book.bible = currentBookBible;
    }

    await updateBookProgress(book, job, {
      startedAt: job.startedAt,
      style: safeStyle,
      sourcePrompt: sanitizeInput(payload.topic || book.title, 300),
      useGoogleSearch,
      includeTextGraphics,
      includeImages: includeChapterImages,
      chapterImageCount,
      chapterLength,
    });

    if (!job.retryFailedOnly && chapters.length === 0) {
      job.progress.message = "Generating outline";
      await updateBookProgress(book, job);

      const outlineResult = await generateStructureForProvider(provider, {
        title: sanitizeInput(payload.title || book.title, 200),
        topic: sanitizeInput(payload.topic || book.title, 300),
        description: sanitizeInput(payload.description || "", 800),
        style: safeStyle,
        chapterCount: payload.chapterCount,
        genre: safeGenre,
        audience: safeAudience,
        useGoogleSearch,
        includeTextGraphics,
        chapterLength,
        ...modelPayload,
      });

      chapters = normalizeOutlineChapters(outlineResult.chapters);
      outlineTree = outlineResult.outlineTree;
      outlineGrounding = outlineResult.grounding || null;
      totalStats = addStats(totalStats, outlineResult.stats);
      await chargeTokenUsage({
        userId: job.userId,
        usage: outlineResult.stats,
        reason: "full_book_outline_generation",
        description: `Generated full-book outline for "${book.title}"`,
        provider,
        model: outlineResult.modelName,
        metadata: buildUsageMetadata(job, {
          jobId: job.id,
          bookId: book._id.toString(),
        }),
      });
      book.title = outlineResult.title || book.title;
      book.subtitle = payload.subtitle || outlineResult.subtitle || book.subtitle;
    }

    const targetIndexes = job.retryFailedOnly
      ? chapters
          .map((chapter, index) =>
            isIncompleteChapterForRetry(
              chapter,
              includeChapterImages,
              chapterImageCount
            )
              ? index
              : null
          )
          .filter((index) => index !== null)
      : chapters.map((_, index) => index);

    const shouldGenerateCover =
      includeCover && !job.retryFailedOnly && !book.coverImage;

    job.progress.total =
      targetIndexes.reduce(
        (total, index) =>
          total +
          getChapterGenerationStepCount(
            chapters[index],
            includeChapterImages,
            job.retryFailedOnly,
            chapterImageCount
          ),
        shouldGenerateCover ? 1 : 0
      );
    job.progress.completed = 0;
    job.progress.failed = 0;
    book.genre = safeGenre;
    book.audience = safeAudience;
    book.language = safeLanguage;
    book.chapters = chapters.map((chapter, index) =>
      targetIndexes.includes(index)
        ? { ...chapter, generationStatus: "queued" }
        : chapter
    );
    await updateBookProgress(book, job, { outlineTree });

    if (shouldGenerateCover) {
      job.progress.message = "Generating cover";
      await updateBookProgress(book, job);

      try {
        const finalPrompt = buildEbookCoverPrompt({
          book,
          customPrompt: sanitizeInput(payload.coverPrompt, 4000),
        });
        await assertHasCredits(
          job.userId,
          getImageCreditEstimate({
            provider: "gemini",
            model: payload.coverModel,
            imageSize: payload.coverImageSize || "1K",
          })
        );
        const coverReferenceImages = await getCoverImageReferences(book);
        const image = await generateGeminiImage({
          prompt: finalPrompt,
          model: payload.coverModel,
          aspectRatio: "2:3",
          imageSize: payload.coverImageSize || "1K",
          referenceImages: coverReferenceImages,
        });
        await chargeImageUsage({
          userId: job.userId,
          reason: "cover_image_generation",
          description: `Generated cover image for "${book.title}"`,
          provider: "gemini",
          model: image.model,
          usage: image.stats,
          metadata: buildUsageMetadata(job, {
            jobId: job.id,
            bookId: book._id.toString(),
            aspectRatio: image.aspectRatio,
            imageSize: image.imageSize,
            visualReferenceCount: coverReferenceImages.length,
          }),
        });

        book.coverImage = image.url;
        book.coverGeneration = {
          prompt: finalPrompt,
          model: image.model,
          aspectRatio: image.aspectRatio,
          imageSize: image.imageSize,
          source: "gemini",
          mode: "generated",
          customPrompt: sanitizeInput(payload.coverPrompt, 4000),
          createdAt: new Date(),
        };
        totalStats = addStats(totalStats, image.stats);
        job.progress.completed += 1;
      } catch (coverError) {
        job.progress.failed += 1;
        job.failedChapters.push({
          index: -1,
          title: "Cover",
          error: `Cover generation failed: ${coverError.message}`,
        });
      }

      await updateBookProgress(book, job);
    }

    for (const chapterIndex of targetIndexes) {
      const latestJob = await refreshJob(jobId);

      if (latestJob) {
        job.cancelled = latestJob.cancelled;
        job.status = latestJob.status;
      }

      if (job.cancelled || job.status === "cancelling") {
        job.status = "cancelled";
        job.progress.message = "Cancelled";
        break;
      }

      const chapter = book.chapters[chapterIndex];
      const retryImageOnly = isImageOnlyRetryChapter(
        chapter,
        includeChapterImages,
        chapterImageCount
      );
      job.progress.currentChapterIndex = chapterIndex;
      job.progress.currentChapterTitle = chapter.title;
      job.progress.message = retryImageOnly
        ? `Retrying image for ${chapter.title}`
        : `Generating ${chapter.title}`;
      book.chapters[chapterIndex].generationStatus = retryImageOnly
        ? "complete"
        : "generating";
      await updateBookProgress(book, job);

      try {
        let chapterContent = String(chapter.content || "");
        const chapterStats = {
          ...(chapter.generationStats?.toObject?.() ||
            chapter.generationStats ||
            {}),
        };
        let chapterStatus = "complete";

        if (!retryImageOnly) {
          const completedChapters = book.chapters.slice(0, chapterIndex);
          const bookContext = buildEnhancedBookContext({
            title: book.title,
            genre: safeGenre,
            audience: safeAudience,
            chapters,
            completedChapters,
          });
          const bookBible = serializeGenerationCanon(
            currentBookBible,
            visualBibleForText
          );
          const result = await generateSectionForProvider(provider, {
            chapterTitle: chapter.title,
            chapterDescription: chapter.description,
            style: safeStyle,
            bookTitle: book.title,
            genre: safeGenre,
            audience: safeAudience,
            bookContext,
            bookBible,
            useGoogleSearch,
            includeTextGraphics,
            chapterLength,
            ...modelPayload,
          });
          chapterContent = assertGeneratedChapterContent(result, {
            provider,
            chapterTitle: chapter.title,
          });
          chapterContent = normalizeGeneratedManuscriptForGenre(
            chapterContent,
            safeGenre
          );

          totalStats = addStats(totalStats, result.stats);
          await chargeTokenUsage({
            userId: job.userId,
            usage: result.stats,
            reason: "full_book_chapter_generation",
            description: `Generated chapter "${chapter.title}"`,
            provider,
            model: result.modelName,
            metadata: buildUsageMetadata(job, {
              jobId: job.id,
              bookId: book._id.toString(),
              chapterIndex,
              chapterTitle: chapter.title,
            }),
          });
          Object.assign(chapterStats, {
            ...result.stats,
            ...(result.grounding ? { grounding: result.grounding } : {}),
          });

          job.progress.message = `Editing ${chapter.title}`;
          await updateBookProgress(book, job);

          const premiumResult = await runPremiumChapterPipeline({
            provider,
            modelPayload,
            bookTitle: book.title,
            genre: safeGenre,
            audience: safeAudience,
            chapterTitle: chapter.title,
            chapterDescription: chapter.description,
            bookContext,
            bookBible: currentBookBible,
            draftContent: chapterContent,
            includeTextGraphics,
          });

          for (const step of premiumResult.steps) {
            totalStats = addStats(totalStats, step.result.stats);
            await chargeTokenUsage({
              userId: job.userId,
              usage: step.result.stats,
              reason: `full_book_${step.action}`,
              description: `Ran ${step.action.replace(/_/g, " ")} for "${
                chapter.title
              }"`,
              provider,
              model: step.result.modelName,
              metadata: {
                jobId: job.id,
                bookId: book._id.toString(),
                chapterIndex,
                chapterTitle: chapter.title,
                action: step.action,
              },
            });
          }

          chapterContent = assertGeneratedChapterContent(
            { content: premiumResult.content },
            { provider, chapterTitle: chapter.title }
          );
          chapterContent = normalizeGeneratedManuscriptForGenre(
            chapterContent,
            safeGenre
          );
          currentBookBible = premiumResult.bookBible || currentBookBible;
          if (useBibleForInput) {
            book.bible = currentBookBible;
          }
          chapterStats.editorial = {
            critique: premiumResult.critique,
            rewriteApplied: premiumResult.content !== result.content,
            bibleUpdated: premiumResult.steps.some(
              (step) => step.action === "book_bible_update"
            ),
            errors: premiumResult.errors,
          };
          chapterStats.editorialMemory = premiumResult.editorialMemory;
          job.progress.completed += 1;
        }

        chapterContent = normalizeGeneratedManuscriptForGenre(
          chapterContent,
          safeGenre
        );

        if (includeChapterImages) {
          const existingImages = book.chapters[chapterIndex].images || [];
          const retainedImages = existingImages.filter(
            (item) => !isGeneratedChapterImageAsset(item)
          );
          const existingGeneratedImages = retryImageOnly
            ? existingImages.filter(isGeneratedChapterImageAsset)
            : [];
          const imagesToGenerate = retryImageOnly
            ? Math.max(
                1,
                chapterImageCount - countChapterImages({
                  images: existingGeneratedImages,
                })
              )
            : chapterImageCount;
          const generatedImageAssets = [];
          const imageMarkdowns = [];
          const imageErrors = [];

          job.progress.message =
            imagesToGenerate > 1
              ? `Generating ${imagesToGenerate} images for ${chapter.title}`
              : `Generating image for ${chapter.title}`;
          book.chapters[chapterIndex].content = chapterContent;
          book.chapters[chapterIndex].wordCount = countWords(chapterContent);
          await updateBookProgress(book, job);

          for (let imageOffset = 0; imageOffset < imagesToGenerate; imageOffset += 1) {
            try {
              await assertHasCredits(
                job.userId,
                getImageCreditEstimate({
                  provider: "gemini",
                  imageSize: "1K",
                })
              );
              const visualReferenceContext = buildVisualReferencePromptContext(
                visualBibleForImages,
                {
                  ...chapter,
                  content: chapterContent,
                }
              );
              const referenceImages = await getChapterImageReferences(
                book,
                chapterIndex,
                {
                  generatedImageUrls: generatedChapterImageUrls,
                  visualBibleFirstFallback: true,
                }
              );
              const referenceMode = visualReferenceContext
                ? "visual"
                : generatedChapterImageUrls.length
                  ? "generated"
                  : "none";
              const imageIndex = retryImageOnly
                ? Math.min(
                    chapterImageCount - 1,
                    existingGeneratedImages.length + generatedImageAssets.length
                  )
                : generatedImageAssets.length;
              const image = await generateGeminiImage({
                prompt: buildChapterImagePrompt({
                  book,
                  chapter,
                  content: chapterContent,
                  genre: safeGenre,
                  audience: safeAudience,
                  imageIndex,
                  totalImages: chapterImageCount,
                  hasVisualReferences: referenceImages.length > 0,
                  referenceMode,
                  visualReferenceContext,
                }),
                aspectRatio: "16:9",
                imageSize: "1K",
                referenceImages,
              });
              await chargeImageUsage({
                userId: job.userId,
                reason: "chapter_image_generation",
                description: `Generated image ${imageIndex + 1} for "${
                  chapter.title
                }"`,
                provider: "gemini",
                model: image.model,
                usage: image.stats,
                metadata: buildUsageMetadata(job, {
                  jobId: job.id,
                  bookId: book._id.toString(),
                  chapterIndex,
                  chapterTitle: chapter.title,
                  imageIndex,
                  imageTotal: chapterImageCount,
                  aspectRatio: image.aspectRatio,
                  imageSize: image.imageSize,
                  visualReferenceCount: referenceImages.length,
                }),
              });
              const imageAlt =
                chapterImageCount > 1
                  ? `${
                      chapter.title || `Chapter ${chapterIndex + 1}`
                    } illustration ${imageIndex + 1}`
                  : `${
                      chapter.title || `Chapter ${chapterIndex + 1}`
                    } illustration`;
              const imageAsset = {
                url: image.url,
                prompt: image.prompt,
                alt: imageAlt,
                model: image.model,
                mimeType: image.mimeType,
                aspectRatio: image.aspectRatio,
                imageSize: image.imageSize,
                source: "gemini",
              };

              generatedImageAssets.push(imageAsset);
              generatedChapterImageUrls.push(image.url);
              totalStats = addStats(totalStats, image.stats);
              job.progress.completed += 1;
            } catch (imageError) {
              imageErrors.push(imageError.message);
              job.progress.failed += 1;
              job.failedChapters.push({
                index: chapterIndex,
                title: chapter.title,
                error: `Image generation failed: ${imageError.message}`,
              });
            }
          }

          const finalGeneratedImages = [
            ...existingGeneratedImages,
            ...generatedImageAssets,
          ];
          finalGeneratedImages.forEach((imageAsset) => {
            imageMarkdowns.push(
              buildImageMarkdown({
                alt: imageAsset.alt,
                url: imageAsset.url,
              })
            );
          });

          if (imageMarkdowns.length > 0) {
            chapterContent = insertImagesThroughoutChapter(
              chapterContent,
              imageMarkdowns
            );
            book.chapters[chapterIndex].images = [
              ...retainedImages,
              ...finalGeneratedImages,
            ];
            chapterStats.image = finalGeneratedImages[0];
            chapterStats.images = finalGeneratedImages;
          }

          if (imageErrors.length > 0) {
            chapterStats.imageError = imageErrors.join("; ");
            chapterStats.imageStatus = generatedImageAssets.length
              ? "partial"
              : "failed";
          } else if (generatedImageAssets.length > 0) {
            delete chapterStats.imageError;
            delete chapterStats.imageStatus;
          }
        }

        book.chapters[chapterIndex].content = chapterContent;
        book.chapters[chapterIndex].generationStatus = chapterStatus;
        book.chapters[chapterIndex].wordCount = countWords(chapterContent);
        book.chapters[chapterIndex].generationStats = chapterStats;
      } catch (error) {
        book.chapters[chapterIndex].generationStatus = "failed";
        book.chapters[chapterIndex].generationStats = { error: error.message };
        job.progress.failed += getChapterGenerationStepCount(
          chapter,
          includeChapterImages,
          job.retryFailedOnly,
          chapterImageCount
        );
        job.failedChapters.push({
          index: chapterIndex,
          title: chapter.title,
          error: error.message,
        });
      }

      await updateBookProgress(book, job);
    }

    if (job.status !== "cancelled") {
      job.status = job.progress.failed ? "failed" : "complete";
      job.progress.message = job.progress.failed
        ? "Completed with failed generation steps"
        : "Book generation complete";
    }

    job.completedAt = new Date();
    await updateBookProgress(book, job, {
      structureModel,
      sectionModel,
      outlineTree,
      useGoogleSearch,
      includeTextGraphics,
      includeImages: includeChapterImages,
      chapterImageCount,
      chapterLength,
      grounding: outlineGrounding,
      stats: totalStats,
      statsText: summarizeStatsForDisplay(totalStats),
      completedAt: job.completedAt,
    });
  } catch (error) {
    const failedJob = await refreshJob(jobId);

    if (failedJob) {
      failedJob.status = "failed";
      failedJob.error = error.message;
      failedJob.completedAt = new Date();
      failedJob.progress.message = error.message;
      await saveJob(failedJob);

      if (failedJob.bookId) {
        const book = await Book.findById(failedJob.bookId);

        if (book) {
          const currentGeneration =
            typeof book.generation?.toObject === "function"
              ? book.generation.toObject()
              : book.generation || {};

          book.generation = {
            ...currentGeneration,
            provider: failedJob.provider,
            status: "failed",
            jobId: failedJob.id,
            progress: failedJob.progress,
            completedAt: failedJob.completedAt,
          };
          await book.save();
        }
      }
    }
  } finally {
    activeJobs.delete(jobId);
  }
}

function scheduleGenerationQueue() {
  if (generationQueueScheduled) return;

  generationQueueScheduled = true;

  setImmediate(async () => {
    generationQueueScheduled = false;

    if (generationQueueRunning) return;

    generationQueueRunning = true;

    try {
      while (true) {
        const nextJob = await GenerationJob.findOne({ status: "queued" })
          .sort({ createdAt: 1 })
          .select("id")
          .lean();

        if (!nextJob) break;

        await runGenerationJob(nextJob.id);
      }
    } catch (error) {
      console.error("Error running generation queue:", error);
    } finally {
      generationQueueRunning = false;

      try {
        const hasQueuedJob = await GenerationJob.exists({ status: "queued" });

        if (hasQueuedJob) {
          scheduleGenerationQueue();
        }
      } catch (error) {
        console.error("Error checking generation queue:", error);
      }
    }
  });
}

async function recoverInterruptedGenerationJobs() {
  const message =
    "Server restarted before this generation finished. Start a new generation or retry failed chapters.";
  const activeStatuses = ["generating", "cancelling"];
  const now = new Date();
  const interruptedJobs = await GenerationJob.find({
    status: { $in: activeStatuses },
  }).select("bookId").lean();

  await GenerationJob.updateMany(
    { status: { $in: activeStatuses } },
    {
      $set: {
        status: "failed",
        error: message,
        completedAt: now,
        "progress.message": message,
      },
    }
  );

  const interruptedBookIds = [
    ...new Set(
      interruptedJobs
        .map((job) => job.bookId?.toString())
        .filter(Boolean)
    ),
  ];

  for (const bookId of interruptedBookIds) {
    const book = await Book.findById(bookId);

    if (!book) continue;

    let changed = false;

    book.chapters = (book.chapters || []).map((chapter) => {
      const status = chapter.generationStatus || "";
      const hasContent = Boolean(String(chapter.content || "").trim());
      const base = chapter.toObject?.() || chapter;
      const existingStats = chapter.generationStats?.toObject?.() || chapter.generationStats || {};

      if (["queued", "generating", "empty"].includes(status) && !hasContent) {
        changed = true;
        return {
          ...base,
          generationStatus: "failed",
          generationStats: {
            ...existingStats,
            error: message,
          },
        };
      }

      if (status === "generating" && hasContent) {
        changed = true;
        return {
          ...base,
          generationStatus: "complete",
          generationStats: {
            ...existingStats,
            imageStatus: "failed",
            imageError: message,
          },
        };
      }

      return chapter;
    });

    if (changed) {
      await Book.updateOne(
        { _id: book._id },
        {
          $set: {
            chapters: book.chapters,
            updatedAt: new Date(),
          },
        }
      );
    }
  }

  await Book.updateMany(
    { "generation.status": { $in: activeStatuses } },
    {
      $set: {
        "generation.status": "failed",
        "generation.progress.message": message,
        "generation.completedAt": now,
      },
    }
  );

  await autoResumeInterruptedBooks(interruptedBookIds);
  scheduleGenerationQueue();
}

async function autoResumeInterruptedBooks(bookIds = []) {
  for (const bookId of bookIds) {
    try {
      const book = await Book.findById(bookId);

      if (!book) continue;

      const includeChapterImages =
        Boolean(book.generation?.includeImages) ||
        (Array.isArray(book.chapters) &&
          book.chapters.some(
            (chapter) =>
              Array.isArray(chapter.images) && chapter.images.length > 0
          ));
      const chapterImageCount = includeChapterImages
        ? getPayloadChapterImageCount(book.generation || {}, book.genre)
        : 0;
      const hasResumable = (book.chapters || []).some((chapter) =>
        isIncompleteChapterForRetry(
          chapter,
          includeChapterImages,
          chapterImageCount
        )
      );

      if (!hasResumable) continue;

      const lastJob = await GenerationJob.findOne({ bookId: book._id })
        .sort({ createdAt: -1 })
        .lean();

      if (!lastJob) continue;

      await createGenerationJob({
        userId: book.userId,
        retryFailedOnly: true,
        payload: {
          ...(lastJob.payload || {}),
          bookId: book._id.toString(),
          provider: lastJob.provider,
        },
      });
    } catch (error) {
      console.error(
        `Auto-resume failed for book ${bookId}: ${error.message}`
      );
    }
  }
}

module.exports = {
  cancelGenerationJob,
  createGenerationJob,
  getGenerationJob,
  listGenerationJobs,
  publicJob,
  recoverInterruptedGenerationJobs,
  retryGenerationJob,
  validateFullBookJobRequest,
};
