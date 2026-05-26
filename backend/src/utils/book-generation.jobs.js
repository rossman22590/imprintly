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
  insertImageUnderTitle,
  isGeneratedUploadUrl,
} = require("./chapter-image-markdown");
const {
  CREDIT_CONFIG,
  assertHasCredits,
  chargeImageUsage,
  chargeTokenUsage,
} = require("./credits.service");

const activeJobs = new Set();

function sanitizeInput(input, maxLength = 500) {
  if (!input || typeof input !== "string") return "";

  return input
    .trim()
    .slice(0, maxLength)
    .replace(/<script[^>]*>.*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "");
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

function createBookContext({ title, genre, audience, chapters }) {
  const chapterList = chapters
    .map(
      (chapter, index) =>
        `${index + 1}. ${chapter.title}: ${chapter.description || ""}`
    )
    .join("\n");

  return [
    `Book title: ${title}`,
    `Genre: ${genre}`,
    `Audience: ${audience}`,
    "Planned book outline:",
    chapterList,
  ].join("\n");
}

function buildChapterImagePrompt({ book, chapter, content, genre, audience }) {
  const excerpt = excerptContent(content);

  return `Create a relevant inline ebook illustration for this chapter.

Book title: ${book.title}
Genre: ${genre}
Audience: ${audience}
Chapter title: ${chapter.title}
Chapter brief: ${chapter.description || "No brief provided."}
Chapter excerpt: ${excerpt || "No chapter excerpt available."}

Requirements:
1. Represent the chapter's actual ideas, not a generic book or writing scene.
2. No title text, captions, logos, UI, or extra words inside the image.
3. Keep the composition readable inside an ebook chapter.
4. Match the tone of the genre and audience.
5. Use a polished editorial illustration or tasteful cinematic image style.`;
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
  return value?.toString?.() || "";
}

function publicJob(job) {
  if (!job) return null;

  return {
    id: job.id,
    userId: normalizeJobId(job.userId),
    bookId: normalizeJobId(job.bookId),
    provider: job.provider,
    status: job.status,
    progress: job.progress,
    failedChapters: job.failedChapters || [],
    error: job.error || "",
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
  };
}

async function saveJob(job) {
  job.markModified("payload");
  job.markModified("progress");
  job.markModified("failedChapters");
  await job.save();
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

  setImmediate(() => runGenerationJob(id));

  return publicJob(job);
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
  job.status = "cancelling";
  job.progress.message = "Cancelling after the current chapter";
  await saveJob(job);

  return publicJob(job);
}

async function retryGenerationJob(jobId, userId) {
  const job = await getGenerationJob(jobId, userId);

  if (!job || !job.bookId) return null;

  return createGenerationJob({
    userId,
    retryFailedOnly: true,
    payload: {
      ...(job.payload || {}),
      bookId: job.bookId.toString(),
      provider: job.provider,
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
  await Promise.all([saveJob(job), book.save()]);
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
    chapters: normalizeOutlineChapters(payload.outline || []),
    generation: {
      provider: job.provider,
      status: "queued",
      jobId: job.id,
      sourcePrompt: sanitizeInput(payload.topic || title, 300),
      style: sanitizeInput(payload.style, 50) || "Informative",
      useGoogleSearch:
        job.provider === "gemini" &&
        isEnabled(payload.useGoogleSearch ?? payload.googleSearch),
      includeTextGraphics: shouldIncludeTextGraphics(payload),
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
    const job = await refreshJob(jobId);

    if (!job || !["queued", "failed"].includes(job.status)) return;

    job.status = "generating";
    job.startedAt = job.startedAt || new Date();
    job.completedAt = null;
    job.error = "";
    job.progress.message = "Preparing book";
    await saveJob(job);

    const payload = job.payload || {};
    const provider = job.provider;
    const safeStyle = sanitizeInput(payload.style, 50) || "Informative";
    const safeGenre = sanitizeInput(payload.genre, 100) || "Nonfiction";
    const safeAudience =
      sanitizeInput(payload.audience, 200) || "General readers";
    const includeChapterImages = isEnabled(
      payload.includeImages ?? payload.generateImages
    );
    const includeTextGraphics = shouldIncludeTextGraphics(payload);
    const includeCover = isEnabled(payload.generateCover ?? payload.includeCover);
    const useGoogleSearch =
      provider === "gemini" &&
      isEnabled(payload.useGoogleSearch ?? payload.googleSearch);
    const { structureModel, sectionModel } =
      provider === "groq" ? getGroqModels() : getGeminiModels();
    let totalStats = emptyStats(provider);
    const book = await resolveBookForJob(job);
    await assertHasCredits(
      job.userId,
      includeChapterImages || includeCover ? CREDIT_CONFIG.imageCredits : 0.0001
    );

    let chapters = normalizeOutlineChapters(
      !job.retryFailedOnly && payload.outline?.length
        ? payload.outline
        : book.chapters || []
    );
    let outlineTree = payload.outline || book.generation?.outlineTree || null;
    let outlineGrounding = book.generation?.grounding || null;

    await updateBookProgress(book, job, {
      startedAt: job.startedAt,
      style: safeStyle,
      sourcePrompt: sanitizeInput(payload.topic || book.title, 300),
      useGoogleSearch,
      includeTextGraphics,
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
        metadata: { jobId: job.id, bookId: book._id.toString() },
      });
      book.title = outlineResult.title || book.title;
      book.subtitle = payload.subtitle || outlineResult.subtitle || book.subtitle;
    }

    const targetIndexes = job.retryFailedOnly
      ? chapters
          .map((chapter, index) =>
            chapter.generationStatus === "failed" ? index : null
          )
          .filter((index) => index !== null)
      : chapters.map((_, index) => index);

    const stepsPerChapter = includeChapterImages ? 2 : 1;
    const shouldGenerateCover =
      includeCover && !job.retryFailedOnly && !book.coverImage;

    job.progress.total =
      targetIndexes.length * stepsPerChapter + (shouldGenerateCover ? 1 : 0);
    job.progress.completed = 0;
    job.progress.failed = 0;
    book.genre = safeGenre;
    book.audience = safeAudience;
    book.chapters = chapters.map((chapter, index) =>
      targetIndexes.includes(index)
        ? { ...chapter, generationStatus: "queued" }
        : chapter
    );
    await updateBookProgress(book, job, { outlineTree });

    const bookContext = createBookContext({
      title: book.title,
      genre: safeGenre,
      audience: safeAudience,
      chapters,
    });

    if (shouldGenerateCover) {
      job.progress.message = "Generating cover";
      await updateBookProgress(book, job);

      try {
        const finalPrompt = buildEbookCoverPrompt({
          book,
          customPrompt: sanitizeInput(payload.coverPrompt, 4000),
        });
        await assertHasCredits(job.userId, CREDIT_CONFIG.imageCredits);
        const image = await generateGeminiImage({
          prompt: finalPrompt,
          model: payload.coverModel,
          aspectRatio: "2:3",
          imageSize: payload.coverImageSize || "1K",
        });
        await chargeImageUsage({
          userId: job.userId,
          reason: "cover_image_generation",
          description: `Generated cover image for "${book.title}"`,
          provider: "gemini",
          model: image.model,
          usage: image.stats,
          metadata: {
            jobId: job.id,
            bookId: book._id.toString(),
            aspectRatio: image.aspectRatio,
            imageSize: image.imageSize,
          },
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
      job.progress.currentChapterIndex = chapterIndex;
      job.progress.currentChapterTitle = chapter.title;
      job.progress.message = `Generating ${chapter.title}`;
      book.chapters[chapterIndex].generationStatus = "generating";
      await updateBookProgress(book, job);

      try {
        const result = await generateSectionForProvider(provider, {
          chapterTitle: chapter.title,
          chapterDescription: chapter.description,
          style: safeStyle,
          bookTitle: book.title,
          genre: safeGenre,
          audience: safeAudience,
          bookContext,
          useGoogleSearch,
          includeTextGraphics,
        });
        let chapterContent = assertGeneratedChapterContent(result, {
          provider,
          chapterTitle: chapter.title,
        });

        totalStats = addStats(totalStats, result.stats);
        await chargeTokenUsage({
          userId: job.userId,
          usage: result.stats,
          reason: "full_book_chapter_generation",
          description: `Generated chapter "${chapter.title}"`,
          provider,
          model: result.modelName,
          metadata: {
            jobId: job.id,
            bookId: book._id.toString(),
            chapterIndex,
            chapterTitle: chapter.title,
          },
        });
        const chapterStats = {
          ...result.stats,
          ...(result.grounding ? { grounding: result.grounding } : {}),
        };
        let chapterStatus = "complete";

        job.progress.completed += 1;

        if (includeChapterImages) {
          job.progress.message = `Generating image for ${chapter.title}`;
          book.chapters[chapterIndex].content = chapterContent;
          book.chapters[chapterIndex].wordCount = countWords(chapterContent);
          await updateBookProgress(book, job);

          try {
            await assertHasCredits(job.userId, CREDIT_CONFIG.imageCredits);
            const image = await generateGeminiImage({
              prompt: buildChapterImagePrompt({
                book,
                chapter,
                content: chapterContent,
                genre: safeGenre,
                audience: safeAudience,
              }),
              aspectRatio: "16:9",
              imageSize: "1K",
            });
            await chargeImageUsage({
              userId: job.userId,
              reason: "chapter_image_generation",
              description: `Generated image for "${chapter.title}"`,
              provider: "gemini",
              model: image.model,
              usage: image.stats,
              metadata: {
                jobId: job.id,
                bookId: book._id.toString(),
                chapterIndex,
                chapterTitle: chapter.title,
                aspectRatio: image.aspectRatio,
                imageSize: image.imageSize,
              },
            });
            const imageAlt = `${
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

            chapterContent = insertImageUnderTitle(
              chapterContent,
              buildImageMarkdown({
                alt: imageAlt,
                url: image.url,
              })
            );
            book.chapters[chapterIndex].images = [
              ...(book.chapters[chapterIndex].images || []).filter(
                (item) => !isGeneratedUploadUrl(item?.url)
              ),
              imageAsset,
            ];
            chapterStats.image = imageAsset;
            totalStats = addStats(totalStats, image.stats);
            job.progress.completed += 1;
          } catch (imageError) {
            chapterStatus = "failed";
            chapterStats.imageError = imageError.message;
            job.progress.failed += 1;
            job.failedChapters.push({
              index: chapterIndex,
              title: chapter.title,
              error: `Image generation failed: ${imageError.message}`,
            });
          }
        }

        book.chapters[chapterIndex].content = chapterContent;
        book.chapters[chapterIndex].generationStatus = chapterStatus;
        book.chapters[chapterIndex].wordCount = countWords(chapterContent);
        book.chapters[chapterIndex].generationStats = chapterStats;
      } catch (error) {
        book.chapters[chapterIndex].generationStatus = "failed";
        book.chapters[chapterIndex].generationStats = { error: error.message };
        job.progress.failed += stepsPerChapter;
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

async function recoverInterruptedGenerationJobs() {
  const message =
    "Server restarted before this generation finished. Start a new generation or retry failed chapters.";
  const activeStatuses = ["queued", "generating", "cancelling"];
  const now = new Date();

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
}

module.exports = {
  cancelGenerationJob,
  createGenerationJob,
  getGenerationJob,
  publicJob,
  recoverInterruptedGenerationJobs,
  retryGenerationJob,
};
