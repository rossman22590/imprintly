const router = require("express").Router();
const {
  getPublicBookshelf,
  getPublicBookPreview,
  getPublicBookPreviewPdf,
} = require("../controllers/public.controller");

router.get("/bookshelves/:shareToken", getPublicBookshelf);
router.get("/book-previews/:shareToken", getPublicBookPreview);
router.get("/book-previews/:shareToken/pdf", getPublicBookPreviewPdf);

module.exports = router;
