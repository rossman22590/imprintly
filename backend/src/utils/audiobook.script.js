const Book = require("../models/Book");
const { narrationTextFromMarkdown } = require("./elevenlabs.generator");

function getAudiobookChapterEntry(audiobook = {}, chapterIndex = 0) {
  return (audiobook.chapters || []).find(
    (entry) => entry.chapterIndex === chapterIndex
  );
}

const NON_NARRATABLE_SECTION_HEADINGS = [
  /^ai cover prompt\b/i,
  /^ai image prompt(?:\s*[–-]\s*book cover)?\b/i,
  /^ai consistency notes\b/i,
  /^ai source warnings\b/i,
  /^cover prompt\b/i,
];

function isNonNarratableSectionHeading(line = "") {
  const cleaned = String(line || "")
    .replace(/^#{1,6}\s+/, "")
    .trim();

  if (!cleaned) return false;

  return NON_NARRATABLE_SECTION_HEADINGS.some((pattern) => pattern.test(cleaned));
}

function stripNonNarratableSections(text = "") {
  const lines = String(text || "").split(/\r?\n/);
  const kept = [];
  let skipping = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (isNonNarratableSectionHeading(trimmed)) {
      skipping = true;
      continue;
    }

    if (/^#{1,6}\s+/.test(trimmed)) {
      skipping = false;
    }

    if (!skipping) {
      kept.push(line);
    }
  }

  return kept
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildDefaultChapterScript(chapter = {}, chapterIndex = 0) {
  const chapterNumber = chapterIndex + 1;
  const title = chapter.title?.trim() || `Chapter ${chapterNumber}`;
  const body = narrationTextFromMarkdown(
    stripNonNarratableSections(chapter.content || "")
  );

  if (!body) return "";

  return `Chapter ${chapterNumber}\n${title}\n\n${body}`;
}

function resolveChapterScript(book = {}, chapterIndex = 0) {
  const chapter = book.chapters?.[chapterIndex];
  if (!chapter) return "";

  const savedScript = getAudiobookChapterEntry(
    book.audiobook,
    chapterIndex
  )?.script?.trim();

  if (savedScript) return savedScript;

  return buildDefaultChapterScript(chapter, chapterIndex);
}

function resolveChapterNarrationText(book = {}, chapterIndex = 0) {
  const script = resolveChapterScript(book, chapterIndex);
  if (!script) return "";

  return narrationTextFromMarkdown(stripNonNarratableSections(script));
}

function buildChapterScriptsForBook(book = {}) {
  return (book.chapters || []).map((chapter, chapterIndex) => {
    const entry = getAudiobookChapterEntry(book.audiobook, chapterIndex);

    return {
      chapterIndex,
      title: chapter.title?.trim() || `Chapter ${chapterIndex + 1}`,
      script: stripNonNarratableSections(resolveChapterScript(book, chapterIndex)),
      hasCustomScript: Boolean(entry?.script?.trim()),
    };
  });
}

async function upsertChapterScript(bookId, chapterIndex, title, script) {
  const book = await Book.findById(bookId);
  if (!book) {
    const error = new Error("Book not found.");
    error.statusCode = 404;
    throw error;
  }

  const chapter = book.chapters?.[chapterIndex];
  if (!chapter) {
    const error = new Error("Chapter not found.");
    error.statusCode = 404;
    throw error;
  }

  const cleanScript = String(script || "").trim();
  const chapterTitle =
    title?.trim() || chapter.title?.trim() || `Chapter ${chapterIndex + 1}`;
  const existing = getAudiobookChapterEntry(book.audiobook, chapterIndex);

  if (existing) {
    await Book.updateOne(
      { _id: bookId, "audiobook.chapters.chapterIndex": chapterIndex },
      {
        $set: {
          "audiobook.chapters.$.script": cleanScript,
          "audiobook.chapters.$.title": chapterTitle,
          "audiobook.chapters.$.updatedAt": new Date(),
        },
      }
    );
    return Book.findById(bookId);
  }

  await Book.updateOne(
    { _id: bookId },
    {
      $push: {
        "audiobook.chapters": {
          chapterIndex,
          title: chapterTitle,
          script: cleanScript,
          audioUrl: "",
          duration: 0,
          charCount: 0,
          activeVersionId: "",
          versions: [],
          status: "empty",
          error: "",
          updatedAt: new Date(),
        },
      },
    }
  );

  return Book.findById(bookId);
}

module.exports = {
  buildChapterScriptsForBook,
  buildDefaultChapterScript,
  getAudiobookChapterEntry,
  isNonNarratableSectionHeading,
  resolveChapterNarrationText,
  resolveChapterScript,
  stripNonNarratableSections,
  upsertChapterScript,
};
