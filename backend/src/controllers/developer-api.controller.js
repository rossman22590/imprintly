const {
  assertBookReadyForApiExport,
  prepareOwnedBookForExport,
  sendBookEpub,
  sendBookPdf,
} = require("../utils/book-export.service");
const {
  cancelGenerationJob,
  createGenerationJob,
  getGenerationJob,
  publicJob,
  retryGenerationJob,
  validateFullBookJobRequest,
} = require("../utils/book-generation.jobs");

function serializeV1GenerationJob(job) {
  const value = publicJob(job);

  if (!value) return null;

  return {
    object: "generation_job",
    id: value.id,
    status: value.status,
    bookId: value.bookId || null,
    provider: value.provider,
    progress: value.progress || null,
    failedChapters: value.failedChapters || [],
    error: value.error || "",
    createdAt: value.createdAt || null,
    updatedAt: value.updatedAt || null,
    startedAt: value.startedAt || null,
    completedAt: value.completedAt || null,
  };
}

function getApiPayload(req) {
  return {
    ...(req.body || {}),
    apiSource: "api",
    apiKeyId: req.apiKey?.id || "",
  };
}

function getRequestOrigin(req) {
  const forwardedProtocol = String(req.get("x-forwarded-proto") || "")
    .split(",")[0]
    .trim();
  const forwardedHost = String(req.get("x-forwarded-host") || "")
    .split(",")[0]
    .trim();
  const protocol = forwardedProtocol || req.protocol || "https";
  const host = forwardedHost || req.get("host");

  return host ? `${protocol}://${host}` : "";
}

function buildBookDownloadLinks(req, bookId) {
  const encodedBookId = encodeURIComponent(String(bookId || ""));
  const origin = getRequestOrigin(req);
  const basePath = `/api/v1/books/${encodedBookId}`;
  const baseUrl = origin ? `${origin}${basePath}` : basePath;

  return {
    pdf: {
      url: `${baseUrl}/pdf`,
      method: "GET",
      contentType: "application/pdf",
      auth: "Bearer API key",
    },
    epub: {
      url: `${baseUrl}/epub`,
      method: "GET",
      contentType: "application/epub+zip",
      auth: "Bearer API key",
    },
  };
}

function serializeV1ImageAsset(image = {}) {
  return {
    id: image._id?.toString?.() || image.id || "",
    url: image.url || "",
    prompt: image.prompt || "",
    alt: image.alt || "",
    model: image.model || "",
    mimeType: image.mimeType || "",
    aspectRatio: image.aspectRatio || "",
    imageSize: image.imageSize || "",
    source: image.source || "",
    createdAt: image.createdAt || null,
    updatedAt: image.updatedAt || null,
  };
}

function serializeV1Chapter(chapter = {}) {
  return {
    id: chapter._id?.toString?.() || chapter.id || "",
    title: chapter.title || "",
    description: chapter.description || "",
    content: chapter.content || "",
    generationStatus: chapter.generationStatus || "empty",
    wordCount: chapter.wordCount || 0,
    outlinePath: Array.isArray(chapter.outlinePath) ? chapter.outlinePath : [],
    generationStats: chapter.generationStats || null,
    images: Array.isArray(chapter.images)
      ? chapter.images.map(serializeV1ImageAsset)
      : [],
    createdAt: chapter.createdAt || null,
    updatedAt: chapter.updatedAt || null,
  };
}

function serializePublicBook(book) {
  const value =
    typeof book?.toObject === "function"
      ? book.toObject({ depopulate: true, versionKey: false })
      : book || {};

  return {
    id: value._id?.toString?.() || value.id || "",
    title: value.title || "",
    subtitle: value.subtitle || "",
    author: value.author || "",
    genre: value.genre || "",
    audience: value.audience || "",
    language: value.language || "",
    status: value.status || "draft",
    coverImage: value.coverImage || "",
    coverGeneration: value.coverGeneration || null,
    chapters: Array.isArray(value.chapters)
      ? value.chapters.map(serializeV1Chapter)
      : [],
    generation: value.generation || null,
    kdp: value.kdp || null,
    bible: value.bible || null,
    visualBible: value.visualBible || null,
    createdAt: value.createdAt || null,
    updatedAt: value.updatedAt || null,
  };
}

