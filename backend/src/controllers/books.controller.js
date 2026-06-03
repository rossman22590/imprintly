const Book = require("../models/Book");
const fs = require("fs");
const {
  assertUploadedImageFile,
  deleteUploadFile,
} = require("../utils/upload-paths");
const {
  uploadImageFileToStorage,
  uploadImageUrlToStorage,
} = require("../utils/image-storage");
const { buildEbookCoverPrompt } = require("../utils/book-image-prompts");
const {
  ensureChapterImageInContent,
  filterChapterImagesToContent,
  normalizeChapterImages,
  removeMissingUploadImageMarkdown,
} = require("../utils/chapter-image-markdown");
const {
  generateGeminiImage,
  normalizeAspectRatio,
  normalizeImageModel,
  normalizeImageSize,
} = require("../utils/gemini-image.generator");
const {
  migrateBookImagesToStorage,
  migrateChapterPayloadImagesToStorage,
} = require("../utils/image-asset-migration");
const { getCoverImageReferences } = require("../utils/image-reference");
const {
  assertHasCredits,
  chargeImageUsage,
  getImageCreditEstimate,
} = require("../utils/credits.service");
const { generateShareToken } = require("../utils/share-token");
const { normalizeChapterLength } = require("../utils/chapter-length");
const { normalizeBookBiblePayload } = require("../utils/book-bible");
const { normalizeVisualBiblePayload } = require("../utils/visual-bible");

const KDP_SETTING_LIMITS = {
  format: 20,
  trimSize: 30,
  paperType: 50,
  pageCountOverride: 20,
  fontSize: 10,
  interiorBleed: 20,
  marginTop: 10,
  marginBottom: 10,
  marginInside: 10,
  marginOutside: 10,
  lineSpacing: 10,
  paragraphIndent: 10,
  coverImageSize: 10,
  tocDesign: 30,
};

const KDP_ASSET_LIMITS = {
  tableOfContents: 20000,
  description: 20000,
  keywords: 5000,
  categories: 10000,
  backCoverBlurb: 12000,
  authorBio: 12000,
  copyrightPage: 12000,
  coverPrompt: 12000,
  riskNotes: 20000,
};

function pickKdpStrings(payload = {}, limits = {}) {
  return Object.entries(limits).reduce((picked, [key, limit]) => {
    if (payload[key] !== undefined) {
      picked[key] = String(payload[key]).slice(0, limit);
    }

    return picked;
  }, {});
}

function normalizeGenerationPayload(generation) {
  if (!generation || typeof generation !== "object") {
    return generation;
  }

  return {
    ...generation,
    chapterLength: normalizeChapterLength(generation.chapterLength),
  };
}

function normalizeVisualBibleForSave(visualBible) {
  if (visualBible === undefined) return undefined;

  return {
    ...normalizeVisualBiblePayload(visualBible),
    updatedAt: new Date(),
  };
}

async function normalizeChapterPayloads(
  chapters = [],
  { syncImagesToContent = false } = {}
) {
  if (!Array.isArray(chapters)) return [];

  return Promise.all(
    chapters.map(async (chapter) => {
      const migrated = await migrateChapterPayloadImagesToStorage(chapter);
      const content = removeMissingUploadImageMarkdown(
        migrated.chapter.content || ""
      );
      const images = syncImagesToContent
        ? filterChapterImagesToContent(content, migrated.chapter.images, {
            requireExisting: true,
          })
        : normalizeChapterImages(migrated.chapter.images, {
            requireExisting: true,
          });
      const normalizedChapter = {
        ...migrated.chapter,
        content,
        images,
      };

      if (!syncImagesToContent) {
        normalizedChapter.content = ensureChapterImageInContent(
          normalizedChapter
        );
      }

      return normalizedChapter;
    })
  );
}

function isEnabled(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function normalizeOptionalHttpUrl(value = "") {
  const trimmed = String(value || "").trim();

  if (!trimmed) return "";

  const normalized = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsed = new URL(normalized);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return null;
    }

    return parsed.href.length <= 500 ? parsed.href : null;
  } catch {
    return null;
  }
}

function normalizeCommunityListingEnabled(value, fallback = false) {
  if (value === undefined) return Boolean(fallback);

  if (value === true || value === "true" || value === 1 || value === "1") {
    return true;
  }

  if (
    value === false ||
    value === "false" ||
    value === 0 ||
    value === "0"
  ) {
    return false;
  }

  return null;
}

