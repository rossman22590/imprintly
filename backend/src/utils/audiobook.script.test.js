const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildDefaultChapterScript,
  resolveChapterNarrationText,
  resolveChapterScript,
} = require("./audiobook.script");

test("buildDefaultChapterScript formats chapter number, title, and body", () => {
  const script = buildDefaultChapterScript(
    {
      title: "The Hidden Door",
      content: "# The Hidden Door\n\nThe rain started before dawn.",
    },
    0
  );

  assert.match(script, /^Chapter 1\nThe Hidden Door\n\n/);
  assert.match(script, /The rain started before dawn\./);
});

test("resolveChapterScript prefers saved audiobook script", () => {
  const book = {
    chapters: [{ title: "Original", content: "Body text." }],
    audiobook: {
      chapters: [{ chapterIndex: 0, script: "Chapter 1\nCustom Title\n\nCustom body." }],
    },
  };

  assert.equal(
    resolveChapterScript(book, 0),
    "Chapter 1\nCustom Title\n\nCustom body."
  );
});

test("resolveChapterNarrationText strips markdown from script", () => {
  const book = {
    chapters: [{ title: "Test", content: "Plain chapter body." }],
    audiobook: { chapters: [] },
  };

  const text = resolveChapterNarrationText(book, 0);
  assert.match(text, /^Chapter 1\nTest\n\nPlain chapter body\.$/);
});

test("stripNonNarratableSections removes AI prompt appendices", () => {
  const { stripNonNarratableSections, buildDefaultChapterScript } = require("./audiobook.script");

  const cleaned = stripNonNarratableSections(
    "Opening scene.\n\n## AI Cover Prompt\n\nA dramatic sunset cover.\n\n## AI Image Prompt – Book Cover\n\nMore prompt text."
  );

  assert.equal(cleaned, "Opening scene.");
  assert.equal(
    buildDefaultChapterScript(
      {
        title: "Market Signals",
        content:
          "Real chapter body.\n\n## AI Cover Prompt\n\nCover art instructions.",
      },
      1
    ),
    "Chapter 2\nMarket Signals\n\nReal chapter body."
  );
});
