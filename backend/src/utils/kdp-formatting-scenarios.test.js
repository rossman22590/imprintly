const test = require("node:test");
const assert = require("node:assert/strict");
const {
  isDedicatedDiagramFence,
  parseKdpMarkdownBlocks,
  splitKdpMarkdownIntoPages,
} = require("./kdp-markdown-blocks");

const textMetrics = {
  charsPerLine: 54,
  linesPerPage: 14,
  wordsPerPage: 110,
  lineWidthPoints: 300,
  fontSize: 11,
  paragraphIndentPoints: 14,
};
const estimateTextLines = (text) =>
  Math.max(1, Math.ceil(String(text || "").length / 54));

const formattingScenarios = [
  {
    name: "ATX headings h1-h3",
    markdown: "# Title\n\n## Section\n\n### Subsection\n\nBody text.",
    assertBlocks(blocks) {
      assert.equal(blocks[0].type, "heading");
      assert.equal(blocks[0].level, 1);
      assert.equal(blocks[1].type, "heading");
      assert.equal(blocks[2].type, "heading");
      assert.equal(blocks[3].type, "paragraph");
    },
  },
  {
    name: "setext headings",
    markdown: "Main Title\n==========\n\nSubtitle\n---------\n\nParagraph.",
    assertBlocks(blocks) {
      assert.equal(blocks[0].type, "heading");
      assert.equal(blocks[0].level, 1);
      assert.equal(blocks[1].type, "heading");
      assert.equal(blocks[1].level, 2);
    },
  },
  {
    name: "unordered list block",
    markdown: "- Alpha\n- Beta\n- Gamma\n\nNext paragraph.",
    assertBlocks(blocks) {
      assert.equal(blocks[0].type, "list");
      assert.equal(blocks[0].ordered, false);
      assert.deepEqual(blocks[0].items, ["Alpha", "Beta", "Gamma"]);
    },
  },
  {
    name: "ordered list block",
    markdown: "1. First\n2. Second\n\nClosing.",
    assertBlocks(blocks) {
      assert.equal(blocks[0].type, "list");
      assert.equal(blocks[0].ordered, true);
      assert.equal(blocks[0].items.length, 2);
    },
  },
  {
    name: "blockquote block",
    markdown: "> Important note.\n> Second line.\n\nBody paragraph.",
    assertBlocks(blocks) {
      assert.equal(blocks[0].type, "blockquote");
      assert.match(blocks[0].text, /Important note/);
      assert.equal(blocks[1].type, "paragraph");
    },
  },
  {
    name: "inline emphasis and links flatten to prose",
    markdown:
      "Read [the guide](https://example.com) with **bold** and _italic_ text.",
    assertBlocks(blocks) {
      assert.equal(blocks.length, 1);
      assert.match(blocks[0].text, /the guide/);
      assert.match(blocks[0].text, /bold/);
      assert.doesNotMatch(blocks[0].text, /https:\/\//);
    },
  },
  {
    name: "image-only paragraph is removed",
    markdown: "Intro.\n\n![Chart](/uploads/chart.png)\n\nOutro.",
    assertBlocks(blocks) {
      assert.equal(blocks.length, 2);
      assert.equal(blocks[0].text, "Intro.");
      assert.equal(blocks[1].text, "Outro.");
    },
  },
  {
    name: "horizontal rules are removed",
    markdown: "Before\n\n***\n\nAfter",
    assertBlocks(blocks) {
      assert.equal(blocks.length, 2);
      assert.equal(blocks[0].text, "Before");
      assert.equal(blocks[1].text, "After");
    },
  },
  {
    name: "prompt fences stay inline code",
    markdown: [
      "Intro.",
      "",
      "```text",
      "System: You are helpful.",
      "Write a summary.",
      "```",
      "",
      "Outro.",
    ].join("\n"),
    assertBlocks(blocks) {
      assert.equal(blocks.filter((block) => block.type === "fence").length, 1);
      assert.equal(isDedicatedDiagramFence("text", blocks[1].content), false);
    },
  },
  {
    name: "markdown tables become structured table blocks",
    markdown: [
      "Intro.",
      "",
      "| Dimension | Traditional | AI Builder |",
      "| :--- | :--- | :--- |",
      "| Skill | Syntax | Systems |",
      "",
      "Outro.",
    ].join("\n"),
    assertBlocks(blocks) {
      const tableBlock = blocks.find((block) => block.type === "table");
      assert.ok(tableBlock);
      assert.equal(tableBlock.header[0], "Dimension");
      assert.equal(tableBlock.rows[0][0], "Skill");
    },
  },
  {
    name: "ascii diagram fences become diagram blocks in pagination",
    markdown: [
      "Intro.",
      "",
      "```text",
      "[ Node A ]",
      "  v",
      "[ Node B ]",
      "```",
      "",
      "Outro.",
    ].join("\n"),
    assertBlocks(blocks) {
      assert.equal(isDedicatedDiagramFence("text", blocks[1].content), true);
      const pages = splitKdpMarkdownIntoPages(
        this.markdown,
        textMetrics,
        { firstPageReserveLines: 0 },
        estimateTextLines
      );
      const diagramBlock = pages
        .flatMap((page) => page.blocks || [])
        .find((block) => block.type === "diagram");

      assert.ok(diagramBlock);
      assert.match(String(diagramBlock.content || ""), /Node A/);
    },
  },
];

formattingScenarios.forEach((scenario) => {
  test(`formatting scenario: ${scenario.name}`, () => {
    const blocks = parseKdpMarkdownBlocks(scenario.markdown);
    scenario.assertBlocks.call(scenario, blocks);
  });
});
