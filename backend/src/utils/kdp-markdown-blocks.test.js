const test = require("node:test");
const assert = require("node:assert/strict");
const {
  estimateDiagramBlockLines,
  isDedicatedDiagramFence,
  parseKdpMarkdownBlocks,
  shouldUseDedicatedDiagramPage,
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

test("splitKdpMarkdownIntoPages fills text before a diagram instead of leaving a short page", () => {
  const diagramLines = Array.from(
    { length: 10 },
    (_, index) => `[ Node ${index + 1} ] -> [ Node ${index + 2} ]`
  );

  const markdown = [
    "Alpha paragraph one.",
    "",
    "Diagram Label",
    "",
    "```text",
    ...diagramLines,
    "```",
    "",
    "Beta paragraph two with enough extra words to continue filling the page after the diagram break.",
  ].join("\n");

  const textMetrics = {
    charsPerLine: 54,
    linesPerPage: 8,
    wordsPerPage: 72,
    lineWidthPoints: 300,
    fontSize: 11,
    paragraphIndentPoints: 14,
  };
  const estimateTextLines = (text) =>
    Math.max(1, Math.ceil(String(text || "").length / 18));

  const pages = splitKdpMarkdownIntoPages(
    markdown,
    textMetrics,
    { firstPageReserveLines: 0 },
    estimateTextLines
  );

  const diagramPageIndex = pages.findIndex((page) =>
    page.blocks.some((block) => block.type === "diagram")
  );
  const pageBeforeDiagram = pages[diagramPageIndex - 1];

  assert.ok(diagramPageIndex > 0);
  assert.ok(pageBeforeDiagram?.blocks?.length > 1);
  assert.match(
    pageBeforeDiagram.blocks.map((block) => block.text).join(" "),
    /Beta paragraph two/
  );
});

test("isDedicatedDiagramFence treats code fences as inline content", () => {
  assert.equal(isDedicatedDiagramFence("javascript", "function test() {}"), false);
  assert.equal(isDedicatedDiagramFence("bash", "node -v"), false);
  assert.equal(
    isDedicatedDiagramFence(
      "text",
      "System: You are an expert assistant.\nPlease write a PRD."
    ),
    false
  );
  assert.equal(
    isDedicatedDiagramFence("text", ["Node A", "  v", "Node B"].join("\n")),
    true
  );
  assert.equal(
    isDedicatedDiagramFence(
      "",
      [
        "Luna, Mariela - Attendance Record (Current)",
        "Luna, Mariela - Transcript (Official)",
        "Luna, Mariela - Health Record (Immunizations)",
        "Luna, Mariela - Incident Report (10/14)",
      ].join("\n")
    ),
    false
  );
});

test("splitKdpMarkdownIntoPages keeps code fences inline on text pages", () => {
  const markdown = [
    "Intro paragraph.",
    "",
    "```javascript",
    "function greet() {",
    '  return "hello";',
    "}",
    "```",
    "",
    "Closing paragraph.",
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
  const codePages = pages.filter((page) =>
    page.blocks.some((block) => block.type === "code")
  );

  assert.equal(diagramPages.length, 0);
  assert.ok(codePages.length >= 1);
});

test("splitKdpMarkdownIntoPages can disable KDP diagram rendering", () => {
  const markdown = [
    "Intro paragraph.",
    "",
    "```text",
    "Node A",
    "  v",
    "Node B",
    "```",
    "",
    "Closing paragraph.",
  ].join("\n");
  const textMetrics = {
    charsPerLine: 54,
    linesPerPage: 18,
    wordsPerPage: 140,
    lineWidthPoints: 300,
    fontSize: 11,
    paragraphIndentPoints: 14,
  };
  const estimateTextLines = (text) =>
    Math.max(1, Math.ceil(String(text || "").length / 54));

  const withDiagrams = splitKdpMarkdownIntoPages(
    markdown,
    textMetrics,
    { firstPageReserveLines: 0, renderDiagrams: true },
    estimateTextLines
  );
  const withoutDiagrams = splitKdpMarkdownIntoPages(
    markdown,
    textMetrics,
    { firstPageReserveLines: 0, renderDiagrams: false },
    estimateTextLines
  );

  assert.ok(
    withDiagrams.some((page) =>
      page.blocks.some((block) => block.type === "diagram")
    )
  );
  assert.equal(
    withoutDiagrams.some((page) =>
      page.blocks.some((block) => block.type === "diagram")
    ),
    false
  );
  assert.ok(
    withoutDiagrams.some((page) =>
      page.blocks.some(
        (block) => block.type === "paragraph" && block.text === "Node A"
      )
    )
  );
});

test("splitKdpMarkdownIntoPages places large diagrams on dedicated pages", () => {
  const diagramLines = Array.from(
    { length: 12 },
    (_, index) => `[ Step ${index + 1} ] -> [ Step ${index + 2} ]`
  );

  const markdown = [
    "Intro paragraph.",
    "",
    "Bakery Process",
    "",
    "```text",
    ...diagramLines,
    "```",
    "",
    "Closing paragraph.",
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

  const diagramPage = pages.find((page) =>
    page.blocks.some((block) => block.type === "diagram")
  );

  assert.ok(diagramPage);
  const diagramBlock = diagramPage.blocks.find(
    (block) => block.type === "diagram"
  );
  assert.ok(diagramBlock);
  assert.equal(diagramBlock.label, "Bakery Process");
});

test("estimateDiagramBlockLines accounts for wrapped inline code", () => {
  const content = ["x".repeat(120), "y".repeat(120), "z".repeat(80)].join("\n");
  const textMetrics = { charsPerLine: 54 };
  const withoutWrap = estimateDiagramBlockLines(content, "javascript");
  const withWrap = estimateDiagramBlockLines(content, "javascript", textMetrics);

  assert.ok(withWrap > withoutWrap);
});

test("parseKdpMarkdownBlocks drops horizontal rule paragraphs", () => {
  const markdown = [
    "Intro paragraph.",
    "",
    "---",
    "",
    "Next paragraph.",
  ].join("\n");

  const blocks = parseKdpMarkdownBlocks(markdown);

  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].text, "Intro paragraph.");
  assert.equal(blocks[1].text, "Next paragraph.");
});

test("splitKdpMarkdownIntoPages packs prose under large diagrams", () => {
  const diagramLines = Array.from(
    { length: 10 },
    (_, index) => `[ Node ${index + 1} ] -> [ Node ${index + 2} ]`
  );

  const markdown = [
    "A".repeat(1200),
    "",
    "```text",
    ...diagramLines,
    "```",
    "",
    "Short leftover paragraph.",
    "",
    "Another paragraph with enough words to absorb the sparse page merge instead of leaving a nearly blank page behind.",
  ].join("\n");

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

  const pages = splitKdpMarkdownIntoPages(
    markdown,
    textMetrics,
    { firstPageReserveLines: 0 },
    estimateTextLines
  );
  const diagramPage = pages.find((page) =>
    page.blocks.some((block) => block.type === "diagram")
  );

  assert.ok(diagramPage);
  assert.ok(
    diagramPage.blocks.some((block) =>
      /Short leftover paragraph/.test(block.text || "")
    ) ||
      pages.some((page) =>
        page.blocks.some((block) =>
          /Short leftover paragraph/.test(block.text || "")
        )
      )
  );
});

test("splitKdpMarkdownIntoPages moves oversized inline code to the next page", () => {
  const markdown = [
    "A".repeat(900),
    "",
    "```javascript",
    "const payload = " + '"x".repeat(140);',
    "console.log(payload);",
    "```",
  ].join("\n");

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

  const pages = splitKdpMarkdownIntoPages(
    markdown,
    textMetrics,
    { firstPageReserveLines: 0 },
    estimateTextLines
  );

  const codePage = pages.find((page) =>
    page.blocks.some((block) => block.type === "code")
  );
  const codeOnlyPage =
    codePage?.blocks.length === 1 && codePage.blocks[0].type === "code";

  assert.ok(codePage);
  assert.ok(codeOnlyPage);
});

test("shouldUseDedicatedDiagramPage keeps medium ASCII flows inline", () => {
  const content = [
    "Architecture",
    "LLM Developer Engines",
    "  ↓",
    "Proprietary Models       |       Open-Weights Models",
    "(Hosted API, Premium)    |       (Local Hosting, Private)",
    "  ↓                      |        ↓",
    "- Claude 3.5 Sonnet      +       - Llama 3.3",
    "- GPT-4o / o1 / o3-mini          - DeepSeek-R1 / Coder",
  ].join("\n");

  const textMetrics = {
    charsPerLine: 70,
    linesPerPage: 43,
    wordsPerPage: 260,
    lineWidthPoints: 360,
    fontSize: 12,
    paragraphIndentPoints: 16.2,
  };

  assert.equal(shouldUseDedicatedDiagramPage("text", content, textMetrics), false);
});

test("splitKdpMarkdownIntoPages splits code blocks that exceed one page", () => {
  const codeLines = Array.from(
    { length: 80 },
    (_, index) => `const row${index} = "This is a long generated roadmap line ${index}";`
  );
  const markdown = ["```tsx", ...codeLines, "```"].join("\n");
  const textMetrics = {
    charsPerLine: 54,
    linesPerPage: 18,
    wordsPerPage: 140,
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
  const codePages = pages.filter((page) =>
    page.blocks.some((block) => block.type === "code")
  );

  assert.ok(codePages.length > 1);
  assert.ok(
    codePages.every((page) => page.blocks.length === 1 && page.blocks[0].type === "code")
  );
  assert.ok(
    codePages.every(
      (page) =>
        page.blocks[0].content.split("\n").length < codeLines.length
    )
  );
});