function normalizeBooleanFlag(value, fallback = false) {
  if (value === undefined) return Boolean(fallback);

  if (value === true || value === "true" || value === 1 || value === "1") {
    return true;
  }

  if (
    value === false ||
    value === "false" ||
    value === 0 ||
    value === "0"
  ) {
    return false;
  }

  return null;
}

async function getUniqueBookPreviewShareToken() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = generateShareToken("preview");
    const tokenExists = await Book.exists({ "previewShare.token": token });

    if (!tokenExists) return token;
  }

  throw new Error("Could not create a unique preview link.");
}

async function generateInitialCover(book, payload = {}) {
  const finalPrompt = buildEbookCoverPrompt({
    book,
    customPrompt:
      typeof payload.coverPrompt === "string" ? payload.coverPrompt.slice(0, 4000) : "",
  });
  const referenceImages = await getCoverImageReferences(book);
  const image = await generateGeminiImage({
    prompt: finalPrompt,
    model: normalizeImageModel(payload.coverModel),
    aspectRatio: normalizeAspectRatio(payload.coverAspectRatio, "2:3"),
    imageSize: normalizeImageSize(payload.coverImageSize),
    referenceImages,
  });

  book.coverImage = image.url;
  book.coverGeneration = {
    prompt: finalPrompt,
    model: image.model,
    aspectRatio: image.aspectRatio,
    imageSize: image.imageSize,
    source: "gemini",
    mode: "generated",
    customPrompt:
      typeof payload.coverPrompt === "string" ? payload.coverPrompt.slice(0, 4000) : "",
    createdAt: new Date(),
  };

  return { image, referenceImages };
}

async function repairBookChapterImageMarkdown(book) {
  let changed = await migrateBookImagesToStorage(book);

  (book.chapters || []).forEach((chapter) => {
    const previousImageUrls = (chapter.images || [])
      .map((image) => image?.url)
      .filter(Boolean)
      .join("|");
    const nextImages = normalizeChapterImages(chapter.images, {
      requireExisting: true,
    });
    const nextImageUrls = nextImages
      .map((image) => image?.url)
      .filter(Boolean)
      .join("|");
    const nextContent = ensureChapterImageInContent({
      title: chapter.title,
      content: removeMissingUploadImageMarkdown(chapter.content || ""),
      images: nextImages,
    });

    if (nextImageUrls !== previousImageUrls) {
      chapter.images = nextImages;
      changed = true;
    }

    if (nextContent !== (chapter.content || "")) {
      chapter.content = nextContent;
      changed = true;
    }
  });

  if (changed) {
    book.markModified("coverImage");
    book.markModified("chapters");
    await book.save();
  }

  return book;
}

function deleteChapterImages(book) {
  (book.chapters || []).forEach((chapter) => {
    (chapter.images || []).forEach((image) => {
      if (image?.url) {
        deleteUploadFile(image.url);
      }
    });
  });
}

async function getBooks(req, res) {
  try {
    const books = await Book.find({ userId: req.user.id }).sort({
      createdAt: -1,
    });

    for (const book of books) {
      await repairBookChapterImageMarkdown(book);
    }

    return res.status(200).json({
      message: "User's books retrieved successfully!",
      count: books.length,
      books,
    });
  } catch (error) {
    console.error("Error getting books:", error);

    return res
      .status(error.statusCode || 500)
      .json({
        error: error.statusCode ? error.message : "Internal Server Error!",
      });
  }
}

async function getBookById(req, res) {
  try {
    const { bookId } = req.params;

    const book = await Book.findById(bookId);

    if (!book) {
      return res.status(404).json({ error: "Book not found!" });
    }

    // Check authorization
    if (book.userId.toString() !== req.user.id.toString()) {
      return res
        .status(403)
        .json({ error: "Forbidden: You don't have access to this book!" });
    }

    await repairBookChapterImageMarkdown(book);

    return res.status(200).json({
      message: "Book retrieved successfully!",
      book,
    });
  } catch (error) {
    console.error("Error getting book:", error);

    // Handle invalid ObjectId
    if (error.name === "CastError") {
      return res.status(400).json({ error: "Invalid book ID format!" });
    }

    return res
      .status(error.statusCode || 500)
      .json({
        error: error.statusCode ? error.message : "Internal Server Error!",
      });
  }
}

