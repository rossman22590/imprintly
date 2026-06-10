const mongoose = require("mongoose");

function applyActiveTranslation(book) {
  if (!book) return book;
  
  const translations = book.translations || [];
  const activeTranslation = translations.find(t => t.isActive);
  if (!activeTranslation) {
    return book;
  }

  // Convert to plain object if it is a mongoose document
  const bookObj = typeof book.toObject === "function" ? book.toObject() : book;

  // Swap main fields
  bookObj.title = activeTranslation.title || bookObj.title;
  bookObj.subtitle = activeTranslation.subtitle || bookObj.subtitle;
  bookObj.language = activeTranslation.targetLanguage;
  bookObj.activeTextLanguage = activeTranslation.targetLanguage;

  if (activeTranslation.chapters && activeTranslation.chapters.length > 0) {
    bookObj.chapters = bookObj.chapters.map(ch => {
      const transCh = activeTranslation.chapters.find(
        tc => tc.chapterId.toString() === ch._id.toString()
      );
      if (transCh && transCh.translationStatus === "complete") {
        return {
          ...ch,
          title: transCh.title || ch.title,
          content: transCh.content || ch.content,
        };
      }
      return ch;
    });
  }

  if (activeTranslation.audiobook) {
    bookObj.audiobook = activeTranslation.audiobook;
  }

  return bookObj;
}

module.exports = { applyActiveTranslation };
