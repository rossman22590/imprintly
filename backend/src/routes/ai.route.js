const router = require("express").Router();
const { authenticate } = require("../middlewares/auth.middleware");
const {
  cancelFullBookJob,
  createFullBookJob,
  generateBookOutline,
  generateChapterContent,
  generateChapterImage,
  generateCoverImage,
  getFullBookJob,
  listFullBookJobs,
  retryFullBookJob,
  runQualityTool,
} = require("../controllers/ai.controller");

router.use(authenticate);

router.post("/generate-book-outline", generateBookOutline);
router.post("/generate-chapter-content", generateChapterContent);
router.post("/generate-cover-image", generateCoverImage);
router.post("/generate-chapter-image", generateChapterImage);
router.post("/generate-full-book", createFullBookJob);
router.post("/quality-tool", runQualityTool);
router.post("/full-book-jobs", createFullBookJob);
router.get("/full-book-jobs", listFullBookJobs);
router.get("/full-book-jobs/:jobId", getFullBookJob);
router.delete("/full-book-jobs/:jobId", cancelFullBookJob);
router.post("/full-book-jobs/:jobId/retry", retryFullBookJob);

module.exports = router;
