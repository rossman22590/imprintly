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
  uploadSourceFilesV1,
} = require("../controllers/developer-api.controller");
const { authenticateApiKey } = require("../middlewares/api-key.middleware");
const { uploadApiSourceFiles } = require("../middlewares/upload.middleware");
const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");

router.use(authenticateApiKey);

// Per-key cap on uploads so a single key can't fill the disk via automation.
// Keyed on the authenticated API key id (auth runs above), so it is independent
// of the global IP-based /api limiter. Falls back to the IPv6-safe IP key.
const sourceUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => req.apiKey?.id || ipKeyGenerator(req.ip),
  message: { error: "Upload rate limit reached. Try again later." },
});

router.get("/credits", getCreditsV1);

router.post(
  "/source-files",
  sourceUploadLimiter,
  uploadApiSourceFiles,
  uploadSourceFilesV1
);

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
