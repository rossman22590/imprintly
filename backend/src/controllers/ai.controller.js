const fs = require("fs");
const ENV = require("../configs/env");
const Book = require("../models/Book");
const {
  addStats,
  createGroqChatCompletion,
  emptyStats,
  generateGroqBookStructure,
  generateGroqSection,
  getGroqModels,
  normalizeUsageStats,
  summarizeStatsForDisplay,
} = require("../utils/groqbook.generator");
const {
  generateGeminiBookStructure,
  generateGeminiSection,
  getGeminiModels,
  runGeminiEditorialTask,
} = require("../utils/gemini.generator");
const {
  generateGeminiImage,
  normalizeAspectRatio,
  normalizeImageModel,
  normalizeImageSize,
} = require("../utils/gemini-image.generator");
const {
  buildImageMarkdown,
  insertImageUnderTitle,
} = require("../utils/chapter-image-markdown");
const { migrateBookImagesToStorage } = require("../utils/image-asset-migration");
const {
  cancelGenerationJob,
  createGenerationJob,
  getGenerationJob,
  publicJob,
  retryGenerationJob,
} = require("../utils/book-generation.jobs");
const {
  CREDIT_CONFIG,
  assertHasCredits,
  chargeImageUsage,
  chargeTokenUsage,
  serializeBilling,
} = require("../utils/credits.service");
const { deleteUploadFile } = require("../utils/upload-paths");
const {
  getImageMimeType,
  prepareExportImages,
  resolveExportImagePath,
} = require("../utils/export-markdown");

/**
 * Basic input sanitization.
 * Removes excessive special characters and limits length.
 */
function sanitizeInput(input, maxLength = 500) {
  if (!input) return "";

  let sanitized = input.trim().slice(0, maxLength);

  // remove any potential script tags or HTML
  sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gi, "");
  sanitized = sanitized.replace(/<[^>]+>/g, "");

  return sanitized;
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

async function chargeGeneratedTokens({
  req,
  stats,
  reason,
  description,
  provider,
  model,
  metadata,
}) {
  return chargeTokenUsage({
    userId: req.user.id,
    usage: stats,
    reason,
    description,
    provider,
    model: model || stats?.modelName || "",
    metadata,
  });
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

  const error = new Error(
    `${providerName} returned ${reason} chapter content${chapterLabel}.`
  );
  error.statusCode = 502;
  throw error;
}

function isEnabled(value) {
  return value === true || value === "true" || value === "yes" || value === 1;
}

function shouldUseGoogleSearch(provider, payload = {}) {
  return (
    provider === "gemini" &&
    isEnabled(payload.useGoogleSearch ?? payload.googleSearch)
  );
}

