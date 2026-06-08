const router = require("express").Router();
const { authenticate } = require("../middlewares/auth.middleware");
const { uploadIntroAudio } = require("../middlewares/upload.middleware");
const {
  getAudiobook,
  getVoices,
  getAudiobookEstimate,
  saveIntro,
  saveChapterScript,
  resetChapterScript,
  generate,
  getJob,
  setChapterVersion,
  setIntroVersion,
  downloadZip,
  downloadM4b,
} = require("../controllers/audiobook.controller");

// All routes require authentication
router.use(authenticate);

// GET /api/audiobook/voices - List voices (supports search)
router.route("/voices").get(getVoices);

// GET /api/audiobook/jobs/:jobId - Poll job status
router.route("/jobs/:jobId").get(getJob);

// GET /api/audiobook/:bookId - Get audiobook state
// POST /api/audiobook/:bookId/generate - Trigger generation
router.route("/:bookId").get(getAudiobook);
router.route("/:bookId/generate").post(generate);

// POST /api/audiobook/:bookId/estimate - Cost estimate
router.route("/:bookId/estimate").post(getAudiobookEstimate);

// POST /api/audiobook/:bookId/intro - Save intro script or audio recording
router.route("/:bookId/intro").post(uploadIntroAudio, saveIntro);

// PATCH /api/audiobook/:bookId/intro/version - Pick intro album version
router.route("/:bookId/intro/version").patch(setIntroVersion);

// PATCH /api/audiobook/:bookId/chapters/:chapterIndex/version - Pick album version
router.route("/:bookId/chapters/:chapterIndex/version").patch(setChapterVersion);

// PATCH /api/audiobook/:bookId/chapters/:chapterIndex/script - Save chapter script
router.route("/:bookId/chapters/:chapterIndex/script").patch(saveChapterScript);

// POST /api/audiobook/:bookId/chapters/:chapterIndex/script/reset - Reset script from book
router
  .route("/:bookId/chapters/:chapterIndex/script/reset")
  .post(resetChapterScript);

// Album downloads
router.route("/:bookId/album.zip").get(downloadZip);
router.route("/:bookId/album.m4b").get(downloadM4b);

module.exports = router;
