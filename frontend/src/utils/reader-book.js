export function isSourceDocumentOnlyBook(book = {}) {
  const sourceFiles = Array.isArray(book.sourceFiles) ? book.sourceFiles : [];

  if (!sourceFiles.length) return false;

  const chapters = Array.isArray(book.chapters) ? book.chapters : [];
  const hasReadableContent = chapters.some((chapter) =>
    String(chapter?.content || "").trim()
  );

  return !hasReadableContent;
}

export function filterLibraryBooks(books = []) {
  if (!Array.isArray(books)) return [];

  return books.filter((book) => !isSourceDocumentOnlyBook(book));
}

export function normalizeBookForReader(book = {}) {
  if (!book || typeof book !== "object") return book;

  return {
    ...book,
    sourceFiles: [],
    chapters: Array.isArray(book.chapters) ? book.chapters : [],
  };
}
