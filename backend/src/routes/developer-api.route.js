const router = require("express").Router();
const {
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
} = require("../controllers/developer-api.controller");
const { authenticateApiKey } = require("../middlewares/api-key.middleware");

router.use(authenticateApiKey);

router.get("/credits", getCreditsV1);

router.post("/ebooks", createGenerationJobV1);
router.post("/generation-jobs", createGenerationJobV1);
router.get("/generation-jobs", listGenerationJobsV1);
router.get("/generation-jobs/:jobId", getGenerationJobV1);
router.delete("/generation-jobs/:jobId", cancelGenerationJobV1);
router.post("/generation-jobs/:jobId/retry", retryGenerationJobV1);

router.get("/ebooks", listBooksV1);
router.get("/books", listBooksV1);
router.get("/ebooks/:bookId/pdf", exportBookPdfV1);
router.get("/ebooks/:bookId/epub", exportBookEpubV1);
router.get("/ebooks/:bookId", getBookV1);
router.get("/books/:bookId/pdf", exportBookPdfV1);
router.get("/books/:bookId/epub", exportBookEpubV1);
router.get("/books/:bookId", getBookV1);

module.exports = router;
