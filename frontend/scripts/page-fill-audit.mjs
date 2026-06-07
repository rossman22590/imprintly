import { createRequire } from "module";
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { splitKdpMarkdownIntoPreviewPages } from "../src/utils/kdp-markdown-blocks.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(
  new URL("../../backend/package.json", import.meta.url)
);
const mongoose = require("mongoose");

const BOOK_ID = process.argv[2] || "6a1515e8744abaa018a74109";

function loadEnv() {
  const envPath = resolve(__dirname, "../../backend/.env.local");
  const raw = readFileSync(envPath, "utf8");
  raw.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const eq = trimmed.indexOf("=");
    if (eq === -1) return;
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    if (!process.env[key]) process.env[key] = value;
  });
}

loadEnv();
await mongoose.connect(process.env.DB_URI);

const book = await mongoose.connection.db
  .collection("books")
  .findOne({ _id: new mongoose.Types.ObjectId(BOOK_ID) });
const chapters = (book.chapters || []).filter((ch) =>
  String(ch.content || "").trim()
);

const PRINT_PAGE_LINE_SAFETY = 2;
const trim = { width: 7, height: 10 };
const margins = { top: 0.78, bottom: 0.88, inside: 0.9, outside: 0.68 };
const fontSize = 12;
const contentWidth = Math.max(2, trim.width - margins.inside - margins.outside);
const contentHeight = Math.max(3, trim.height - margins.top - margins.bottom);
const lineHeightInches = (fontSize * 1.44) / 72;
const linesPerPage = Math.max(
  10,
  Math.round(contentHeight / lineHeightInches) - PRINT_PAGE_LINE_SAFETY
);
const textMetrics = {
  charsPerLine: Math.max(
    28,
    Math.floor((contentWidth * 72) / (fontSize * 0.45))
  ),
  linesPerPage,
  paragraphIndentRatio: 1.35,
  fontSize,
  lineWidthPoints: contentWidth * 72,
  paragraphIndentPoints: fontSize * 1.35,
  renderLineBuffer: 3,
};
const firstPageReserve = Math.max(5, Math.floor(linesPerPage * 0.14));

const estimateTextLines = (text, tm, opts = {}) => {
  const words = String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return 0;
  let lineCount = 1;
  let lineLimit = Math.max(
    8,
    tm.charsPerLine -
      (opts.continuation ? 0 : Math.round((tm.paragraphIndentRatio || 1.35) * 2.5))
  );
  let current = 0;
  words.forEach((word) => {
    const wordLength = word.length;
    if (current === 0) {
      current = wordLength;
      return;
    }
    if (current + 1 + wordLength <= lineLimit) {
      current += 1 + wordLength;
      return;
    }
    lineCount += 1;
    lineLimit = tm.charsPerLine;
    current = wordLength;
  });
  return Math.max(1, lineCount);
};

let pageNum = 0;
const pages = [];

chapters.forEach((chapter, chapterIndex) => {
  const chapterPages = splitKdpMarkdownIntoPreviewPages(
    chapter.content,
    textMetrics,
    { firstPageReserveLines: firstPageReserve },
    estimateTextLines
  );

  chapterPages.forEach((page, pageIndex) => {
    pageNum += 1;
    const blocks = page.blocks || [];
    const isDiagramOnly =
      blocks.length === 1 && blocks[0]?.type === "diagram";
    const lineEstimate = blocks.reduce((sum, block) => {
      if (block.type === "diagram") return sum + Math.min(12, linesPerPage * 0.45);
      if (block.type === "code") {
        return sum + Math.min(18, String(block.content || "").split("\n").length + 3);
      }
      if (block.type === "heading") {
        return sum + Math.max(2, 4 - Math.min(block.level || 3, 3));
      }
      if (block.type === "list") {
        return (
          sum +
          (block.items || []).reduce(
            (itemSum, item) => itemSum + estimateTextLines(item, textMetrics),
            0
          ) +
          1
        );
      }
      if (block.type === "blockquote") {
        return sum + estimateTextLines(block.text, textMetrics) + 1;
      }
      if (block.type === "paragraph") {
        return (
          sum +
          estimateTextLines(block.text, textMetrics, {
            continuation: Boolean(block.continuation),
          })
        );
      }
      return sum;
    }, 0);

    pages.push({
      pageNum,
      chapterIndex: chapterIndex + 1,
      chapterTitle: chapter.title,
      pageIndex,
      isDiagramOnly,
      fillPercent: Math.round((lineEstimate / linesPerPage) * 100),
      lineEstimate,
      linesPerPage,
      blockTypes: blocks.map((block) => block.type),
      snippet: blocks
        .map((block) => block.text || block.label || block.type)
        .join(" | ")
        .slice(0, 120),
    });
  });
});

const sparse = pages.filter((page) => !page.isDiagramOnly && page.fillPercent < 45);
const verySparse = pages.filter(
  (page) => !page.isDiagramOnly && page.fillPercent < 20
);

const outPath = resolve(__dirname, "../../backend/scripts/page-fill-audit.json");
writeFileSync(
  outPath,
  JSON.stringify(
    {
      bookTitle: book.title,
      textMetrics,
      totalPages: pages.length,
      diagramOnlyPages: pages.filter((page) => page.isDiagramOnly).length,
      sparseCount: sparse.length,
      verySparseCount: verySparse.length,
      sparse,
      verySparse,
    },
    null,
    2
  )
);

console.log("total", pages.length);
console.log("diagram-only", pages.filter((page) => page.isDiagramOnly).length);
console.log("sparse <45%", sparse.length);
console.log("very sparse <20%", verySparse.length);
console.log("out", outPath);

await mongoose.disconnect();
