export function normalizeBook(book) {
  if (!book || typeof book !== "object") {
    return null;
  }

  const bible = book.bible && typeof book.bible === "object" ? book.bible : {};
  const visualBible =
    book.visualBible && typeof book.visualBible === "object"
      ? book.visualBible
      : {};

  return {
    ...book,
    chapters: Array.isArray(book.chapters) ? book.chapters : [],
    communityListing: {
      isListed: Boolean(book.communityListing?.isListed),
      listedAt: book.communityListing?.listedAt || null,
      purchaseUrl: book.communityListing?.purchaseUrl || "",
      freeFullPdfEnabled: Boolean(
        book.communityListing?.freeFullPdfEnabled
      ),
      freeFullPdfEnabledAt:
        book.communityListing?.freeFullPdfEnabledAt || null,
    },
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
    visualBible: {
      enabled: visualBible.enabled !== false,
      matchBookStyle: visualBible.matchBookStyle !== false,
      characters: Array.isArray(visualBible.characters)
        ? visualBible.characters
        : [],
      styleReferences: Array.isArray(visualBible.styleReferences)
        ? visualBible.styleReferences
        : [],
      worldReferences: Array.isArray(visualBible.worldReferences)
        ? visualBible.worldReferences
        : [],
      notes: visualBible.notes || "",
      updatedAt: visualBible.updatedAt || null,
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