function normalizeOutlineChapters(outline = []) {
  return outline
    .filter((chapter) => chapter && chapter.title)
    .map((chapter, index) => ({
      title: sanitizeInput(chapter.title, 200) || `Chapter ${index + 1}`,
      description: sanitizeInput(chapter.description || "", 1000),
      content: chapter.content || "",
      generationStatus: chapter.content ? "complete" : "queued",
      wordCount: countWords(chapter.content || ""),
      outlinePath: Array.isArray(chapter.outlinePath)
        ? chapter.outlinePath
        : [chapter.title || `Chapter ${index + 1}`],
      generationStats: chapter.generationStats || null,
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

async function findOwnedBook(bookId, userId) {
  if (!bookId) {
    const error = new Error("Book ID is required.");
    error.statusCode = 400;
    throw error;
  }

  const book = await Book.findById(bookId);

  if (!book) {
    const error = new Error("Book not found.");
    error.statusCode = 404;
    throw error;
  }

  if (book.userId.toString() !== userId.toString()) {
    const error = new Error("Forbidden: You cannot update this book.");
    error.statusCode = 403;
    throw error;
  }

  return book;
}

function buildCoverPrompt({ book, customPrompt }) {
  const coverDirection = customPrompt
    ? `Creative direction from the author: ${customPrompt}`
    : "Creative direction: premium contemporary publishing cover, memorable first-glance composition, polished commercial finish.";

  return `Create a professional ebook front cover image.

Book title: ${book.title}
Subtitle: ${book.subtitle || "None"}
Author: ${book.author}
Genre: ${book.genre || "Nonfiction"}
Audience: ${book.audience || "General readers"}
${coverDirection}

Requirements:
1. Front cover only, not a 3D mockup, not a spread, and no spine.
2. Include the exact title text: "${book.title}".
3. Include the exact author name: "${book.author}".
4. Use readable, intentional typography with strong hierarchy and safe margins.
5. Match the genre and audience while avoiding generic stock-photo styling.`;
}

function buildCoverEditPrompt({ book, customPrompt }) {
  const editDirection = customPrompt
    ? `Requested edits from the author: ${customPrompt}`
    : "Requested edits: improve the current cover's composition, typography, contrast, and publishing polish while preserving its core concept.";

  return `Edit the provided ebook front cover image.

Book title: ${book.title}
Subtitle: ${book.subtitle || "None"}
Author: ${book.author}
Genre: ${book.genre || "Nonfiction"}
Audience: ${book.audience || "General readers"}
${editDirection}

Requirements:
1. Preserve the exact book title text: "${book.title}".
2. Preserve the exact author name: "${book.author}".
3. Keep it as a front cover only, not a 3D mockup, not a spread, and no spine.
4. Improve the current cover rather than creating an unrelated concept.
5. Keep typography readable with strong hierarchy and safe margins.`;
}

async function getCoverReferenceImage(book) {
  await prepareExportImages(book);

  const coverPath = resolveExportImagePath(book.coverImage);

  if (!coverPath) {
    const error = new Error("Current cover image is unavailable for editing.");
    error.statusCode = 400;
    throw error;
  }

  return {
    data: fs.readFileSync(coverPath).toString("base64"),
    mimeType: getImageMimeType(coverPath),
  };
}

function buildChapterImagePrompt({ book, chapter, customPrompt }) {
  const direction = customPrompt
    ? `Scene direction from the author: ${customPrompt}`
    : `Create a visual scene that captures this chapter brief: ${
        chapter.description || chapter.title
      }`;

  return `Create a polished illustration for a chapter inside an ebook.

Book title: ${book.title}
Genre: ${book.genre || "Nonfiction"}
Audience: ${book.audience || "General readers"}
Chapter title: ${chapter.title}
Chapter brief: ${chapter.description || "No brief provided."}
${direction}

Requirements:
1. No title text, captions, logos, watermarks, or UI.
2. Make it suitable as an inline ebook illustration.
3. Keep the composition clear at small reading sizes.
4. Match the book's genre and target reader.`;
}

function getModelsForProvider(provider) {
  return provider === "groq" ? getGroqModels() : getGeminiModels();
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

async function generateBookOutline(req, res) {
  try {
    const {
      topic,
      style,
      chapterCount,
      description,
      provider,
      genre,
      audience,
    } = req.body;

    if (!topic) {
      return res.status(400).json({ error: "Topic is missing!" });
    }

    const selectedProvider = normalizeProvider(provider);
    const useGoogleSearch = shouldUseGoogleSearch(selectedProvider, req.body);
    const safeTopic = sanitizeInput(topic, 200);
    const safeDescription = sanitizeInput(description, 500);
    const safeStyle = sanitizeInput(style, 50);
    const safeChapterCount = Math.min(
      Math.max(parseInt(chapterCount) || 5, 1),
      20
    );

    await assertHasCredits(req.user.id, 0.0001);

    if (selectedProvider === "groq") {
      const outlineResult = await generateGroqBookStructure({
        title: safeTopic,
        topic: safeTopic,
        description: safeDescription,
        style: safeStyle,
        chapterCount: safeChapterCount,
        genre: sanitizeInput(genre, 100) || "Nonfiction",
        audience: sanitizeInput(audience, 200) || "General readers",
        useGoogleSearch,
      });
      const billing = await chargeGeneratedTokens({
        req,
        stats: outlineResult.stats,
        reason: "outline_generation",
        description: `Generated outline for "${safeTopic}"`,
        provider: "groq",
        model: outlineResult.modelName,
        metadata: { topic: safeTopic, chapterCount: safeChapterCount },
      });

      return res.status(200).json({
        message: "Groq book outline generated successfully!",
        outline: outlineResult.chapters,
        title: outlineResult.title || safeTopic,
        subtitle: outlineResult.subtitle || "",
        generation: {
          provider: "groq",
          status: "outline",
          structureModel: outlineResult.modelName,
          outlineTree: outlineResult.outlineTree,
          useGoogleSearch,
          grounding: outlineResult.grounding || null,
          stats: outlineResult.stats,
          statsText: summarizeStatsForDisplay(outlineResult.stats),
        },
        billing: serializeBilling(billing),
      });
    }

    const outlineResult = await generateGeminiBookStructure({
      title: safeTopic,
      topic: safeTopic,
      description: safeDescription,
      style: safeStyle,
      chapterCount: safeChapterCount,
      genre: sanitizeInput(genre, 100) || "Nonfiction",
      audience: sanitizeInput(audience, 200) || "General readers",
      useGoogleSearch,
    });
    const billing = await chargeGeneratedTokens({
      req,
      stats: outlineResult.stats,
      reason: "outline_generation",
      description: `Generated outline for "${safeTopic}"`,
      provider: "gemini",
      model: outlineResult.modelName,
      metadata: { topic: safeTopic, chapterCount: safeChapterCount },
    });

    return res.status(200).json({
      message: "Gemini book outline generated successfully!",
      outline: outlineResult.chapters,
      title: outlineResult.title || safeTopic,
      subtitle: outlineResult.subtitle || "",
      generation: {
        provider: "gemini",
        status: "outline",
        structureModel: outlineResult.modelName,
        outlineTree: outlineResult.outlineTree,
        useGoogleSearch,
        grounding: outlineResult.grounding || null,
        stats: outlineResult.stats,
        statsText: summarizeStatsForDisplay(outlineResult.stats),
      },
      billing: serializeBilling(billing),
    });
  } catch (error) {
    console.error("Error generating book outline:", error);

    return res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Internal Server Error!" });
  }
}

async function generateChapterContent(req, res) {
  try {
    const {
      chapterTitle,
      chapterDescription,
      style,
      provider,
      bookTitle,
      genre,
      audience,
      bookContext,
    } = req.body;

    if (!chapterTitle) {
      return res.status(400).json({ error: "Chapter title is missing!" });
    }

    const selectedProvider = normalizeProvider(provider);
    const useGoogleSearch = shouldUseGoogleSearch(selectedProvider, req.body);
    const safeChapterTitle = sanitizeInput(chapterTitle, 300);
    const safeChapterDescription = sanitizeInput(chapterDescription, 600);
    const safeStyle = sanitizeInput(style, 50);

    await assertHasCredits(req.user.id, 0.0001);

    const result = await generateSectionForProvider(selectedProvider, {
      chapterTitle: safeChapterTitle,
      chapterDescription: safeChapterDescription,
      style: safeStyle,
      bookTitle: sanitizeInput(bookTitle, 200),
      genre: sanitizeInput(genre, 100) || "Nonfiction",
      audience: sanitizeInput(audience, 200) || "General readers",
      bookContext: sanitizeInput(bookContext, 3000),
      useGoogleSearch,
    });
    const content = assertGeneratedChapterContent(result, {
      provider: selectedProvider,
      chapterTitle: safeChapterTitle,
    });

    const billing = await chargeGeneratedTokens({
      req,
      stats: result.stats,
      reason: "chapter_generation",
      description: `Generated chapter "${safeChapterTitle}"`,
      provider: selectedProvider,
      model: result.modelName,
      metadata: { chapterTitle: safeChapterTitle },
    });

    return res.status(200).json({
      message: `${
        selectedProvider === "gemini" ? "Gemini" : "Groq"
      } chapter content generated successfully!`,
      content,
      provider: selectedProvider,
      model: result.modelName,
      stats: result.stats,
      grounding: result.grounding || null,
      billing: serializeBilling(billing),
    });
  } catch (error) {
    console.error("Error generating chapter content:", error);

    return res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Internal Server Error!" });
  }
}

async function generateFullBook(req, res) {
  const startedAt = new Date();

  try {
    const {
      bookId,
      title,
      subtitle,
      author,
      topic,
      description,
      style,
      chapterCount,
      genre,
      audience,
      outline,
      provider,
    } = req.body;

    const selectedProvider = normalizeProvider(provider);
    const useGoogleSearch = shouldUseGoogleSearch(selectedProvider, req.body);

    let book = null;

    if (bookId) {
      book = await Book.findById(bookId);

      if (!book) {
        return res.status(404).json({ error: "Book not found!" });
      }

      if (book.userId.toString() !== req.user.id.toString()) {
        return res
          .status(403)
          .json({ error: "Forbidden: You cannot update this book!" });
      }
    }

    let workingTitle = sanitizeInput(title || book?.title || topic, 200);
    const workingSubtitle = sanitizeInput(subtitle || book?.subtitle || "", 300);
    const workingAuthor = sanitizeInput(
      author || book?.author || "Unknown Author",
      100
    );
    const safeStyle =
      sanitizeInput(style || book?.generation?.style, 50) || "Informative";
    const safeGenre = sanitizeInput(genre || book?.genre, 100) || "Nonfiction";
    const safeAudience =
      sanitizeInput(audience || book?.audience, 200) || "General readers";
    const safeTopic = sanitizeInput(topic || workingTitle, 300);
    const safeDescription = sanitizeInput(description || "", 800);
    const { structureModel, sectionModel } =
      getModelsForProvider(selectedProvider);

    if (!workingTitle || !workingAuthor) {
      return res
        .status(400)
        .json({ error: "Title and author are required!" });
    }

    await assertHasCredits(req.user.id, 0.0001);

    let outlineTree = Array.isArray(outline) ? outline : null;
    let chapters = Array.isArray(outline) && outline.length > 0
      ? normalizeOutlineChapters(outline)
      : normalizeOutlineChapters(book?.chapters || []);
    let totalStats = emptyStats(selectedProvider);
    let outlineGrounding = null;
    const billingCharges = [];

    if (chapters.length === 0) {
      const outlineResult = await generateStructureForProvider(
        selectedProvider,
        {
          title: workingTitle,
          topic: safeTopic,
          description: safeDescription,
          style: safeStyle,
          chapterCount,
          genre: safeGenre,
          audience: safeAudience,
          useGoogleSearch,
        }
      );

      workingTitle = outlineResult.title || workingTitle;
      outlineTree = outlineResult.outlineTree;
      outlineGrounding = outlineResult.grounding || null;
      chapters = normalizeOutlineChapters(outlineResult.chapters);
      totalStats = addStats(totalStats, outlineResult.stats);
      const outlineBilling = await chargeGeneratedTokens({
        req,
        stats: outlineResult.stats,
        reason: "full_book_outline_generation",
        description: `Generated full-book outline for "${workingTitle}"`,
        provider: selectedProvider,
        model: outlineResult.modelName,
        metadata: { title: workingTitle },
      });
      billingCharges.push(serializeBilling(outlineBilling));
    }

    const bookContext = createBookContext({
      title: workingTitle,
      genre: safeGenre,
      audience: safeAudience,
      chapters,
    });

    const generatedChapters = [];
    let failedCount = 0;

    for (const chapter of chapters) {
      try {
        const result = await generateSectionForProvider(selectedProvider, {
          chapterTitle: chapter.title,
          chapterDescription: chapter.description,
          style: safeStyle,
          bookTitle: workingTitle,
          genre: safeGenre,
          audience: safeAudience,
          bookContext,
          useGoogleSearch,
        });
        const content = assertGeneratedChapterContent(result, {
          provider: selectedProvider,
          chapterTitle: chapter.title,
        });

        totalStats = addStats(totalStats, result.stats);
        const chapterBilling = await chargeGeneratedTokens({
          req,
          stats: result.stats,
          reason: "full_book_chapter_generation",
          description: `Generated chapter "${chapter.title}"`,
          provider: selectedProvider,
          model: result.modelName,
          metadata: { title: workingTitle, chapterTitle: chapter.title },
        });
        billingCharges.push(serializeBilling(chapterBilling));
        generatedChapters.push({
          ...chapter,
          content,
          generationStatus: "complete",
          wordCount: countWords(content),
          generationStats: {
            ...result.stats,
            ...(result.grounding ? { grounding: result.grounding } : {}),
          },
        });
      } catch (error) {
        console.error(`Error generating chapter "${chapter.title}":`, error);
        failedCount += 1;
        generatedChapters.push({
          ...chapter,
          generationStatus: "failed",
          generationStats: {
            error: error.message,
          },
        });
      }
    }

    const generation = {
      provider: selectedProvider,
      status: failedCount ? "failed" : "complete",
      sourcePrompt: safeTopic,
      style: safeStyle,
      structureModel,
      sectionModel,
      outlineTree,
      useGoogleSearch,
      grounding: outlineGrounding,
      stats: totalStats,
      statsText: summarizeStatsForDisplay(totalStats),
      startedAt,
      completedAt: new Date(),
    };

    if (book) {
      book.title = workingTitle;
      book.subtitle = workingSubtitle;
      book.author = workingAuthor;
      book.genre = safeGenre;
      book.audience = safeAudience;
      book.chapters = generatedChapters;
      book.generation = generation;
      await book.save();
    } else {
      book = await Book.create({
        userId: req.user.id,
        title: workingTitle,
        subtitle: workingSubtitle,
        author: workingAuthor,
        genre: safeGenre,
        audience: safeAudience,
        chapters: generatedChapters,
        generation,
      });
    }

    return res.status(bookId ? 200 : 201).json({
      message: failedCount
        ? "Book generated with some failed chapters."
        : "Full book generated successfully!",
      book,
      generation,
      failedCount,
      billing: billingCharges,
    });
  } catch (error) {
    console.error("Error generating full book:", error);

    return res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Internal Server Error!" });
  }
}

async function createFullBookJob(req, res) {
  try {
    const includesImages = isEnabled(
      req.body.includeImages ?? req.body.generateImages
    );
    const includesCover = isEnabled(req.body.generateCover ?? req.body.includeCover);
    await assertHasCredits(
      req.user.id,
      includesImages || includesCover ? CREDIT_CONFIG.imageCredits : 0.0001
    );

    if (req.body.bookId) {
      const book = await Book.findById(req.body.bookId);

      if (!book) {
        return res.status(404).json({ error: "Book not found!" });
      }

      if (book.userId.toString() !== req.user.id.toString()) {
        return res
          .status(403)
          .json({ error: "Forbidden: You cannot update this book!" });
      }
    }

    const job = await createGenerationJob({
      userId: req.user.id,
      payload: req.body,
    });

    return res.status(202).json({
      message: "Full-book generation job started.",
      job,
    });
  } catch (error) {
    console.error("Error creating full-book generation job:", error);

    return res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Internal Server Error!" });
  }
}

async function getFullBookJob(req, res) {
  try {
    const job = await getGenerationJob(req.params.jobId, req.user.id);

    if (!job) {
      return res.status(404).json({ error: "Generation job not found!" });
    }

    const book = job.bookId ? await Book.findById(job.bookId) : null;

    return res.status(200).json({
      message: "Generation job retrieved.",
      job: publicJob(job),
      book,
    });
  } catch (error) {
    console.error("Error getting full-book generation job:", error);

    return res.status(500).json({ error: "Internal Server Error!" });
  }
}

async function cancelFullBookJob(req, res) {
  try {
    const job = await cancelGenerationJob(req.params.jobId, req.user.id);

    if (!job) {
      return res.status(404).json({ error: "Generation job not found!" });
    }

    return res.status(200).json({
      message: "Generation job cancellation requested.",
      job,
    });
  } catch (error) {
    console.error("Error cancelling full-book generation job:", error);

    return res.status(500).json({ error: "Internal Server Error!" });
  }
}

async function retryFullBookJob(req, res) {
  try {
    const job = await retryGenerationJob(req.params.jobId, req.user.id);

    if (!job) {
      return res.status(404).json({ error: "Generation job not found!" });
    }

    return res.status(202).json({
      message: "Failed chapters retry started.",
      job,
    });
  } catch (error) {
    console.error("Error retrying full-book generation job:", error);

    return res.status(500).json({ error: "Internal Server Error!" });
  }
}

async function generateCoverImage(req, res) {
  try {
    const {
      bookId,
      prompt = "",
      aspectRatio = "2:3",
      imageSize,
      model,
      mode = "generate",
    } = req.body;
    const book = await findOwnedBook(bookId, req.user.id);
    const editExisting = mode === "edit";
    const customPrompt = sanitizeInput(prompt, 4000);
    const finalPrompt = editExisting
      ? buildCoverEditPrompt({ book, customPrompt })
      : buildCoverPrompt({ book, customPrompt });
    let referenceImages = [];

    if (editExisting) {
      if (book.coverGeneration?.source !== "gemini" || !book.coverImage) {
        return res.status(400).json({
          error: "Only existing Gemini-generated covers can be edited.",
        });
      }

      referenceImages = [await getCoverReferenceImage(book)];
    }

    await assertHasCredits(req.user.id, CREDIT_CONFIG.imageCredits);
    const image = await generateGeminiImage({
      prompt: finalPrompt,
      model: normalizeImageModel(model),
      aspectRatio: normalizeAspectRatio(aspectRatio, "2:3"),
      imageSize: normalizeImageSize(imageSize),
      referenceImages,
    });
    const billing = await chargeImageUsage({
      userId: req.user.id,
      reason: "cover_image_generation",
      description: `Generated cover image for "${book.title}"`,
      provider: "gemini",
      model: image.model,
      usage: image.stats,
      metadata: {
        bookId: book._id.toString(),
        aspectRatio: image.aspectRatio,
        imageSize: image.imageSize,
      },
    });

    if (book.coverImage) {
      deleteUploadFile(book.coverImage);
    }

    const previousCoverImage = book.coverImage || "";
    book.coverImage = image.url;
    book.coverGeneration = {
      prompt: finalPrompt,
      model: image.model,
      aspectRatio: image.aspectRatio,
      imageSize: image.imageSize,
      source: "gemini",
      mode: editExisting ? "edited" : "generated",
      customPrompt,
      previousCoverImage,
      createdAt: new Date(),
    };
    await migrateBookImagesToStorage(book);
    await book.save();

    return res.status(200).json({
      message: "Cover image generated successfully!",
      image,
      book,
      billing: serializeBilling(billing),
    });
  } catch (error) {
    console.error("Error generating cover image:", error);

    return res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Internal Server Error!" });
  }
}

async function generateChapterImage(req, res) {
  try {
    const {
      bookId,
      chapterIndex,
      prompt = "",
      alt = "",
      aspectRatio = "16:9",
      imageSize,
      model,
      insertIntoContent = true,
    } = req.body;
    const book = await findOwnedBook(bookId, req.user.id);
    const safeChapterIndex = Number.parseInt(chapterIndex, 10);

    if (
      !Number.isInteger(safeChapterIndex) ||
      safeChapterIndex < 0 ||
      safeChapterIndex >= book.chapters.length
    ) {
      return res.status(400).json({ error: "Valid chapter index is required." });
    }

    const chapter = book.chapters[safeChapterIndex];
    const customPrompt = sanitizeInput(prompt, 4000);
    const finalPrompt = buildChapterImagePrompt({
      book,
      chapter,
      customPrompt,
    });
    await assertHasCredits(req.user.id, CREDIT_CONFIG.imageCredits);
    const image = await generateGeminiImage({
      prompt: finalPrompt,
      model: normalizeImageModel(model),
      aspectRatio: normalizeAspectRatio(aspectRatio, "16:9"),
      imageSize: normalizeImageSize(imageSize),
    });
    const billing = await chargeImageUsage({
      userId: req.user.id,
      reason: "chapter_image_generation",
      description: `Generated image for "${chapter.title}"`,
      provider: "gemini",
      model: image.model,
      usage: image.stats,
      metadata: {
        bookId: book._id.toString(),
        chapterIndex: safeChapterIndex,
        aspectRatio: image.aspectRatio,
        imageSize: image.imageSize,
      },
    });
    const imageAlt =
      sanitizeInput(alt, 300) ||
      `${chapter.title || `Chapter ${safeChapterIndex + 1}`} illustration`;
    const imageAsset = {
      url: image.url,
      prompt: finalPrompt,
      alt: imageAlt,
      model: image.model,
      mimeType: image.mimeType,
      aspectRatio: image.aspectRatio,
      imageSize: image.imageSize,
      source: "gemini",
    };
    chapter.images = [
      imageAsset,
      ...(chapter.images || []).filter((item) => item?.url !== imageAsset.url),
    ];

    if (insertIntoContent !== false) {
      const imageMarkdown = buildImageMarkdown({
        alt: imageAlt,
        url: image.url,
        req,
      });
      chapter.content = insertImageUnderTitle(chapter.content, imageMarkdown);
      chapter.wordCount = countWords(chapter.content);
    }

    await migrateBookImagesToStorage(book);
    book.markModified("chapters");
    await book.save();

    return res.status(200).json({
      message: "Chapter image generated successfully!",
      image: imageAsset,
      book,
      billing: serializeBilling(billing),
    });
  } catch (error) {
    console.error("Error generating chapter image:", error);

    return res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Internal Server Error!" });
  }
}

async function runQualityTool(req, res) {
  try {
    const {
      action,
      content,
      provider,
      tone,
      bookTitle,
      chapterTitle,
      audience,
    } = req.body;

    if (!action || !content) {
      return res
        .status(400)
        .json({ error: "Action and content are required!" });
    }

    const selectedProvider = normalizeProvider(provider);
    const safeAction = sanitizeInput(action, 50);
    const safeTone = sanitizeInput(tone, 100);
    const safeContent = String(content).slice(0, 20000);
    const instructionMap = {
      rewrite: "Rewrite the text for clarity, flow, and professional polish.",
      expand:
        "Expand the text with useful detail, examples, transitions, and stronger explanations.",
      shorten:
        "Shorten the text while preserving the core meaning and important details.",
      continue:
        "Continue writing from the end of the text in the same style and structure.",
      tone:
        `Adjust the text to this tone: ${safeTone || "clear and engaging"}.`,
      consistency:
        "Review the text for internal consistency, continuity problems, contradictions, and weak claims. Return concise editorial notes.",
      sources:
        "Flag claims that may need citations, fact-checking, or source warnings. Return concise editorial notes.",
      cover:
        "Create a detailed AI image prompt for a professional book cover based on the text.",
      kdp_description:
        "Write a polished Amazon KDP book description. Make it sales-focused, clear, and formatted with short paragraphs. Do not invent credentials, awards, or claims not supported by the content.",
      kdp_keywords:
        "Suggest 7 Amazon KDP keyword slots. Each slot should be a phrase a reader might search for. Return one numbered list only.",
      kdp_categories:
        "Suggest 5 likely Amazon/KDP browse category directions for this book. Include a short reason for each. Do not claim exact category availability.",
      kdp_blurb:
        "Write a concise back-cover blurb for the print edition. Make it compelling but accurate to the book.",
      kdp_author_bio:
        "Draft a professional author bio based only on the author name and available book context. If credentials are missing, keep it general and do not invent facts.",
      kdp_toc:
        "Generate a clean table of contents for the book using the chapter titles and structure. Return a publish-ready table of contents with chapter numbers and titles only.",
      kdp_copyright:
        "Draft a clean copyright page template for this book. Include placeholders where publisher, ISBN, edition, or rights details are unknown.",
      kdp_risk_check:
        "Review the book context for KDP publishing risks: unsupported claims, missing disclosures, metadata mismatch, weak positioning, formatting risks, and cover concerns. Return concise actionable notes.",
      kdp_cover_prompt:
        "Create a detailed prompt for a KDP-ready book cover concept. Include front cover direction plus notes for a wraparound paperback cover with back cover, spine, barcode space, bleed, and safe zones.",
    };
    const instruction = instructionMap[safeAction];

    if (!instruction) {
      return res.status(400).json({ error: "Unsupported AI tool action!" });
    }

    await assertHasCredits(req.user.id, 0.0001);

    const prompt = `You are a senior book editor helping improve an AI-generated book.

Book: ${sanitizeInput(bookTitle, 200)}
Chapter: ${sanitizeInput(chapterTitle, 200)}
Audience: ${sanitizeInput(audience, 200)}
Task: ${instruction}

Return only the result. Preserve markdown where appropriate.

<content>
${safeContent}
</content>`;

    if (selectedProvider === "groq") {
      const { sectionModel } = getGroqModels();
      const completion = await createGroqChatCompletion({
        model: sectionModel,
        messages: [
          {
            role: "system",
            content:
              "You are a careful book editor. Follow the requested editing task exactly.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.25,
        maxCompletionTokens: Number(ENV.GROQ_SECTION_MAX_TOKENS || 9000),
      });
      const stats = normalizeUsageStats(completion.usage, sectionModel);
      const billing = await chargeGeneratedTokens({
        req,
        stats,
        reason: "ai_tool_tokens",
        description: `Ran AI tool: ${safeAction}`,
        provider: "groq",
        model: sectionModel,
        metadata: { action: safeAction },
      });

      return res.status(200).json({
        message: "AI tool completed successfully!",
        content: completion.choices?.[0]?.message?.content?.trim() || "",
        provider: "groq",
        model: sectionModel,
        stats,
        billing: serializeBilling(billing),
      });
    }

    const result = await runGeminiEditorialTask(prompt);
    const billing = await chargeGeneratedTokens({
      req,
      stats: result.stats,
      reason: "ai_tool_tokens",
      description: `Ran AI tool: ${safeAction}`,
      provider: "gemini",
      model: result.modelName,
      metadata: { action: safeAction },
    });

    return res.status(200).json({
      message: "AI tool completed successfully!",
      content: result.content,
      provider: "gemini",
      model: result.modelName,
      stats: result.stats,
      billing: serializeBilling(billing),
    });
  } catch (error) {
    console.error("Error running AI quality tool:", error);

    return res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Internal Server Error!" });
  }
}

module.exports = {
  cancelFullBookJob,
  createFullBookJob,
  generateBookOutline,
  generateChapterContent,
  generateChapterImage,
  generateCoverImage,
  generateFullBook,
  getFullBookJob,
  retryFullBookJob,
  runQualityTool,
};
