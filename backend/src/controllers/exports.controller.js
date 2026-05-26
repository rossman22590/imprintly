const Book = require("../models/Book");
const { generateDocx } = require("../utils/docx.generator");
const { generateEpub } = require("../utils/epub.generator");
const { generateMarkdown } = require("../utils/markdown.generator");
const { generatePdf } = require("../utils/pdf.generator");
const { migrateBookImagesToStorage } = require("../utils/image-asset-migration");

async function getOwnedExportBook(req, res) {
  const book = await Book.findById(req.params.bookId);

  if (!book) {
    res.status(404).json({ error: "No such book exists!" });
    return null;
  }

  if (book.userId.toString() !== req.user.id.toString()) {
    res.status(403).json({
      error:
        "You are not authorized to perform any operations on the requested book!",
    });
    return null;
  }

  if (await migrateBookImagesToStorage(book)) {
    book.markModified("coverImage");
    book.markModified("chapters");
    await book.save();
  }

  return book;
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
    res.setHeader("Cache-Control", "no-cache"); // avoid caching weirdness in dev

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

    // set binary headers before piping PDF
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${book.title.replace(/[^a-zA-Z0-9]/g, "_")}.pdf"`
    );
    res.setHeader("Content-Transfer-Encoding", "binary");
    res.setHeader("Cache-Control", "no-cache");

    // generate PDF and pipe directly to response (generatePdf handles piping)
    await generatePdf(book, res);
  } catch (error) {
    console.error("Error exporting as PDF:", error);

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
    res.setHeader("Cache-Control", "no-cache");

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

    const epubBuffer = await generateEpub(book);
    const filename = `${book.title.replace(/[^a-zA-Z0-9]/g, "_")}.epub`;

    res.setHeader("Content-Type", "application/epub+zip");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", epubBuffer.length);
    res.setHeader("Cache-Control", "no-cache");

    return res.send(epubBuffer);
  } catch (error) {
    console.error("Error exporting as EPUB:", error);

    return res.status(500).json({ error: error.message });
  }
}

module.exports = { exportAsDocx, exportAsEpub, exportAsMarkdown, exportAsPdf };
