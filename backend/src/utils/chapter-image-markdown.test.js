const assert = require("node:assert/strict");
const test = require("node:test");
const {
  insertImagesThroughoutChapter,
} = require("./chapter-image-markdown");

test("inserts multiple generated images through chapter body", () => {
  const content = [
    "# A Rainy Day",
    "",
    "Mira opened the blue umbrella.",
    "",
    "The puddle flashed like a tiny mirror.",
    "",
    "By sunset, everyone was laughing.",
  ].join("\n");
  const result = insertImagesThroughoutChapter(content, [
    "![Opening](/uploads/ai-image-1.png)",
    "![Middle](/uploads/ai-image-2.png)",
    "![Ending](/uploads/ai-image-3.png)",
  ]);

  assert.match(result, /^# A Rainy Day\n\n!\[Opening\]/);
  assert.match(result, /Mira opened[\s\S]*!\[Middle\]/);
  assert.match(result, /The puddle[\s\S]*!\[Ending\]/);
});

test("replaces leading generated image block when reinserting chapter images", () => {
  const content = [
    "# A Rainy Day",
    "",
    "![Old](/uploads/ai-image-old.png)",
    "",
    "Mira opened the blue umbrella.",
  ].join("\n");
  const result = insertImagesThroughoutChapter(content, [
    "![New](/uploads/ai-image-new.png)",
  ]);

  assert.doesNotMatch(result, /ai-image-old/);
  assert.match(result, /ai-image-new/);
});

test("replaces generated images already distributed through chapter body", () => {
  const content = [
    "# A Rainy Day",
    "",
    "![Old opening](/uploads/ai-image-old-1.png)",
    "",
    "Mira opened the blue umbrella.",
    "",
    "![Old middle](/uploads/ai-image-old-2.png)",
    "",
    "The puddle flashed like a tiny mirror.",
  ].join("\n");
  const result = insertImagesThroughoutChapter(content, [
    "![New opening](/uploads/ai-image-new-1.png)",
    "![New middle](/uploads/ai-image-new-2.png)",
  ]);

  assert.doesNotMatch(result, /ai-image-old/);
  assert.match(result, /ai-image-new-1/);
  assert.match(result, /ai-image-new-2/);
});
