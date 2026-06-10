const router = require("express").Router();
const { authenticate } = require("../middlewares/auth.middleware");
const {
  getBooks,
  getBookById,
  createBook,
  importVisualReferenceUrl,
  updateBookContent,
  updateBookCover,
  updateBookKdp,
  uploadBookSources,
  uploadVisualReference,
  enableBookPreviewShare,
  disableBookPreviewShare,
  updateBookCommunityListing,
  deleteBook,
} = require("../controllers/books.controller");
const {
  uploadBookCoverImage,
  uploadBookSourceFiles,
  uploadVisualReferenceImage,
} = require("../middlewares/upload.middleware");

// All routes require authentication
router.use(authenticate);

// GET /api/books - Get all user's books
// POST /api/books - Create a new book
router.route("/").get(getBooks).post(createBook);

// POST /api/books/visual-references/upload - Upload a reusable Visual Bible image
router
  .route("/visual-references/upload")
  .post(uploadVisualReferenceImage, uploadVisualReference);

// POST /api/books/visual-references/import-url - Import an image URL into durable storage
router.route("/visual-references/import-url").post(importVisualReferenceUrl);

// POST /api/books/source-files/upload - Upload source documents for Gemini book creation
router.route("/source-files/upload").post(uploadBookSourceFiles, uploadBookSources);

// GET /api/books/:bookId - Get a specific book
// PUT /api/books/:bookId - Update book content/metadata
// DELETE /api/books/:bookId - Delete a book
router
  .route("/:bookId")
  .get(getBookById)
  .put(updateBookContent)
  .delete(deleteBook);

// PUT /api/books/:bookId/cover - Upload/update book cover image
router.route("/:bookId/cover").put(uploadBookCoverImage, updateBookCover);

// PATCH /api/books/:bookId/kdp - Save KDP Studio settings and generated assets
router.route("/:bookId/kdp").patch(updateBookKdp);

// POST/DELETE /api/books/:bookId/preview-share - Create or revoke public chapter preview link
router
  .route("/:bookId/preview-share")
  .post(enableBookPreviewShare)
  .delete(disableBookPreviewShare);

// PATCH /api/books/:bookId/community-listing - Post/remove a book in the community bookshelf
router.route("/:bookId/community-listing").patch(updateBookCommunityListing);

// Translation routes
const {
  createTranslation,
  getTranslations,
  toggleTranslationActive,
  deleteTranslation,
  translateChapter,
  translateBook,
  estimateChapterTranslation,
  estimateBookTranslation,
  getTranslationAudiobookVoices,
  updateTranslationAudiobookSettings,
  generateTranslationAudiobookChapter,
  getTranslationAudiobookState,
  updateTranslationDetails
} = require("../controllers/translations.controller");

router.route("/:bookId/translations")
  .get(getTranslations)
  .post(createTranslation);

router.route("/:bookId/translations/:transId")
  .delete(deleteTranslation)
  .patch(updateTranslationDetails);

router.route("/:bookId/translations/:transId/active")
  .patch(toggleTranslationActive);

router.route("/:bookId/translations/:transId/estimate")
  .get(estimateBookTranslation);

router.route("/:bookId/translations/:transId/translate")
  .post(translateBook);

router.route("/:bookId/translations/:transId/chapters/:chapterId/estimate")
  .get(estimateChapterTranslation);

router.route("/:bookId/translations/:transId/chapters/:chapterId/translate")
  .post(translateChapter);

router.route("/:bookId/translations/:transId/audiobook/voices")
  .get(getTranslationAudiobookVoices);

router.route("/:bookId/translations/:transId/audiobook/settings")
  .patch(updateTranslationAudiobookSettings);

router.route("/:bookId/translations/:transId/audiobook/chapters/:chapterId/generate")
  .post(generateTranslationAudiobookChapter);

router.route("/:bookId/translations/:transId/audiobook")
  .get(getTranslationAudiobookState);

module.exports = router;
