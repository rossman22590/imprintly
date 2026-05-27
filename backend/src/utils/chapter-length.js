const CHAPTER_LENGTHS = {
  small: {
    label: "Small",
    target: "1,000-1,600 words",
    pages: "about 4-6 ebook pages",
    detail:
      "Keep it focused, complete, and useful without rushing core ideas.",
  },
  medium: {
    label: "Medium",
    target: "2,000-3,000 words",
    pages: "about 8-12 ebook pages",
    detail:
      "Develop the topic with layered explanation, examples, implications, and smooth transitions.",
  },
  large: {
    label: "Large",
    target: "3,500-5,000 words",
    pages: "about 14-20 ebook pages",
    detail:
      "Write a deep, premium chapter with rich context, concrete examples, edge cases, practical takeaways, and narrative momentum. Do not pad or repeat.",
  },
};

const FICTION_CHAPTER_LENGTH_DETAILS = {
  small:
    "Keep the scene focused, complete, and dramatic without rushing the emotional turn.",
  medium:
    "Develop the chapter through layered scenes, escalating pressure, dialogue, interiority, atmosphere, and smooth transitions.",
  large:
    "Write a deep, premium novel chapter with rich scene work, emotional turns, subtext, complications, and narrative momentum. Do not pad or repeat.",
};

function normalizeChapterLength(value = "medium") {
  const normalized = String(value || "medium").trim().toLowerCase();

  return Object.hasOwn(CHAPTER_LENGTHS, normalized) ? normalized : "medium";
}

function getChapterLengthInstruction(value = "medium", options = {}) {
  const chapterLength = normalizeChapterLength(value);
  const config = CHAPTER_LENGTHS[chapterLength];
  const isFiction = options.mode === "fiction" || options.family === "fiction";
  const detail = isFiction
    ? FICTION_CHAPTER_LENGTH_DETAILS[chapterLength]
    : config.detail;
  const substanceRule = isFiction
    ? "Prioritize substance over filler: add sensory specificity, scene consequences, character choices, tension, emotional subtext, and connective tissue that makes the story feel cohesive."
    : "Prioritize substance over filler: add specificity, scenes or examples where appropriate, consequences, caveats, and connective tissue that makes the book feel cohesive.";

  return [
    `Chapter length: ${config.label}. Aim for ${config.target}, ${config.pages}.`,
    detail,
    substanceRule,
  ].join(" ");
}

module.exports = {
  CHAPTER_LENGTHS,
  getChapterLengthInstruction,
  normalizeChapterLength,
};