async function createBook(req, res) {
  try {
    const {
      title,
      subtitle,
      author,
      chapters,
      genre,
      audience,
      language,
      targetWordCount,
      generation,
      bible,
      visualBible,
      generateCover,
      coverPrompt,
      coverModel,
      coverAspectRatio,
      coverImageSize,
    } = req.body;

    // Validate required fields
    if (!title || !author) {
      return res.status(400).json({ error: "Title and author are required!" });
    }

    const book = await Book.create({
      userId: req.user.id,
      title,
      subtitle,
      author,
      genre,
      audience,
      language,
      targetWordCount,
      generation: normalizeGenerationPayload(generation),
      bible: normalizeBookBiblePayload(bible),
      visualBible: normalizeVisualBiblePayload(visualBible),
      chapters: await normalizeChapterPayloads(chapters || []),
    });
    let coverError = "";

    if (isEnabled(generateCover)) {
      try {
        await assertHasCredits(
          req.user.id,
          getImageCreditEstimate({
            provider: "gemini",
            model: normalizeImageModel(coverModel),
            imageSize: normalizeImageSize(coverImageSize),
          })
        );
        const { image, referenceImages } = await generateInitialCover(book, {
          coverPrompt,
          coverModel,
          coverAspectRatio,
          coverImageSize,
        });
        await chargeImageUsage({
          userId: req.user.id,
          reason: "cover_image_generation",
          description: `Generated initial cover for "${book.title}"`,
          provider: "gemini",
          model: image.model,
          usage: image.stats,
          metadata: {
            bookId: book._id.toString(),
            aspectRatio: image.aspectRatio,
            imageSize: image.imageSize,
            visualReferenceCount: referenceImages.length,
          },
        });
        await book.save();
      } catch (error) {
        coverError = error.message;
        console.warn("Initial cover generation failed:", error);
      }
    }

    return res.status(201).json({
      message: "Book created successfully!",
      book,
      ...(coverError && { coverError }),
    });
  } catch (error) {
    console.error("Error creating book:", error);

    return res.status(500).json({ error: "Internal Server Error!" });
  }
}

async function updateBookContent(req, res) {
  try {
    const { bookId } = req.params;

    const book = await Book.findById(bookId);

    if (!book) {
      return res.status(404).json({ error: "Book not found!" });
    }

    // check authorization
    if (book.userId.toString() !== req.user.id.toString()) {
      return res
        .status(403)
        .json({ error: "Forbidden: You cannot update this book!" });
    }

    const updateData = {
      title: req.body.title,
      subtitle: req.body.subtitle,
      author: req.body.author,
      chapters:
        req.body.chapters === undefined
          ? undefined
          : await normalizeChapterPayloads(req.body.chapters, {
              syncImagesToContent: true,
            }),
      genre: req.body.genre,
      audience: req.body.audience,
      language: req.body.language,
      targetWordCount: req.body.targetWordCount,
      generation: normalizeGenerationPayload(req.body.generation),
      bible:
        req.body.bible === undefined
          ? undefined
          : {
              ...normalizeBookBiblePayload(req.body.bible),
              updatedAt: new Date(),
            },
      visualBible: normalizeVisualBibleForSave(req.body.visualBible),
      status: req.body.status,
    };

    // remove undefined fields to avoid overwriting with undefined
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    // update book with validation
    const updatedBook = await Book.findByIdAndUpdate(bookId, updateData, {
      new: true, // return updated document
      runValidators: true, // run Mongoose validators
    });

    return res.status(200).json({
      message: "Book updated successfully!",
      book: updatedBook,
    });
  } catch (error) {
    console.error("Error updating book content:", error);

    // handle invalid ObjectId
    if (error.name === "CastError") {
      return res.status(400).json({ error: "Invalid book ID format!" });
    }

    // handle validation errors
    if (error.name === "ValidationError") {
      return res.status(400).json({
        error: "Validation failed",
        details: error.message,
      });
    }

    return res.status(500).json({ error: "Internal Server Error!" });
  }
}

async function uploadVisualReference(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided!" });
    }

    assertUploadedImageFile(req.file);

    const imageUrl = await uploadImageFileToStorage(
      req.file.path,
      req.file.filename,
      req.file.mimetype
    );

    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    return res.status(200).json({
      message: "Visual reference uploaded.",
      imageUrl,
    });
  } catch (error) {
    console.error("Error uploading visual reference:", error);

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    return res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Internal Server Error!" });
  }
}

