const { generateDocx } = require("../utils/docx.generator");
const { generateMarkdown } = require("../utils/markdown.generator");
const { generateKdpReportPdf } = require("../utils/kdp-report-pdf.generator");
const { generateKdpTocPdf } = require("../utils/kdp-toc-pdf.generator");
const {
  generateContinuityReportPdf,
} = require("../utils/continuity-report-pdf.generator");
const {
  prepareOwnedBookForExport,
  sendBookEpub,
  sendBookPdf,
  setNoStoreHeaders,
} = require("../utils/book-export.service");

async function getOwnedExportBook(req, res) {
  try {
    return await prepareOwnedBookForExport(req.user.id, req.params.bookId);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
    return null;
  }
}

async function exportAsDocx(req, res) {
  try {
    const book = await getOwnedExportBook(req, res);

    if (!book) return;

    const docBuffer = await generateDocx(book);

    // force binary download friendly headers (helps clients like Postman/axios)
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${book.title.replace(/[^a-zA-Z0-9]/g, "_")}.docx"`
    );
    res.setHeader("Content-Length", docBuffer.length);
    res.setHeader("Content-Transfer-Encoding", "binary"); // tell client this is binary
    setNoStoreHeaders(res);

    res.send(docBuffer);
  } catch (error) {
    console.error("Error exporting as DOCX:", error);

    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
}

async function exportAsPdf(req, res) {
  try {
    const book = await getOwnedExportBook(req, res);

    if (!book) return;

    await sendBookPdf(res, book);
  } catch (error) {
    console.error("Error exporting as PDF:", error);

    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
}

async function exportKdpTableOfContentsPdf(req, res) {
  try {
    const book = await getOwnedExportBook(req, res);

    if (!book) return;

    const pdfBuffer = await generateKdpTocPdf(book, {
      design: req.query.design,
    });
    const filename = `${book.title.replace(
      /[^a-zA-Z0-9]/g,
      "_"
    )}_table_of_contents.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.setHeader("Content-Transfer-Encoding", "binary");
    setNoStoreHeaders(res);

    return res.send(pdfBuffer);
  } catch (error) {
    console.error("Error exporting KDP table of contents PDF:", error);

    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
}

async function exportKdpReportPdf(req, res) {
  try {
    const book = await getOwnedExportBook(req, res);

    if (!book) return;

    const pdfBuffer = await generateKdpReportPdf(book);
    const filename = `${book.title.replace(
      /[^a-zA-Z0-9]/g,
      "_"
    )}_risk_notes.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.setHeader("Content-Transfer-Encoding", "binary");
    setNoStoreHeaders(res);

    return res.send(pdfBuffer);
  } catch (error) {
    console.error("Error exporting KDP risk notes PDF:", error);

    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
}

async function exportContinuityReportPdf(req, res) {
  try {
    const book = await getOwnedExportBook(req, res);

    if (!book) return;

    const report = String(req.body?.report || "").trim();

    if (!report) {
      return res
        .status(400)
        .json({ error: "Continuity report content is required." });
    }

    if (report.length > 60000) {
      return res
        .status(413)
        .json({ error: "Continuity report is too large to export." });
    }

    const pdfBuffer = await generateContinuityReportPdf(book, report);
    const filename = `${book.title.replace(
      /[^a-zA-Z0-9]/g,
      "_"
    )}_continuity_report.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.setHeader("Content-Transfer-Encoding", "binary");
    setNoStoreHeaders(res);

    return res.send(pdfBuffer);
  } catch (error) {
    console.error("Error exporting continuity report PDF:", error);

    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
}

async function exportAsMarkdown(req, res) {
  try {
    const book = await getOwnedExportBook(req, res);

    if (!book) return;

    const markdown = generateMarkdown(book);
    const filename = `${book.title.replace(/[^a-zA-Z0-9]/g, "_")}.md`;

    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    setNoStoreHeaders(res);

    return res.send(markdown);
  } catch (error) {
    console.error("Error exporting as Markdown:", error);

    return res.status(500).json({ error: error.message });
  }
}

async function exportAsEpub(req, res) {
  try {
    const book = await getOwnedExportBook(req, res);

    if (!book) return;

    return sendBookEpub(res, book);
  } catch (error) {
    console.error("Error exporting as EPUB:", error);

    return res.status(500).json({ error: error.message });
  }
}

module.exports = {
  exportContinuityReportPdf,
  exportAsDocx,
  exportAsEpub,
  exportAsMarkdown,
  exportAsPdf,
  exportKdpReportPdf,
  exportKdpTableOfContentsPdf,
};
