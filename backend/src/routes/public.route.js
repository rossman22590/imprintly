const router = require("express").Router();
const {
  getCommunityBook,
  getCommunityBookPdf,
  getCommunityBookshelf,
  getPublicBookshelf,
  getPublicBookPreview,
  getPublicBookPreviewPdf,
} = require("../controllers/public.controller");

router.get("/community-bookshelf", getCommunityBookshelf);
router.get("/community-bookshelf/:bookId/pdf", getCommunityBookPdf);
router.get("/community-bookshelf/:bookId", getCommunityBook);
router.get("/bookshelves/:shareToken", getPublicBookshelf);
router.get("/book-previews/:shareToken", getPublicBookPreview);
router.get("/book-previews/:shareToken/pdf", getPublicBookPreviewPdf);

module.exports = router;