async function importVisualReferenceUrl(req, res) {
  try {
    const imageUrl = await uploadImageUrlToStorage(
      req.body.url,
      req.body.fileName
    );

    return res.status(200).json({
      message: "Visual reference imported.",
      imageUrl,
    });
  } catch (error) {
    console.error("Error importing visual reference URL:", error);

    return res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Internal Server Error!" });
  }
}

async function updateBookCover(req, res) {
  try {
    const { bookId } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: "No image file provided!" });
    }

    assertUploadedImageFile(req.file);

    const book = await Book.findById(bookId);

    if (!book) {
      // Delete uploaded file if book not found
      fs.unlinkSync(req.file.path);

      return res.status(404).json({ error: "Book not found!" });
    }

    // Check authorization
    if (book.userId.toString() !== req.user.id.toString()) {
      // Delete uploaded file if unauthorized
      fs.unlinkSync(req.file.path);

      return res
        .status(403)
        .json({ error: "Forbidden: You cannot update this book cover!" });
    }

    const storedCoverUrl = await uploadImageFileToStorage(
      req.file.path,
      req.file.filename,
      req.file.mimetype
    );

    // Delete old local cover image if it exists. Remote Spaces assets stay public.
    if (book.coverImage) {
      deleteUploadFile(book.coverImage);
    }

    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    book.coverImage = storedCoverUrl;
    const updatedBook = await book.save();

    return res.status(200).json({
      message: "Book cover updated successfully!",
      book: updatedBook,
    });
  } catch (error) {
    console.error("Error updating book cover image:", error);

    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    // Handle invalid ObjectId
    if (error.name === "CastError") {
      return res.status(400).json({ error: "Invalid book ID format!" });
    }

    return res
      .status(error.statusCode || 500)
      .json({
        error: error.statusCode ? error.message : "Internal Server Error!",
      });
  }
}

async function updateBookKdp(req, res) {
  try {
    const { bookId } = req.params;
    const book = await Book.findById(bookId);

    if (!book) {
      return res.status(404).json({ error: "Book not found!" });
    }

    if (book.userId.toString() !== req.user.id.toString()) {
      return res
        .status(403)
        .json({ error: "Forbidden: You cannot update this book!" });
    }

    const nextSettings = {
      ...(book.kdp?.settings?.toObject?.() || book.kdp?.settings || {}),
      ...pickKdpStrings(req.body.settings, KDP_SETTING_LIMITS),
    };
    const nextAssets = {
      ...(book.kdp?.assets?.toObject?.() || book.kdp?.assets || {}),
      ...pickKdpStrings(req.body.metadata || req.body.assets, KDP_ASSET_LIMITS),
    };

    book.kdp = {
      settings: nextSettings,
      assets: nextAssets,
      updatedAt: new Date(),
    };

    const updatedBook = await book.save();

    return res.status(200).json({
      message: "KDP Studio saved.",
      book: updatedBook,
    });
  } catch (error) {
    console.error("Error updating KDP Studio data:", error);

    if (error.name === "CastError") {
      return res.status(400).json({ error: "Invalid book ID format!" });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        error: "Validation failed",
        details: error.message,
      });
    }

    return res.status(500).json({ error: "Internal Server Error!" });
  }
}

async function enableBookPreviewShare(req, res) {
  try {
    const { bookId } = req.params;
    const book = await Book.findById(bookId);

    if (!book) {
      return res.status(404).json({ error: "Book not found!" });
    }

    if (book.userId.toString() !== req.user.id.toString()) {
      return res
        .status(403)
        .json({ error: "Forbidden: You cannot share this book!" });
    }

    if (!book.previewShare?.token) {
      book.previewShare = {
        token: await getUniqueBookPreviewShareToken(),
        enabledAt: new Date(),
      };
      await book.save();
    }

    return res.status(200).json({
      message: "Book preview share link is active.",
      book,
      previewShare: book.previewShare,
    });
  } catch (error) {
    console.error("Error enabling book preview share:", error);

    if (error.name === "CastError") {
      return res.status(400).json({ error: "Invalid book ID format!" });
    }

    return res.status(500).json({ error: "Internal Server Error!" });
  }
}

async function disableBookPreviewShare(req, res) {
  try {
    const { bookId } = req.params;
    const book = await Book.findById(bookId);

    if (!book) {
      return res.status(404).json({ error: "Book not found!" });
    }

    if (book.userId.toString() !== req.user.id.toString()) {
      return res
        .status(403)
        .json({ error: "Forbidden: You cannot update this book!" });
    }

    book.previewShare = {
      token: "",
      enabledAt: null,
    };
    await book.save();

    return res.status(200).json({
      message: "Book preview share link was revoked.",
      book,
      previewShare: null,
    });
  } catch (error) {
    console.error("Error disabling book preview share:", error);

    if (error.name === "CastError") {
      return res.status(400).json({ error: "Invalid book ID format!" });
    }

    return res.status(500).json({ error: "Internal Server Error!" });
  }
}

