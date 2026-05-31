const assert = require("node:assert/strict");
const test = require("node:test");
const { __private } = require("./pdf.generator");

const {
  isDiagramCodeBlock,
  normalizeCodeTextForPdf,
  parseAsciiTableDiagram,
  parseBoxedListDiagram,
  parseBranchDiagram,
  parseComparisonDiagram,
  parseFlowDiagram,
  parseLinearFlowDiagram,
  parseNestedArchitectureDiagram,
  parseProcessDiagram,
  parseStackDiagram,
  parseSystemComparisonDiagram,
  getCoverImagePlacement,
  getSpreadPartsFromMarkdown,
  getSpreadTextFromMarkdown,
  splitTextForChildrenImagePage,
} = __private;

test("scales cover images to fill the entire PDF page", () => {
  const placement = getCoverImagePlacement(595.28, 841.89, 600, 800);

  assert.equal(Math.round(placement.height), 842);
  assert.ok(placement.width >= 595.28);
  assert.ok(placement.x <= 0);
  assert.ok(Math.abs(placement.y) < 0.001);
});

test("children spread PDF text excludes illustration page notes", () => {
  const text = getSpreadTextFromMarkdown(
    [
      "### Left Page: Illustration",
      "",
      "![Map](/uploads/ai-image-1.png)",
      "",
      "Three friends study a leaf map below an oak tree.",
      "",
      "***",
      "",
      "### Right Page: Story Text",
      "",
      "\"Ta-da!\" squeaked Pip.",
      "",
      "***Squish! Squash! Squelch!***",
    ].join("\n"),
    "The Grand Map of Mud"
  );

  assert.doesNotMatch(text, /Left Page/);
  assert.doesNotMatch(text, /oak tree/);
  assert.match(text, /"Ta-da!" squeaked Pip/);
  assert.match(text, /Squish! Squash! Squelch!/);
});

test("children spread PDF parts preserve short left-page text separately", () => {
  const parts = getSpreadPartsFromMarkdown(
    [
      "### Left Page: Illustration",
      "",
      "Mud went squish under Pippa's shiny boots.",
      "",
      "***",
      "",
      "### Right Page: Story Text",
      "",
      "\"Ta-da!\" squeaked Pip.",
    ].join("\n"),
    "The Grand Map of Mud"
  );

  assert.equal(parts.leftText, "Mud went squish under Pippa's shiny boots.");
  assert.equal(parts.rightText, '"Ta-da!" squeaked Pip.');
});

test("children image pages top up tiny labeled text from the following text page", () => {
  const parts = getSpreadPartsFromMarkdown(
    [
      "### Left Page: Illustration",
      "",
      "Moon dust tickled Barnaby's toes.",
      "",
      "***",
      "",
      "### Right Page: Story Text",
      "",
      "Barnaby peeked under the bed and found a tiny train glowing blue beside his slippers. The engine gave a sleepy toot, and purple sparks twirled around the blanket like fireflies. Milo climbed aboard with his stuffed rabbit tucked under one arm, while the friendly monster folded himself into the caboose. Together they rolled toward a silver tunnel that opened in the wall. The tunnel smelled like warm cinnamon and moon dust, and every clickety-clack made the stars painted on Milo's pajamas blink awake. Barnaby pressed his nose to the window, whispering hello to floating socks, upside-down pillows, and a sleepy moon-moth conductor who tipped his silver cap.",
    ].join("\n"),
    "The Under-Bed Express"
  );

  assert.ok(parts.leftText.split(/\s+/).length >= 35);
  assert.ok(
    parts.rightText.split(/\s+/).length >=
      parts.leftText.split(/\s+/).length * 1.7
  );
  assert.match(parts.leftText, /Moon dust tickled/);
  assert.match(parts.leftText, /tiny train glowing/);
  assert.match(parts.rightText, /silver tunnel|friendly monster/);
});

