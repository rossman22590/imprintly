const MAX_LEFT_PAGE_TEXT_WORDS = 90;

function isPageHeading(line = "", side = "") {
  const sidePattern = side ? `${side}\\s+` : "(?:left|right)\\s+";
  return new RegExp(`^\\s*#{1,6}\\s*${sidePattern}page\\b`, "i").test(line);
}

function isHorizontalRule(line = "") {
  return /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line);
}

function isMarkdownImageLine(line = "") {
  return /^\s*!\[[^\]]*\]\([^)]*\)\s*$/.test(line);
}

function trimEmptyLines(lines = []) {
  const next = [...lines];

  while (next.length > 0 && !next[0].trim()) next.shift();
  while (next.length > 0 && !next.at(-1).trim()) next.pop();

  return next;
}

function normalizeStoryLines(lines = []) {
  return trimEmptyLines(
    lines.filter(
      (line) =>
        !isPageHeading(line) &&
        !isHorizontalRule(line) &&
        !isMarkdownImageLine(line)
    )
  )
    .join("\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function countWords(text = "") {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length;
}

function countSentences(text = "") {
  return (String(text || "").match(/[.!?]+(?=\s|$)/g) || []).length;
}

function isLikelyProductionText(text = "") {
  return /\b(?:art direction|image prompt|illustration prompt|camera angle|composition|foreground|background|depict|render|drawn|visual description)\b/i.test(
    text
  );
}

function getShortLeftPageText(lines = []) {
  const text = normalizeStoryLines(lines);

  if (!text) return "";
  if (countWords(text) > MAX_LEFT_PAGE_TEXT_WORDS) return "";
  if (countWords(text) > 35 && countSentences(text) < 2) return "";
  if (isLikelyProductionText(text)) return "";

  return text;
}

function extractChildrenSpreadParts(content = "") {
  const lines = String(content || "").replace(/\r\n/g, "\n").split("\n");
  const leftPageIndex = lines.findIndex((line) => isPageHeading(line, "left"));
  const rightPageIndex = lines.findIndex((line) => isPageHeading(line, "right"));

  if (rightPageIndex >= 0) {
    const leftText =
      leftPageIndex >= 0 && leftPageIndex < rightPageIndex
        ? getShortLeftPageText(lines.slice(leftPageIndex + 1, rightPageIndex))
        : "";

    return {
      leftText,
      rightText: normalizeStoryLines(lines.slice(rightPageIndex + 1)),
    };
  }

  if (leftPageIndex >= 0) {
    const leftSectionEnd = lines.findIndex(
      (line, index) => index > leftPageIndex && isHorizontalRule(line)
    );
    const endIndex = leftSectionEnd >= 0 ? leftSectionEnd : lines.length;

    return {
      leftText: getShortLeftPageText(lines.slice(leftPageIndex + 1, endIndex)),
      rightText: normalizeStoryLines(lines.slice(endIndex + 1)),
    };
  }

  return {
    leftText: "",
    rightText: normalizeStoryLines(lines),
  };
}

function extractChildrenSpreadStoryText(content = "") {
  const parts = extractChildrenSpreadParts(content);

  return parts.rightText || parts.leftText;
}

function sanitizeChildrenSpreadManuscript(content = "") {
  const { leftText, rightText } = extractChildrenSpreadParts(content);
  const storyText = [leftText, rightText].filter(Boolean).join("\n\n");

  return storyText || String(content || "").trim();
}

module.exports = {
  extractChildrenSpreadParts,
  extractChildrenSpreadStoryText,
  sanitizeChildrenSpreadManuscript,
};