async function updateBookCommunityListing(req, res) {
  try {
    const { bookId } = req.params;
    const book = await Book.findById(bookId);

    if (!book) {
      return res.status(404).json({ error: "Book not found!" });
    }

    if (book.userId.toString() !== req.user.id.toString()) {
      return res
        .status(403)
        .json({ error: "Forbidden: You cannot update this book!" });
    }

    const nextIsListed = normalizeCommunityListingEnabled(
      req.body.isListed,
      book.communityListing?.isListed
    );

    if (nextIsListed === null) {
      return res.status(400).json({
        error: "Community listing status must be true or false.",
      });
    }

    const nextFreeFullPdfEnabled = normalizeBooleanFlag(
      req.body.freeFullPdfEnabled,
      book.communityListing?.freeFullPdfEnabled
    );

    if (nextFreeFullPdfEnabled === null) {
      return res.status(400).json({
        error: "Free PDF setting must be true or false.",
      });
    }

    const normalizedPurchaseUrl =
      req.body.purchaseUrl === undefined
        ? book.communityListing?.purchaseUrl || ""
        : normalizeOptionalHttpUrl(req.body.purchaseUrl);

    if (normalizedPurchaseUrl === null) {
      return res.status(400).json({
        error: "Please enter a valid purchase URL.",
      });
    }

    const wasListed = Boolean(book.communityListing?.isListed);
    const wasFreeFullPdfEnabled = Boolean(
      book.communityListing?.freeFullPdfEnabled
    );
    const shouldEnableFreeFullPdf = nextIsListed && nextFreeFullPdfEnabled;

    book.communityListing = {
      isListed: nextIsListed,
      listedAt: nextIsListed
        ? wasListed && book.communityListing?.listedAt
          ? book.communityListing.listedAt
          : new Date()
        : null,
      purchaseUrl: normalizedPurchaseUrl,
      freeFullPdfEnabled: shouldEnableFreeFullPdf,
      freeFullPdfEnabledAt: shouldEnableFreeFullPdf
        ? wasFreeFullPdfEnabled && book.communityListing?.freeFullPdfEnabledAt
          ? book.communityListing.freeFullPdfEnabledAt
          : new Date()
        : null,
    };

    const updatedBook = await book.save();

    return res.status(200).json({
      message: nextIsListed
        ? "Book posted to the community bookshelf."
        : "Book removed from the community bookshelf.",
      book: updatedBook,
      communityListing: updatedBook.communityListing,
    });
  } catch (error) {
    console.error("Error updating community listing:", error);

    if (error.name === "CastError") {
      return res.status(400).json({ error: "Invalid book ID format!" });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        error: "Validation failed",
        details: error.message,
      });
    }

    return res.status(500).json({ error: "Internal Server Error!" });
  }
}

async function deleteBook(req, res) {
  try {
    const { bookId } = req.params;

    const book = await Book.findById(bookId);

    if (!book) {
      return res.status(404).json({ error: "Book not found!" });
    }

    // Check authorization
    if (book.userId.toString() !== req.user.id.toString()) {
      return res
        .status(403)
        .json({ error: "Forbidden: You cannot delete this book!" });
    }

    // Delete cover image if it exists
    if (book.coverImage) {
      deleteUploadFile(book.coverImage);
    }

    deleteChapterImages(book);

    await book.deleteOne();

    return res.status(200).json({
      message: "Book deleted successfully!",
      deletedBookId: bookId,
    });
  } catch (error) {
    console.error("Error deleting book:", error);

    // Handle invalid ObjectId
    if (error.name === "CastError") {
      return res.status(400).json({ error: "Invalid book ID format!" });
    }

    return res.status(500).json({ error: "Internal Server Error!" });
  }
}

module.exports = {
  getBooks,
  getBookById,
  createBook,
  importVisualReferenceUrl,
  updateBookContent,
  updateBookCover,
  updateBookKdp,
  uploadVisualReference,
  enableBookPreviewShare,
  disableBookPreviewShare,
  updateBookCommunityListing,
  deleteBook,
};