function serializeV1Book(req, book) {
  const bookId = book?._id?.toString?.() || book?.id || "";
  const publicBook = serializePublicBook(book);

  return {
    object: "book",
    id: bookId,
    status: book?.generation?.status || "manual",
    book: publicBook,
    downloads: buildBookDownloadLinks(req, bookId),
  };
}

async function createGenerationJobV1(req, res) {
  try {
    const payload = getApiPayload(req);

    await validateFullBookJobRequest({
      userId: req.user.id,
      payload,
    });

    const job = await createGenerationJob({
      userId: req.user.id,
      payload,
    });

    return res.status(202).json(serializeV1GenerationJob(job));
  } catch (error) {
    console.error("Error creating developer API generation job:", error);

    return res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Internal Server Error!" });
  }
}

async function getGenerationJobV1(req, res) {
  try {
    const job = await getGenerationJob(req.params.jobId, req.user.id);

    if (!job) {
      return res.status(404).json({ error: "Generation job not found." });
    }

    return res.status(200).json(serializeV1GenerationJob(job));
  } catch (error) {
    console.error("Error getting developer API generation job:", error);

    return res.status(500).json({ error: "Internal Server Error!" });
  }
}

async function cancelGenerationJobV1(req, res) {
  try {
    const job = await cancelGenerationJob(req.params.jobId, req.user.id);

    if (!job) {
      return res.status(404).json({ error: "Generation job not found." });
    }

    return res.status(200).json(serializeV1GenerationJob(job));
  } catch (error) {
    console.error("Error cancelling developer API generation job:", error);

    return res.status(500).json({ error: "Internal Server Error!" });
  }
}

async function retryGenerationJobV1(req, res) {
  try {
    const job = await retryGenerationJob(req.params.jobId, req.user.id, {
      payloadOverrides: {
        apiSource: "api",
        apiKeyId: req.apiKey?.id || "",
      },
    });

    if (!job) {
      return res.status(404).json({ error: "Generation job not found." });
    }

    return res.status(202).json(serializeV1GenerationJob(job));
  } catch (error) {
    console.error("Error retrying developer API generation job:", error);

    return res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Internal Server Error!" });
  }
}

async function getBookV1(req, res) {
  try {
    const book = await prepareOwnedBookForExport(req.user.id, req.params.bookId);

    return res.status(200).json(serializeV1Book(req, book));
  } catch (error) {
    console.error("Error getting developer API book:", error);

    return res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Internal Server Error!" });
  }
}

async function exportBookPdfV1(req, res) {
  try {
    const book = await prepareOwnedBookForExport(req.user.id, req.params.bookId);

    assertBookReadyForApiExport(book);
    await sendBookPdf(res, book);
  } catch (error) {
    console.error("Error exporting developer API PDF:", error);

    if (!res.headersSent) {
      res
        .status(error.statusCode || 500)
        .json({ error: error.message || "Internal Server Error!" });
    }
  }
}

async function exportBookEpubV1(req, res) {
  try {
    const book = await prepareOwnedBookForExport(req.user.id, req.params.bookId);

    assertBookReadyForApiExport(book);
    return sendBookEpub(res, book);
  } catch (error) {
    console.error("Error exporting developer API EPUB:", error);

    if (!res.headersSent) {
      return res
        .status(error.statusCode || 500)
        .json({ error: error.message || "Internal Server Error!" });
    }
  }
}

module.exports = {
  buildBookDownloadLinks,
  cancelGenerationJobV1,
  createGenerationJobV1,
  exportBookEpubV1,
  exportBookPdfV1,
  getBookV1,
  getGenerationJobV1,
  retryGenerationJobV1,
  serializePublicBook,
  serializeV1Book,
  serializeV1GenerationJob,
};
