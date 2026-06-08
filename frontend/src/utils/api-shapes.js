export function normalizeBook(book) {
  if (!book || typeof book !== "object") {
    return null;
  }

  const bible = book.bible && typeof book.bible === "object" ? book.bible : {};
  const visualBible =
    book.visualBible && typeof book.visualBible === "object"
      ? book.visualBible
      : {};
  const audiobook =
    book.audiobook && typeof book.audiobook === "object" ? book.audiobook : {};
  const audiobookIntro =
    audiobook.intro && typeof audiobook.intro === "object"
      ? audiobook.intro
      : {};

  return {
    ...book,
    chapters: Array.isArray(book.chapters) ? book.chapters : [],
    audiobook: {
      voiceId: audiobook.voiceId || "",
      voiceName: audiobook.voiceName || "",
      modelId: audiobook.modelId || "",
      status: audiobook.status || "empty",
      jobId: audiobook.jobId || "",
      progress: audiobook.progress || null,
      intro: {
        mode: audiobookIntro.mode || "none",
        script: audiobookIntro.script || "",
        audioUrl: audiobookIntro.audioUrl || "",
        duration: audiobookIntro.duration || 0,
        charCount: audiobookIntro.charCount || 0,
        updatedAt: audiobookIntro.updatedAt || null,
      },
      chapters: Array.isArray(audiobook.chapters) ? audiobook.chapters : [],
      totalDuration: audiobook.totalDuration || 0,
      lastGeneratedAt: audiobook.lastGeneratedAt || null,
    },
    communityListing: {
      isListed: Boolean(book.communityListing?.isListed),
      listedAt: book.communityListing?.listedAt || null,
      purchaseUrl: book.communityListing?.purchaseUrl || "",
      freeFullPdfEnabled: Boolean(book.communityListing?.freeFullPdfEnabled),
      freeFullPdfEnabledAt:
        book.communityListing?.freeFullPdfEnabledAt || null,
    },
    sourceFiles: Array.isArray(book.sourceFiles) ? book.sourceFiles : [],
    bible: {
      source: bible.source || "",
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
