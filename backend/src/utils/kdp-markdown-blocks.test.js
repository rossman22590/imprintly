const test = require("node:test");
const assert = require("node:assert/strict");
const {
  parseKdpMarkdownBlocks,
  splitKdpMarkdownIntoPages,
} = require("./kdp-markdown-blocks");

test("parseKdpMarkdownBlocks keeps fenced diagrams as atomic blocks", () => {
  const markdown = [
    "Intro paragraph.",
    "",
    "```text",
    "Star Muffin Flow",
    "Mix batter",
    "  ↓",
    "Bake muffins",
    "```",
    "",
    "Closing paragraph.",
  ].join("\n");

  const blocks = parseKdpMarkdownBlocks(markdown);

  assert.equal(blocks.length, 3);
  assert.equal(blocks[0].type, "paragraph");
  assert.equal(blocks[1].type, "fence");
  assert.match(blocks[1].content, /Star Muffin Flow/);
  assert.equal(blocks[2].type, "paragraph");
});

test("mergeLabelParagraphsIntoDiagrams attaches short labels to following fences", () => {
  const markdown = [
    "Intro paragraph.",
    "",
    "Bakery Process",
    "",
    "```text",
    "Title: Star Muffin Flow",
    "Gather moon flour",
    "```",
  ].join("\n");

  const blocks = parseKdpMarkdownBlocks(markdown);

  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].type, "paragraph");
  assert.equal(blocks[1].type, "fence");
  assert.equal(blocks[1].label, "Bakery Process");
});

test("splitKdpMarkdownIntoPages preserves diagram blocks across pagination", () => {
  const markdown = [
    "A".repeat(1800),
    "",
    "```text",
    "Node A",
    "  ↓",
    "Node B",
    "```",
  ].join("\n");

  const textMetrics = {
    charsPerLine: 54,
    linesPerPage: 12,
    wordsPerPage: 110,
    lineWidthPoints: 300,
    fontSize: 11,
    paragraphIndentPoints: 14,
  };
  const estimateTextLines = (text) =>
    Math.max(1, Math.ceil(String(text || "").length / 54));

  const pages = splitKdpMarkdownIntoPages(
    markdown,
    textMetrics,
    { firstPageReserveLines: 0 },
    estimateTextLines
  );

  const diagramPages = pages.filter((page) =>
    page.blocks.some((block) => block.type === "diagram")
  );

  assert.ok(diagramPages.length >= 1);
  assert.equal(
    diagramPages[0].blocks.find((block) => block.type === "diagram").content,
    ["Node A", "  ↓", "Node B"].join("\n")
  );
});
