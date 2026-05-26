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

function normalizeChapterLength(value = "medium") {
  const normalized = String(value || "medium").trim().toLowerCase();

  return Object.hasOwn(CHAPTER_LENGTHS, normalized) ? normalized : "medium";
}

function getChapterLengthInstruction(value = "medium") {
  const chapterLength = normalizeChapterLength(value);
  const config = CHAPTER_LENGTHS[chapterLength];

  return [
    `Chapter length: ${config.label}. Aim for ${config.target}, ${config.pages}.`,
    config.detail,
    "Prioritize substance over filler: add specificity, scenes or examples where appropriate, consequences, caveats, and connective tissue that makes the book feel cohesive.",
  ].join(" ");
}

module.exports = {
  CHAPTER_LENGTHS,
  getChapterLengthInstruction,
  normalizeChapterLength,
};
