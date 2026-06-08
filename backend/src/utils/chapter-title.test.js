const test = require("node:test");
const assert = require("node:assert/strict");
const {
  applyChapterTitleGenerationToRequirements,
  isPlaceholderChapterTitle,
  resolvePlaceholderChapterTitle,
  splitGeneratedChapterTitleFromContent,
} = require("./chapter-title");

test("isPlaceholderChapterTitle detects default chapter labels", () => {
  assert.equal(isPlaceholderChapterTitle("Chapter 1", 0), true);
  assert.equal(isPlaceholderChapterTitle("Chapter 3", 2), true);
  assert.equal(isPlaceholderChapterTitle("Scene 2", 1, "Children"), true);
  assert.equal(isPlaceholderChapterTitle("The Hidden Door", 0), false);
  assert.equal(isPlaceholderChapterTitle("", 0), true);
});

test("splitGeneratedChapterTitleFromContent extracts leading H1", () => {
  const split = splitGeneratedChapterTitleFromContent(
    "# The Hidden Door\n\nThe rain started before dawn."
  );

  assert.equal(split.title, "The Hidden Door");
  assert.equal(split.content, "The rain started before dawn.");
});

test("splitGeneratedChapterTitleFromContent strips chapter prefixes", () => {
  const split = splitGeneratedChapterTitleFromContent(
    "# Chapter 2: The Hidden Door\n\nBody text."
  );

  assert.equal(split.title, "The Hidden Door");
  assert.equal(split.content, "Body text.");
});

test("resolvePlaceholderChapterTitle updates placeholder titles only", () => {
  const resolved = resolvePlaceholderChapterTitle({
    content: "# Market Signals\n\nOpening paragraph.",
    currentTitle: "Chapter 4",
    chapterIndex: 3,
    genre: "Nonfiction",
  });

  assert.equal(resolved.titleGenerated, true);
  assert.equal(resolved.chapterTitle, "Market Signals");
  assert.equal(resolved.content, "Opening paragraph.");

  const unchanged = resolvePlaceholderChapterTitle({
    content: "# Ignored\n\nBody.",
    currentTitle: "Custom Title",
    chapterIndex: 0,
    genre: "Nonfiction",
  });

  assert.equal(unchanged.titleGenerated, false);
  assert.equal(unchanged.chapterTitle, "Custom Title");
});

test("applyChapterTitleGenerationToRequirements prepends title guidance", () => {
  const updated = applyChapterTitleGenerationToRequirements(
    "1. Use markdown.\n2. Start with chapter content, not a repeated title page.",
    true
  );

  assert.match(updated, /temporary placeholder/i);
  assert.match(updated, /After the H1 title line/i);
});
