const { getBookTypeFamily } = require("./book-type-guidance");

function normalizeChapterTitle(title = "") {
  return String(title || "").trim().replace(/\s+/g, " ");
}

function isPlaceholderChapterTitle(title = "", chapterIndex = 0, genre = "") {
  const normalized = normalizeChapterTitle(title);
  if (!normalized) return true;
  if (/^untitled$/i.test(normalized)) return true;

  const chapterNumber = Number(chapterIndex) + 1;
  const family = getBookTypeFamily(genre);
  const numberedLabel =
    family === "children" ? `scene ${chapterNumber}` : `chapter ${chapterNumber}`;

  if (normalized.toLowerCase() === numberedLabel) return true;
  if (/^chapter\s+\d+$/i.test(normalized)) return true;
  if (/^scene\s+\d+$/i.test(normalized)) return true;

  return false;
}

function getChapterTitleGenerationRequirement() {
  return [
    "The chapter title is a temporary placeholder.",
    "Begin your response with exactly one markdown H1 line containing ONLY the final evocative chapter title.",
    "Do not prefix the title with 'Chapter N', 'Scene N', or the book title.",
    "After the H1 line, add one blank line, then write the chapter body.",
    "The H1 is metadata only and will be removed from the published chapter body.",
  ].join(" ");
}

function applyChapterTitleGenerationToRequirements(
  requirements = "",
  generateChapterTitle = false
) {
  if (!generateChapterTitle) return requirements;

  const modified = String(requirements || "")
    .replace(
      /2\. Start with the chapter scene\/prose immediately[^\n]*/i,
      "2. After the H1 title line and blank line, start the chapter scene/prose immediately without repeating the title."
    )
    .replace(
      /2\. Start with the story text immediately[^\n]*/i,
      "2. After the H1 title line and blank line, start the story text immediately without repeating the title."
    )
    .replace(
      /2\. Start with chapter content[^\n]*/i,
      "2. After the H1 title line and blank line, start the chapter content without repeating the title."
    )
    .replace(
      /2\. Start with the chapter content[^\n]*/i,
      "2. After the H1 title line and blank line, start the chapter content without repeating the title."
    );

  return `${getChapterTitleGenerationRequirement()}\n${modified}`;
}

function cleanExtractedChapterTitle(title = "") {
  let cleaned = normalizeChapterTitle(title);
  cleaned = cleaned.replace(
    /^(?:chapter|scene)\s+\d+\s*[:\-\u2013\u2014]\s*/i,
    ""
  );
  cleaned = cleaned.replace(/^(?:chapter|scene)\s+\d+$/i, "").trim();
  return cleaned;
}

function splitGeneratedChapterTitleFromContent(content = "") {
  const trimmed = String(content || "").trim();
  const match = trimmed.match(/^#\s+(.+?)\s*(?:\r?\n\r?\n|\r?\n)/);

  if (!match) {
    return { title: null, content: trimmed };
  }

  const title = cleanExtractedChapterTitle(match[1]);

  if (!title || title.length < 2 || title.length > 200) {
    return { title: null, content: trimmed };
  }

  return {
    title,
    content: trimmed.slice(match[0].length).trim(),
  };
}

function resolvePlaceholderChapterTitle({
  content = "",
  currentTitle = "",
  chapterIndex = 0,
  genre = "",
}) {
  if (!isPlaceholderChapterTitle(currentTitle, chapterIndex, genre)) {
    return {
      content,
      chapterTitle: normalizeChapterTitle(currentTitle),
      titleGenerated: false,
    };
  }

  const split = splitGeneratedChapterTitleFromContent(content);

  if (!split.title) {
    return {
      content,
      chapterTitle: normalizeChapterTitle(currentTitle),
      titleGenerated: false,
    };
  }

  return {
    content: split.content,
    chapterTitle: split.title,
    titleGenerated: true,
  };
}

module.exports = {
  applyChapterTitleGenerationToRequirements,
  cleanExtractedChapterTitle,
  getChapterTitleGenerationRequirement,
  isPlaceholderChapterTitle,
  resolvePlaceholderChapterTitle,
  splitGeneratedChapterTitleFromContent,
};
