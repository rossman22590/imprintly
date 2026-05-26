const assert = require("node:assert/strict");
const test = require("node:test");
const { __private } = require("./pdf.generator");

const {
  isDiagramCodeBlock,
  normalizeCodeTextForPdf,
  parseAsciiTableDiagram,
  parseBranchDiagram,
  parseComparisonDiagram,
  parseFlowDiagram,
  parseLinearFlowDiagram,
  parseStackDiagram,
} = __private;

test("detects unicode box/tree diagrams as diagram code blocks", () => {
  const lines = [
    "               [ The Geopolitical Triumvirate ]",
    "                              \u2502",
    "         \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u253C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510",
    "         \u25BC                    \u25BC                    \u25BC",
    "   [United States]      [European Union]        [China]",
  ];

  assert.equal(isDiagramCodeBlock(lines), true);
});

test("normalizes unsupported diagram glyphs before PDF code rendering", () => {
  const normalized = normalizeCodeTextForPdf(
    "\u250C\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2510\n\u2502 A \u2502 B \u2502\n\u2514\u2500\u2500\u2500\u2534\u2500\u2500\u2500\u2518\n\u25BC"
  );

  assert.equal(/[\u2500-\u257F\u25B2-\u25C4]/.test(normalized), false);
  assert.match(normalized, /\+---\+---\+/);
  assert.match(normalized, /\| A \| B \|/);
  assert.match(normalized, /v/);
});

test("parses bracket tree diagrams into semantic PDF flow nodes", () => {
  const diagram = parseFlowDiagram([
    "               [ The Geopolitical Triumvirate ]",
    "                              \u2502",
    "         \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u253C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510",
    "         \u25BC                    \u25BC                    \u25BC",
    "   [United States]      [European Union]        [China]",
    "  Market Innovation      Rights & Safety     State Control",
    "   & Corporate IP         & Bureaucracy      & Public Order",
  ]);

  assert.equal(diagram.title, "The Geopolitical Triumvirate");
  assert.deepEqual(
    diagram.nodes.map((node) => node.label),
    ["United States", "European Union", "China"]
  );
  assert.match(diagram.nodes[0].detail, /Market Innovation/);
  assert.match(diagram.nodes[1].detail, /Rights & Safety/);
  assert.match(diagram.nodes[2].detail, /Public Order/);
});

test("parses boxed architecture stack diagrams into semantic PDF layers", () => {
  const diagram = parseStackDiagram([
    "      [ Consumer Device Architecture: Post-2026 Accord ]",
    "+----------------------------------------------------------+",
    "|                 Consumer Application                    |",
    "+----------------------------------------------------------+",
    "|                      | (API Request)                     |",
    "|                      v                                   |",
    "+----------------------------------------------------------+",
    "|       Local Hardware-Level Safety Guard (On-Chip)        |",
    "|  - Real-Time Behavioral Sandboxing                       |",
    "|  - Local Watermarking (C2PA Integration)                 |",
    "+----------------------------------------------------------+",
    "|                    | (Verified Request)                  |",
    "|                    v                                     |",
    "+----------------------------------------------------------+",
    "|                    Frontier AI Model                     |",
    "|       (Audited by IAISA / Signed with Cryptographic Key) |",
    "+----------------------------------------------------------+",
  ]);

  assert.equal(
    diagram.title,
    "Consumer Device Architecture: Post-2026 Accord"
  );
  assert.deepEqual(
    diagram.layers.map((layer) => layer.label),
    [
      "Consumer Application",
      "Local Hardware-Level Safety Guard (On-Chip)",
      "Frontier AI Model",
    ]
  );
  assert.deepEqual(diagram.connectors, ["API Request", "Verified Request"]);
  assert.match(diagram.layers[1].detail, /Behavioral Sandboxing/);
});

test("parses ascii tables into PDF table rows", () => {
  const table = parseAsciiTableDiagram([
    "+------------------+--------------------------+--------------------------+",
    "| Space Type       | Examples                 | Best Practices           |",
    "+------------------+--------------------------+--------------------------+",
    "| Local            | Food rescue              | Choose team tasks        |",
    "| Volunteering     | Habitat builds           | Avoid solo tasks         |",
    "+------------------+--------------------------+--------------------------+",
  ]);

  assert.deepEqual(table.header, [
    "Space Type",
    "Examples",
    "Best Practices",
  ]);
  assert.equal(table.rows.length, 1);
  assert.match(table.rows[0][0], /Volunteering/);
  assert.match(table.rows[0][2], /Avoid solo tasks/);
});

test("parses side-by-side comparison diagrams", () => {
  const diagram = parseComparisonDiagram([
    "  [Solid, Creamed Butter]                      [Melted Butter]",
    "            |                                         |",
    "            v                                         v",
    "   Traps micro-air pockets                  Infiltrates flour quickly",
    "            |                                         |",
    "            v                                         v",
    " Cakey, light, aerated cookie             Dense, chewy, fudgy cookie",
  ]);

  assert.deepEqual(
    diagram.nodes.map((node) => node.label),
    ["Solid, Creamed Butter", "Melted Butter"]
  );
  assert.match(diagram.nodes[0].detail, /Cakey/);
  assert.match(diagram.nodes[1].detail, /fudgy/);
});

test("parses branch diagrams into a root and branches", () => {
  const diagram = parseBranchDiagram([
    '                  +-- "working from home" ---- [Thread 1: Ask about remote work dynamics]',
    "                  |",
    '"I\'m a graphic ---+-- "graphic designer" --- [Thread 2: Ask about creative inspiration]',
    '  designer..."    |',
    '                  +-- \"boutique agency\" ------ [Thread 3: Ask about small-business environment]',
  ]);

  assert.match(diagram.title, /graphic/);
  assert.equal(diagram.nodes.length, 3);
  assert.match(diagram.nodes[2].label, /small-business/);
});

test("parses linear arrow flows", () => {
  const diagram = parseLinearFlowDiagram([
    "[ Client Browser ] <---> [ Next.js Server / API Routes ] <---> [ External APIs / Databases ]",
  ]);

  assert.deepEqual(
    diagram.nodes.map((node) => node.label),
    [
      "Client Browser",
      "Next.js Server / API Routes",
      "External APIs / Databases",
    ]
  );
});

test("parses vertical bracket flows that use pipe and v connectors", () => {
  const diagram = parseLinearFlowDiagram([
    "       [Fat Coats Flour Proteins]",
    "                 |",
    "                 v",
    "   [Blocks Water from Hydrating Proteins]",
    "                 |",
    "                 v",
    "     [Inhibits Gluten Formation]",
    "                 |",
    "                 v",
    "   [Result: Tender, Melt-in-Mouth Texture]",
  ]);

  assert.deepEqual(
    diagram.nodes.map((node) => node.label),
    [
      "Fat Coats Flour Proteins",
      "Blocks Water from Hydrating Proteins",
      "Inhibits Gluten Formation",
      "Result: Tender, Melt-in-Mouth Texture",
    ]
  );
});