test("children image pages get a real story paragraph when none is labeled", () => {
  const parts = getSpreadPartsFromMarkdown(
    [
      "\"Ta-da!\" squeaked Pip, waving the map high while the muddy trail sparkled like chocolate pudding in the morning sun.",
      "",
      "Barnaby leaned closer until his nose nearly touched the leaf, and Pippa tugged her red boots with a proud little squeak. Together they stepped forward, chanting left foot, right foot, brave boots, bright boots, until the first puddle answered with a tremendous sploosh. The forest went quiet, then giggled in drips from every leaf. Pip tried to look serious, but a blob of mud landed on his whiskers like a tiny brown mustache. Pippa clapped, Barnaby bowed, and the map fluttered toward a tunnel of ferns where something shiny was humming their marching song back to them.",
    ].join("\n"),
    "The Grand Map of Mud"
  );

  assert.ok(parts.leftText.split(/\s+/).length >= 35);
  assert.ok(parts.leftText.split(/\s+/).length <= 80);
  assert.ok(
    parts.rightText.split(/\s+/).length >=
      parts.leftText.split(/\s+/).length * 1.7
  );
  assert.match(parts.leftText, /muddy trail sparkled/);
  assert.match(parts.rightText, /forest went quiet|first puddle/);
  assert.doesNotMatch(parts.rightText, /"Ta-da!"/);
});

test("children image page text splitter keeps a larger opening chunk for the image page", () => {
  const parts = splitTextForChildrenImagePage(
    "Mira lifted the glowing spoon while moonlight wobbled across the kitchen tiles. The soup sparkled blue, then green, then gold as everyone leaned closer. Barnaby held his breath, Pippa clapped twice, and the tiny kettle began to hum a tune nobody had heard before. One brave bubble popped into the shape of a star and floated toward the ceiling. Mira laughed so hard the cupboards rattled, but the spoon pointed toward the pantry door."
  );

  assert.ok(parts.leftText.split(/\s+/).length >= 35);
  assert.ok(parts.leftText.split(/\s+/).length <= 80);
  assert.match(parts.leftText, /soup sparkled/);
  assert.match(parts.rightText, /pantry door/);
});

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

test("parses nested architecture diagrams into layers", () => {
  const diagram = parseNestedArchitectureDiagram([
    "+---------------------------------------------------------------------+",
    "|                          Host OS Kernel                             |",
    "|                                                                     |",
    "|  +---------------------------------------------------------------+  |",
    "|  |                           Namespaces                          |  |",
    "|  |   [PID] (Isolated Processes)     [NET] (Isolated Network)     |  |",
    "|  |   [MNT] (Isolated File System)   [IPC] (Isolated Comm)        |  |",
    "|  +---------------------------------------------------------------+  |",
    "|                                                                     |",
    "|  +---------------------------------------------------------------+  |",
    "|  |                        Control Groups                         |  |",
    "|  |   [RAM Limit: 512MB]   [CPU Limit: 1 Core]   [I/O Limit]      |  |",
    "|  +---------------------------------------------------------------+  |",
    "+---------------------------------------------------------------------+",
  ]);

  assert.equal(diagram.title, "Host OS Kernel");
  assert.deepEqual(
    diagram.layers.map((layer) => layer.label),
    ["Namespaces", "Control Groups"]
  );
  assert.match(diagram.layers[0].detail, /PID: Isolated Processes/);
  assert.match(diagram.layers[1].detail, /RAM Limit: 512MB/);
});

