export function normalizeBook(book) {
  if (!book || typeof book !== "object") {
    return null;
  }

  const bible = book.bible && typeof book.bible === "object" ? book.bible : {};

  return {
    ...book,
    chapters: Array.isArray(book.chapters) ? book.chapters : [],
    bible: {
      characters: bible.characters || "",
      locations: bible.locations || "",
      worldRules: bible.worldRules || "",
      timeline: bible.timeline || "",
      styleGuide: bible.styleGuide || "",
      canonFacts: bible.canonFacts || "",
      unresolvedThreads: bible.unresolvedThreads || "",
      notes: bible.notes || "",
      updatedAt: bible.updatedAt || null,
    },
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
