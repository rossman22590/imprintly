const router = require("express").Router();
const { authenticate } = require("../middlewares/auth.middleware");
const {
  exportAsDocx,
  exportAsEpub,
  exportAsMarkdown,
  exportAsPdf,
  exportKdpReportPdf,
  exportKdpTableOfContentsPdf,
} = require("../controllers/exports.controller");

// All export routes require authentication
router.use(authenticate);

router.get("/:bookId/docx", exportAsDocx);
router.get("/:bookId/epub", exportAsEpub);
router.get("/:bookId/markdown", exportAsMarkdown);
router.get("/:bookId/pdf", exportAsPdf);
router.get("/:bookId/kdp-report.pdf", exportKdpReportPdf);
router.get("/:bookId/kdp-table-of-contents.pdf", exportKdpTableOfContentsPdf);

module.exports = router;
