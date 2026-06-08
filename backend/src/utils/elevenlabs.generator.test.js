const test = require("node:test");
const assert = require("node:assert/strict");
const { narrationTextFromMarkdown } = require("./elevenlabs.generator");

test("narrationTextFromMarkdown strips markdown headers", () => {
  const input = "# Title\n## Subtitle\nSome text here.";
  const expected = "Title\nSubtitle\nSome text here.";
  assert.equal(narrationTextFromMarkdown(input), expected);
});

test("narrationTextFromMarkdown strips bold, italic, and strikethrough", () => {
  const input = "This is **bold** and *italic* and ~~strikethrough~~ text.";
  const expected = "This is bold and italic and strikethrough text.";
  assert.equal(narrationTextFromMarkdown(input), expected);
});

test("narrationTextFromMarkdown strips inline code and code blocks", () => {
  const input = "Use the `foo` function.\n```js\nconst x = 1;\n```\nDone.";
  const expected = "Use the foo function.\n\nDone.";
  assert.equal(narrationTextFromMarkdown(input), expected);
});

test("narrationTextFromMarkdown strips links and images", () => {
  const input = "Here is a [link to Google](https://google.com) and an image ![Logo](logo.png).";
  const expected = "Here is a link to Google and an image .";
  assert.equal(narrationTextFromMarkdown(input), expected);
});

test("narrationTextFromMarkdown strips blockquotes and horizontal rules", () => {
  const input = "> Blockquote text\n---\nNext section.";
  const expected = "Blockquote text\n\nNext section.";
  assert.equal(narrationTextFromMarkdown(input), expected);
});

test("narrationTextFromMarkdown normalizes newlines", () => {
  const input = "Paragraph 1\r\n\r\n\r\nParagraph 2";
  const expected = "Paragraph 1\n\nParagraph 2";
  assert.equal(narrationTextFromMarkdown(input), expected);
});
