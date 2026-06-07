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
    const t = line.trim();
    if (!t || t.startsWith("#")) return;
    const eq = t.indexOf("=");
    if (eq === -1) return;
    if (!process.env[t.slice(0, eq)]) process.env[t.slice(0, eq)] = t.slice(eq + 1);
  });
}

function escapeRegExp(v) {
  return String(v).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripChapterOpener(markdown, chapterIndex, chapterTitle) {
  const n = chapterIndex + 1;
  const titlePart = escapeRegExp(String(chapterTitle || "").trim());
  return String(markdown || "").replace(
    new RegExp(`^#{0,6}\\s*Chapter\\s+${n}\\s*[:\\-–]?\\s*${titlePart}\\s*\\n+`, "im"),
    ""
  );
}

function stripDuplicateBlocks(blocks, chapterIndex, chapterTitle) {
  const cleaned = [...blocks];
  const n = chapterIndex + 1;
  const prefix = new RegExp(`^chapter\\s+${n}\\s*[:\\-–]?\\s*`, "i");
  const normTitle = String(chapterTitle || "").trim().toLowerCase();
  while (cleaned.length) {
    const first = cleaned[0];
    const text = String(first.text || "").trim();
    if (first.type === "heading" && prefix.test(text)) {
      cleaned.shift();
      continue;
    }
    if (first.type === "heading" && normTitle && text.toLowerCase() === normTitle) {
      cleaned.shift();
      continue;
    }
    if (first.type === "paragraph" && prefix.test(text)) {
      const rem = text.replace(prefix, "").trim();
      if (!rem || rem.toLowerCase() === normTitle) {
        cleaned.shift();
        continue;
      }
      cleaned[0] = { ...first, text: rem };
    }
    break;
  }
  return cleaned;
}

loadEnv();
await mongoose.connect(process.env.DB_URI);
const book = await mongoose.connection.db
  .collection("books")
  .findOne({ _id: new mongoose.Types.ObjectId(BOOK_ID) });
const chapters = (book.chapters || []).filter((ch) => String(ch.content || "").trim());
const metadata = book.kdp?.metadata || book.metadata || {};

const PRINT_PAGE_LINE_SAFETY = 2;
const trim = { width: 7, height: 10 };
const fontSize = 12;
const lineSpacing = 1.44;
const paragraphIndent = 1.35;
let pageCount = 120;
let margins = { top: 0.78, bottom: 0.88, inside: 0.9, outside: 0.68 };
const contentWidth = Math.max(2, trim.width - margins.inside - margins.outside);
const contentHeight = Math.max(3, trim.height - margins.top - margins.bottom);
const lineHeightInches = (fontSize * lineSpacing) / 72;
let linesPerPage = Math.max(10, Math.round(contentHeight / lineHeightInches) - PRINT_PAGE_LINE_SAFETY);
const textMetrics = {
  charsPerLine: Math.max(28, Math.floor((contentWidth * 72) / (fontSize * 0.45))),
  linesPerPage,
  paragraphIndentRatio: paragraphIndent,
  fontSize,
  lineWidthPoints: contentWidth * 72,
  paragraphIndentPoints: fontSize * paragraphIndent,
  renderLineBuffer: 2,
};

const estimateTextLines = (text, tm, opts = {}) => {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 0;
  let lineCount = 1;
  let lineLimit = Math.max(
    8,
    tm.charsPerLine - (opts.continuation ? 0 : Math.round((tm.paragraphIndentRatio || 1.35) * 2.5))
  );
  let current = 0;
  words.forEach((word) => {
    const wl = word.length;
    if (current === 0) {
      current = wl;
      return;
    }
    if (current + 1 + wl <= lineLimit) {
      current += 1 + wl;
      return;
    }
    lineCount += 1;
    lineLimit = tm.charsPerLine;
    current = wl;
  });
  return Math.max(1, lineCount);
};

const firstPageReserve = Math.max(5, Math.floor(linesPerPage * 0.14));
let interior = 0;
const pages = [];

const add = (page) => {
  interior += 1;
  pages.push({ ...page, interior });
};

add({ kind: "title", label: "title" });
if (String(metadata.copyrightPage || "").trim()) add({ kind: "copyright" });

const tocEntriesPerPage = 18;
const tocPageCount = Math.max(1, Math.ceil(chapters.length / tocEntriesPerPage));
for (let i = 0; i < tocPageCount; i++) add({ kind: "toc" });
if (chapters.length && (interior + 1) % 2 === 0) add({ kind: "blank" });

chapters.forEach((chapter, chapterIndex) => {
  const md = stripChapterOpener(chapter.content, chapterIndex, chapter.title);
  const chapterPages = splitKdpMarkdownIntoPreviewPages(md, textMetrics, {
    firstPageReserveLines: firstPageReserve,
  }, estimateTextLines);

  chapterPages.forEach((page, pageIndex) => {
    let blocks = page.blocks || [];
    if (pageIndex === 0) {
      blocks = stripDuplicateBlocks(blocks, chapterIndex, chapter.title);
    }
    add({
      kind: "chapter",
      chapterIndex: chapterIndex + 1,
      chapterTitle: chapter.title,
      pageIndex: pageIndex + 1,
      blocks,
      hasHeader: pageIndex === 0,
    });
  });
});

pages.filter((p) => p.interior >= START && p.interior <= END).forEach((p) => {
  const snippet = (p.blocks || [])
    .map((b) => {
      if (b.type === "diagram" || b.type === "code") return `${b.type}:${(b.content || "").split("\n").length}L`;
      return `${b.type}:${String(b.text || "").slice(0, 55)}`;
    })
    .join(" | ");
  console.log(
    `p${p.interior} ch${p.chapterIndex || "-"}${p.pageIndex ? "." + p.pageIndex : ""}${p.hasHeader ? " [HDR]" : ""}`,
    snippet.slice(0, 220)
  );
});

await mongoose.disconnect();
