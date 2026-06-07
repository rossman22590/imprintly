import { createRequire } from "module";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { splitKdpMarkdownIntoPreviewPages } from "../src/utils/kdp-markdown-blocks.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(new URL("../../backend/package.json", import.meta.url));
const mongoose = require("mongoose");
const BOOK_ID = process.argv[2] || "6a1515e8744abaa018a74109";
const START = Number(process.argv[3] || 1);
const END = Number(process.argv[4] || 25);

function loadEnv() {
  const raw = readFileSync(resolve(__dirname, "../../backend/.env.local"), "utf8");
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
const chapters = (book.chapters || []).filter((ch) => String(ch.content || "").trim());

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
  charsPerLine: Math.max(28, Math.floor((contentWidth * 72) / (fontSize * 0.45))),
  linesPerPage,
  paragraphIndentRatio: 1.35,
  fontSize,
  lineWidthPoints: contentWidth * 72,
  paragraphIndentPoints: fontSize * 1.35,
  renderLineBuffer: 3,
};
const firstPageReserve = Math.max(5, Math.floor(linesPerPage * 0.14));

const estimateTextLines = (text, tm, opts = {}) => {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
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

let interior = 0;
const front = 1; // title
interior += 1;
if (String(book.kdp?.metadata?.copyrightPage || book.metadata?.copyrightPage || "").trim()) {
  interior += 1;
}
const tocPages = 2; // approximate
interior += tocPages;
if ((interior + 1) % 2 === 0) interior += 1;

const pages = [];
chapters.forEach((chapter, chapterIndex) => {
  const chapterPages = splitKdpMarkdownIntoPreviewPages(
    chapter.content,
    textMetrics,
    { firstPageReserveLines: chapterIndex === 0 ? firstPageReserve : 0 },
    estimateTextLines
  );
  chapterPages.forEach((page, pageIndex) => {
    interior += 1;
    pages.push({
      interior,
      chapterIndex: chapterIndex + 1,
      chapterTitle: chapter.title,
      pageIndex: pageIndex + 1,
      blocks: page.blocks || [],
    });
  });
});

pages
  .filter((p) => p.interior >= START && p.interior <= END)
  .forEach((p) => {
    const snippet = p.blocks
      .map((b) => {
        if (b.type === "diagram" || b.type === "code") {
          return `${b.type}:${(b.content || "").split("\n").length}L`;
        }
        return `${b.type}:${String(b.text || b.label || "").slice(0, 60)}`;
      })
      .join(" | ");
    console.log(
      `p${p.interior} ch${p.chapterIndex}.${p.pageIndex}`,
      snippet.slice(0, 240)
    );
  });

await mongoose.disconnect();
