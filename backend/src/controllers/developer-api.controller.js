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
  listGenerationJobs,
  publicJob,
  retryGenerationJob,
  validateFullBookJobRequest,
} = require("../utils/book-generation.jobs");
const { getCreditSummary } = require("../utils/credits.service");
const { buildSourceFileRecord } = require("../utils/book-source-documents");
const Book = require("../models/Book");
const fs = require("fs");

const JOB_STATUSES = new Set([
  "queued",
  "generating",
  "cancelling",
  "cancelled",
  "complete",
  "failed",
]);
const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 100;

function getListQueryOptions(req) {
  const limit = Math.min(
    Math.max(Number.parseInt(req.query?.limit, 10) || DEFAULT_LIST_LIMIT, 1),
    MAX_LIST_LIMIT
  );
  const offset = Math.max(Number.parseInt(req.query?.offset, 10) || 0, 0);

  return { limit, offset };
}

function serializeV1List(data, { limit, offset, hasMore }) {
  return {
    object: "list",
    data,
    count: data.length,
    limit,
    offset,
    hasMore: hasMore ?? data.length === limit,
  };
}

function sendV1Error(res, error, fallbackMessage = "Internal Server Error!") {
  return res.status(error.statusCode || 500).json({
    error: error.statusCode ? error.message : fallbackMessage,
    ...(error.code && { code: error.code }),
  });
}

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

function serializeV1Credits(summary = {}) {
  const credits = summary.credits || {};

  return {
    object: "credits",
    creditsLeft: credits.balance || 0,
    credits: {
      balance: credits.balance || 0,
      lifetimeGranted: credits.lifetimeGranted || 0,
      lifetimeSpent: credits.lifetimeSpent || 0,
      monthlyAllowance: credits.monthlyAllowance || 0,
      monthlyPreset: credits.monthlyPreset || "",
      monthlyResetAt: credits.monthlyResetAt || null,
      nextMonthlyResetAt: credits.nextMonthlyResetAt || null,
    },
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

function serializeV1BookSummary(req, book) {
  const value =
    typeof book?.toObject === "function"
      ? book.toObject({ depopulate: true, versionKey: false })
      : book || {};
  const bookId = value._id?.toString?.() || value.id || "";

  return {
    object: "book_summary",
    id: bookId,
    title: value.title || "",
    subtitle: value.subtitle || "",
    author: value.author || "",
    genre: value.genre || "",
    audience: value.audience || "",
    language: value.language || "",
    status: value.generation?.status || "manual",
    bookStatus: value.status || "draft",
    coverImage: value.coverImage || "",
    chapterCount: Array.isArray(value.chapters) ? value.chapters.length : 0,
    createdAt: value.createdAt || null,
    updatedAt: value.updatedAt || null,
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

    return sendV1Error(res, error);
  }
}

async function listGenerationJobsV1(req, res) {
  try {
    const { limit, offset } = getListQueryOptions(req);
    const status = String(req.query?.status || "").trim().toLowerCase();

    if (status && !JOB_STATUSES.has(status)) {
      return res.status(400).json({
        error: `Invalid status filter. Allowed values: ${[...JOB_STATUSES].join(
          ", "
        )}.`,
      });
    }

    const jobsPage = await listGenerationJobs(req.user.id, {
      limit: limit + 1,
      offset,
      status,
      maxLimit: MAX_LIST_LIMIT + 1,
    });
    const hasMore = jobsPage.length > limit;
    const jobs = hasMore ? jobsPage.slice(0, limit) : jobsPage;

    return res
      .status(200)
      .json(
        serializeV1List(jobs.map(serializeV1GenerationJob), {
          limit,
          offset,
          hasMore,
        })
      );
  } catch (error) {
    console.error("Error listing developer API generation jobs:", error);

    return sendV1Error(res, error);
  }
}

async function listBooksV1(req, res) {
  try {
    const { limit, offset } = getListQueryOptions(req);
    const booksPage = await Book.find({ userId: req.user.id })
      .select(
        "title subtitle author genre audience language status coverImage generation.status chapters._id createdAt updatedAt"
      )
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit + 1);
    const hasMore = booksPage.length > limit;
    const books = hasMore ? booksPage.slice(0, limit) : booksPage;

    return res.status(200).json(
      serializeV1List(
        books.map((book) => serializeV1BookSummary(req, book)),
        { limit, offset, hasMore }
      )
    );
  } catch (error) {
    console.error("Error listing developer API books:", error);

    return sendV1Error(res, error);
  }
}

async function uploadSourceFilesV1(req, res) {
  const files = Array.isArray(req.files) ? req.files : [];

  try {
    if (files.length === 0) {
      return res.status(400).json({
        error:
          "No source files provided. Send multipart/form-data with one or more `sourceFiles` fields.",
      });
    }

    const sourceFiles = await Promise.all(files.map(buildSourceFileRecord));

    return res.status(201).json({
      object: "source_files",
      message:
        "Source files uploaded. Pass these objects as `sourceFiles` on a Gemini generation job.",
      sourceFiles,
    });
  } catch (error) {
    console.error("Error uploading developer API source files:", error);

    files.forEach((file) => {
      if (file?.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    });

    return sendV1Error(res, error);
  }
}

async function getCreditsV1(req, res) {
  try {
    const summary = await getCreditSummary(req.user.id, {
      includeTransactions: false,
    });

    return res.status(200).json(serializeV1Credits(summary));
  } catch (error) {
    console.error("Error getting developer API credits:", error);

    return sendV1Error(res, error);
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

    return sendV1Error(res, error);
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

    return sendV1Error(res, error);
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

    return sendV1Error(res, error);
  }
}

async function getBookV1(req, res) {
  try {
    const book = await prepareOwnedBookForExport(req.user.id, req.params.bookId);

    return res.status(200).json(serializeV1Book(req, book));
  } catch (error) {
    console.error("Error getting developer API book:", error);

    return sendV1Error(res, error);
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
      sendV1Error(res, error);
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
      return sendV1Error(res, error);
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
  getCreditsV1,
  getGenerationJobV1,
  listBooksV1,
  listGenerationJobsV1,
  retryGenerationJobV1,
  uploadSourceFilesV1,
  serializePublicBook,
  serializeV1Book,
  serializeV1BookSummary,
  serializeV1Credits,
  serializeV1GenerationJob,
  serializeV1List,
};
