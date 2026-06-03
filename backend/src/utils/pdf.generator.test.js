const assert = require("node:assert/strict");
const { Writable } = require("node:stream");
const test = require("node:test");
const { generatePdf, __private } = require("./pdf.generator");

const {
  countChildrenPageWords,
  getChildrenPagePartsFromMarkdown,
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
  splitTextForChildrenImagePage,
  getCoverImagePlacement,
  getKdpMargins,
  getKdpPageSize,
  getKdpPdfConfig,
} = __private;

test("scales cover images to fill the entire PDF page", () => {
  const placement = getCoverImagePlacement(595.28, 841.89, 600, 800);

  assert.equal(Math.round(placement.height), 842);
  assert.ok(placement.width >= 595.28);
  assert.ok(placement.x <= 0);
  assert.ok(Math.abs(placement.y) < 0.001);
});

test("KDP PDF page size follows saved trim size", () => {
  assert.deepEqual(
    getKdpPageSize({
      kdp: { settings: { trimSize: "5x8" } },
    }),
    [360, 576]
  );
});

test("KDP generated PDF uses trim size on every page", async () => {
  class BufferSink extends Writable {
    constructor() {
      super();
      this.chunks = [];
    }

    _write(chunk, _encoding, callback) {
      this.chunks.push(Buffer.from(chunk));
      callback();
    }
  }

  const sink = new BufferSink();
  const book = {
    title: "Trim Check",
    author: "Author",
    genre: "Mystery",
    coverImage: "",
    kdp: {
      settings: { trimSize: "6x9", fontSize: "12" },
      assets: { backCoverBlurb: "Back cover copy." },
    },
    chapters: [
      {
        title: "Opening",
        content: "This is a test paragraph. ".repeat(120),
      },
    ],
  };
  await generatePdf(book, sink);

  const pdf = Buffer.concat(sink.chunks).toString("latin1");
  const mediaBoxes = [
    ...pdf.matchAll(/\/MediaBox\s*\[\s*0\s+0\s+([0-9.]+)\s+([0-9.]+)\s*\]/g),
  ].map((match) => `${match[1]}x${match[2]}`);
  const pageCountMatch = pdf.match(
    /\/Type\s*\/Pages[\s\S]{0,80}?\/Count\s+(\d+)/
  );

  assert.ok(mediaBoxes.length > 2);
  assert.deepEqual([...new Set(mediaBoxes)], ["432x648"]);
  assert.match(pdf, /\/PageLayout\s*\/TwoPageRight/);
  assert.equal(
    Number(pageCountMatch?.[1]),
    getKdpPdfConfig(book).pageCount + 2
  );
});

test("KDP PDF body font follows saved font size", () => {
  const config = getKdpPdfConfig({
    kdp: { settings: { fontSize: "14" } },
  });

  assert.equal(config.sizes.body, 14);
  assert.equal(config.sizes.chapterTitle, 18);
});

test("KDP PDF margins follow gutter rules for final page count", () => {
  const margins = getKdpMargins([6 * 72, 9 * 72], 320);

  assert.equal(margins.inside, 0.9 * 72);
  assert.equal(margins.outside, 0.68 * 72);
  assert.equal(margins.gutterMinimum, 0.625 * 72);
});

test("splits children text so the image page is short and text page is longer", () => {
  const text = [
    "Barnaby heard a soft tap under the bed and held his breath.",
    "A purple monster peeked out with a lantern made of moonlight.",
    "The room filled with tiny silver sparks as the monster gave a shy wave.",
    "Barnaby waved back, because brave things are easier when someone smiles first.",
    "Together they tiptoed toward the glowing portal, listening to the train whistle below the floorboards.",
    "The stairs shimmered like soap bubbles, and every step hummed a friendly tune.",
    "At the bottom, a conductor mouse lifted his cap and called, All aboard for the monster world.",
    "Barnaby squeezed the monster's paw and stepped into the warm golden light.",
  ].join(" ");
  const parts = splitTextForChildrenImagePage(text);

  assert.ok(countChildrenPageWords(parts.leftText) >= 20);
  assert.ok(countChildrenPageWords(parts.leftText) <= 80);
  assert.ok(
    countChildrenPageWords(parts.rightText) >
      countChildrenPageWords(parts.leftText)
  );
});

test("children PDF parser tops up tiny old image-page text from the text page", () => {
  const markdown = `
### Left Page: Illustration

Barnaby gasped.

***

### Right Page: Story Text

The tiny monster opened a door made of blue sparks. Barnaby saw a tunnel full of humming stars, sleepy socks, and golden train tracks.

He wanted to run, but the monster held out one fuzzy hand. "I know the way," the monster whispered.

Barnaby took one step, then another. Soon the bedroom was far behind them, and the Under-Bed Express was waiting with warm lights in every window.
`;
  const parts = getChildrenPagePartsFromMarkdown(
    markdown,
    "The Door Under the Bed"
  );

  assert.ok(countChildrenPageWords(parts.leftText) >= 20);
  assert.ok(
    countChildrenPageWords(parts.rightText) >
      countChildrenPageWords(parts.leftText)
  );
  assert.doesNotMatch(parts.leftText, /Left Page/);
  assert.doesNotMatch(parts.rightText, /Right Page/);
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
