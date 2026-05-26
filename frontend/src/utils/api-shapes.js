export function normalizeBook(book) {
  if (!book || typeof book !== "object") {
    return null;
  }

  return {
    ...book,
    chapters: Array.isArray(book.chapters) ? book.chapters : [],
  };
}

export function normalizeBooks(books) {
  if (!Array.isArray(books)) {
    return [];
  }

  return books
    .map((book) => normalizeBook(book))
    .filter((book) => Boolean(book));
}
