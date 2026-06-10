const mongoose = require("mongoose");
const Book = require("../models/Book");
const { generateEpub } = require("./epub.generator");
const { generatePdf } = require("./pdf.generator");
const { migrateBookImagesToStorage } = require("./image-asset-migration");

function buildHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function safeExportFilename(title = "book", extension = "") {
  const basename = String(title || "book").replace(/[^a-zA-Z0-9]/g, "_");

  return extension ? `${basename}.${extension}` : basename;
}

function setNoStoreHeaders(res) {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
}

async function prepareOwnedBookForExport(userId, bookId) {
  const normalizedBookId = String(bookId || "").trim();

  if (
    !mongoose.Types.ObjectId.isValid(normalizedBookId) ||
    new mongoose.Types.ObjectId(normalizedBookId).toString() !==
      normalizedBookId.toLowerCase()
  ) {
    throw buildHttpError(400, "Invalid book ID.");
  }

  const book = await Book.findById(normalizedBookId);

  if (!book) {
    throw buildHttpError(404, "No such book exists!");
  }

  if (book.userId.toString() !== userId.toString()) {
    throw buildHttpError(
      403,
      "You are not authorized to perform any operations on the requested book!"
    );
  }

  if (await migrateBookImagesToStorage(book)) {
    book.markModified("coverImage");
    book.markModified("chapters");
    await book.save();
  }

  const { applyActiveTranslation } = require("./translation.helper");
  return applyActiveTranslation(book);
}

function assertBookReadyForApiExport(book) {
  const status = String(book?.generation?.status || "").toLowerCase();

  if (["queued", "generating", "cancelling"].includes(status)) {
    throw buildHttpError(
      409,
      "Book generation is not complete yet. Poll the generation job before downloading."
    );
  }

  if (["failed", "cancelled"].includes(status)) {
    throw buildHttpError(
      409,
      "Book generation did not complete successfully. Retry the generation job before downloading."
    );
  }
}

async function sendBookPdf(res, book) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${safeExportFilename(book.title, "pdf")}"`
  );
  res.setHeader("Content-Transfer-Encoding", "binary");
  setNoStoreHeaders(res);

  await generatePdf(book, res);
}

async function sendBookEpub(res, book) {
  const epubBuffer = await generateEpub(book);

  res.setHeader("Content-Type", "application/epub+zip");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${safeExportFilename(book.title, "epub")}"`
  );
  res.setHeader("Content-Length", epubBuffer.length);
  setNoStoreHeaders(res);

  return res.send(epubBuffer);
}

module.exports = {
  assertBookReadyForApiExport,
  prepareOwnedBookForExport,
  safeExportFilename,
  sendBookEpub,
  sendBookPdf,
  setNoStoreHeaders,
};
