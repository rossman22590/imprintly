const {
  getBookTypeFamily,
  getBookTypeImageGuidance,
} = require("./book-type-guidance");

function cleanCoverText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function isGenericGenreSubtitle(value = "") {
  const normalized = cleanCoverText(value)
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, " ");

  if (!normalized) return true;

  return /^(a |an |the )?(novel|fiction|fantasy|fantasy novel|science fiction|science fiction novel|sci fi|sci fi novel|romance|romance novel|thriller|thriller novel|mystery|mystery novel|horror|horror novel|young adult|young adult novel|ya|ya novel|nonfiction|non fiction|ebook|book)$/.test(
    normalized
  );
}

function getVisibleSubtitle(subtitle = "") {
  const cleanSubtitle = cleanCoverText(subtitle);

  return isGenericGenreSubtitle(cleanSubtitle) ? "" : cleanSubtitle;
}

function buildCoverTextRules(book = {}) {
  const title = cleanCoverText(book.title);
  const subtitle = getVisibleSubtitle(book.subtitle);
  const author = cleanCoverText(book.author);
  const allowedText = [
    `- Title: "${title}"`,
    subtitle
      ? `- Subtitle: "${subtitle}"`
      : "- Subtitle: none. Do not invent a subtitle or add a genre label.",
    `- Author: "${author}"`,
  ].join("\n");

  return `Allowed visible cover text:
${allowedText}

Typography rules:
- The cover may render only the exact allowed visible text above.
- Do not add any other words, labels, captions, stickers, badges, taglines, metadata, book type, genre, audience, provider names, or prompt labels.
- Do not print words like "Fantasy", "Novel", "Fantasy Novel", "Fiction", "Book", "Ebook", "Guide", or "Adult readers" unless those exact words appear inside the allowed title, subtitle, or author text above.
- Treat all style/category/audience notes below as hidden creative context, never as cover typography.`;
}

function buildEbookCoverPrompt({ book, customPrompt = "" }) {
  const coverDirection = customPrompt
    ? `Creative direction from the author: ${customPrompt}`
    : "Creative direction: premium contemporary publishing cover, memorable first-glance composition, polished commercial finish.";
  const bookTypeGuidance = getBookTypeImageGuidance(book.genre);
  const category = getBookTypeFamily(book.genre);
  const textRules = buildCoverTextRules(book);

  return `Create a professional ebook front cover image.

${textRules}

Hidden creative context, not cover text:
- Book category for visual style only: ${category}
- Audience for design taste only: ${book.audience || "General readers"}
${bookTypeGuidance}
Visual Bible references: When character, style, or world reference images are provided, they are mandatory visual canon for the cover's people, setting, mood, and art direction. Do not ignore, contradict, or replace supplied references.
${coverDirection}

Requirements:
1. Front cover only, not a 3D mockup, not a spread, and no spine.
2. Follow the allowed visible cover text list exactly.
3. Do not render the hidden creative context as words on the cover.
4. Use readable, intentional typography with strong hierarchy and safe margins.
5. Match the visual category and audience while avoiding generic stock-photo styling.`;
}

function buildEbookCoverEditPrompt({ book, customPrompt = "" }) {
  const editDirection = customPrompt
    ? `Requested edits from the author: ${customPrompt}`
    : "Requested edits: improve the current cover's composition, typography, contrast, and publishing polish while preserving its core concept.";
  const bookTypeGuidance = getBookTypeImageGuidance(book.genre);
  const category = getBookTypeFamily(book.genre);
  const textRules = buildCoverTextRules(book);

  return `Edit the provided ebook front cover image.

${textRules}

Hidden creative context, not cover text:
- Book category for visual style only: ${category}
- Audience for design taste only: ${book.audience || "General readers"}
${bookTypeGuidance}
Visual Bible references: When character, style, or world reference images are provided, they are mandatory visual canon while editing the cover. Preserve supplied character identities and style cues unless the author explicitly asks otherwise.
${editDirection}

Requirements:
1. Keep it as a front cover only, not a 3D mockup, not a spread, and no spine.
2. Preserve or correct typography so it contains only the allowed visible cover text.
3. Remove any accidental genre labels, metadata labels, prompt labels, or extra words from the cover.
4. Improve the current cover rather than creating an unrelated concept.
5. Keep typography readable with strong hierarchy and safe margins.`;
}

module.exports = {
  buildEbookCoverPrompt,
  buildEbookCoverEditPrompt,
  buildCoverTextRules,
  getVisibleSubtitle,
};
