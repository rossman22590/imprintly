const test = require("node:test");
const assert = require("node:assert/strict");
const {
  narrationTextFromMarkdown,
  splitTextIntoChunks,
  getModelLimit,
  concatMp3Buffers,
} = require("./elevenlabs.generator");

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

test("splitTextIntoChunks splits on paragraph boundary if possible", () => {
  const text = "Paragraph 1\n\nParagraph 2\n\nParagraph 3";
  const chunks = splitTextIntoChunks(text, 25);
  assert.deepEqual(chunks, [
    "Paragraph 1\n\nParagraph 2",
    "Paragraph 3"
  ]);
});

test("splitTextIntoChunks splits on sentence boundary if paragraph is too long", () => {
  const text = "Sentence one. Sentence two. Sentence three.";
  const chunks = splitTextIntoChunks(text, 28);
  assert.deepEqual(chunks, [
    "Sentence one. Sentence two.",
    "Sentence three."
  ]);
});

test("splitTextIntoChunks splits on word boundary if sentence is too long", () => {
  const text = "WordOne WordTwo WordThree";
  const chunks = splitTextIntoChunks(text, 16);
  assert.deepEqual(chunks, [
    "WordOne WordTwo",
    "WordThree"
  ]);
});

test("splitTextIntoChunks hard cuts a single word if it is longer than limit", () => {
  const text = "Supercalifragilisticexpialidocious";
  const chunks = splitTextIntoChunks(text, 10);
  assert.deepEqual(chunks, [
    "Supercalif",
    "ragilistic",
    "expialidoc",
    "ious"
  ]);
});

test("getModelLimit resolves standard model limits", async () => {
  assert.equal(await getModelLimit("eleven_v3"), 5000);
  assert.equal(await getModelLimit("eleven_flash_v2_5"), 40000);
  assert.equal(await getModelLimit("eleven_multilingual_v2"), 10000);
});

test("getModelLimit falls back for unknown models", async () => {
  assert.equal(await getModelLimit("unknown_model_name"), 5000);
});

test("concatMp3Buffers merges multiple MP3 buffers using ffmpeg", async () => {
  const base64 = "SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU2LjM2LjEwMAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV6urq6urq6urq6urq6urq6urq6urq6urq6v////////////////////////////////8AAAAATGF2YzU2LjQxAAAAAAAAAAAAAAAAJAAAAAAAAAAAASDs90hvAAAAAAAAAAAAAAAAAAAA//MUZAAAAAGkAAAAAAAAA0gAAAAATEFN//MUZAMAAAGkAAAAAAAAA0gAAAAARTMu//MUZAYAAAGkAAAAAAAAA0gAAAAAOTku//MUZAkAAAGkAAAAAAAAA0gAAAAANVVV";
  const buffer = Buffer.from(base64, "base64");
  const combined = await concatMp3Buffers([buffer, buffer]);

  assert.ok(Buffer.isBuffer(combined));
  assert.ok(combined.length > 0);

  const mm = require("music-metadata");
  const metadata = await mm.parseBuffer(combined);
  assert.ok(metadata.format.container === "MPEG" || metadata.format.codec === "MPEG");
});