test("parses boxed list diagrams into readable callouts", () => {
  const diagram = parseBoxedListDiagram([
    "       +-------------------------------------------------------+",
    '       |             THE BENEFITS OF CONTAINERS                |',
    "       +-------------------------------------------------------+",
    '       |  1. Consistency (No "Works on my machine" issues)     |',
    "       |  2. Portability (Run on Cloud, Laptop, or Datacenter) |",
    "       |  3. Efficiency (High density, lower hardware costs)   |",
    "       |  4. Rapid Scaling (Instant startup for load spikes)   |",
    "       |  5. Microservices-Friendly (Isolate small service components)|",
    "       +-------------------------------------------------------+",
  ]);

  assert.equal(diagram.title, "THE BENEFITS OF CONTAINERS");
  assert.equal(diagram.items.length, 5);
  assert.match(diagram.items[0], /Consistency/);
  assert.match(diagram.items[4], /Microservices-Friendly/);
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

test("drops empty spacer columns and normalizes bullet glyphs in ascii tables", () => {
  const table = parseAsciiTableDiagram([
    "+----------------------------+     +----------------------------+",
    "| Retail CBDC (e.g., eCNY)   |     | Wholesale CBDC (mBridge)   |",
    "+----------------------------+     +----------------------------+",
    "| \u2022 Peer-to-Peer Transactions |     | \u2022 Cross-Border Settlement |",
    "| \u2022 Commercial Bank Wallets   |     | \u2022 Direct Liquidity Access |",
    "+----------------------------+     +----------------------------+",
  ]);

  assert.deepEqual(table.header, [
    "Retail CBDC (e.g., eCNY)",
    "Wholesale CBDC (mBridge)",
  ]);
  assert.equal(table.rows.length, 1);
  assert.match(table.rows[0][0], /- Peer-to-Peer Transactions/);
  assert.match(table.rows[0][1], /- Cross-Border Settlement/);
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

test("parses duplicated boxed process diagrams", () => {
  const diagram = parseProcessDiagram([
    "Ambient Air: ~425 ppm CO2",
    "|",
    "|",
    "v",
    "v",
    "+---------------------------+",
    "+---------------------------+",
    "| Boreas Collector Fans | --> Sorbent filters trap CO2",
    "| Boreas Collector Fans | --> Sorbent filters trap CO2",
    "+---------+-----------------+",
    "+---------+-----------------+",
    "| (Desorption",
    "Heated to 100?C via geothermal energy)",
    "v",
    "v",
    "| Pure CO2 Gas Stream |",
    "| Pure CO2 Gas Stream |",
    "[Solid Calcium Carbonate (Stone)]",
    "[Solid Calcium Carbonate (Stone)]",
  ]);

  assert.equal(diagram.title, "Process Flow");
  assert.deepEqual(
    diagram.nodes.map((node) => node.label),
    [
      "Ambient Air: ~425 ppm CO2",
      "Boreas Collector Fans",
      "Pure CO2 Gas Stream",
      "Solid Calcium Carbonate (Stone)",
    ]
  );
  assert.match(diagram.nodes[1].detail, /Sorbent filters trap CO2/);
});

test("parses sectioned system comparison diagrams before table parsing", () => {
  const diagram = parseSystemComparisonDiagram([
    "LEGACY SYSTEM (Fractional Reserve):",
    "+---------------+     Deposits     +-----------------+     Loans      +---------------+",
    "|   Consumer    +----------------->| Commercial Bank +--------------->|   Borrower    |",
    "+---------------+                  +-----------------+                +---------------+",
    "                                           |",
    "                                           v (Subject to run risk / insolvencies)",
    "",
    "CBDC SYSTEM (Disintermediated):",
    "+---------------+             Direct Digital Liabilities             +---------------+",
    "|   Consumer    +---------------------------------------------------->| Central Bank  |",
    "+---------------+                                                     +---------------+",
    "                      (Risk-free money bypasses the commercial system)",
  ]);

  assert.deepEqual(
    diagram.nodes.map((node) => node.label),
    ["LEGACY SYSTEM (Fractional Reserve)", "CBDC SYSTEM (Disintermediated)"]
  );
  assert.match(diagram.nodes[0].detail, /Commercial Bank/);
  assert.match(diagram.nodes[1].detail, /Central Bank/);
});
