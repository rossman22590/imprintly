import { createRequire } from "module";
import { parseReaderDiagram } from "../src/utils/reader-diagram-parse.js";

const require = createRequire(
  new URL("../../backend/package.json", import.meta.url)
);
const mongoose = require("mongoose");
import { toBookifyDiagram } from "../src/utils/bookify-diagram.js";
import {
  splitKdpMarkdownIntoPreviewPages,
  parseKdpMarkdownBlocks,
  isDedicatedDiagramFence,
} from "../src/utils/kdp-markdown-blocks.js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
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

const PRINT_PAGE_LINE_SAFETY = 2;
const PRINT_AVERAGE_CHAR_WIDTH_RATIO = 0.52;

function getKdpBookMargins(trim, pageCount) {
  const spineScale = pageCount > 150 ? 1.02 : 1;
  return {
    top: 0.78,
    bottom: 0.88,
    inside: 0.9 * spineScale,
    outside: 0.68,
  };
}

function getTextPageMetrics(trim, fontSize, margins, lineSpacing = 1.44, paragraphIndentRatio = 1.35) {
  const textArea = Math.max(
    8,
    (trim.width - margins.inside - margins.outside) *
      (trim.height - margins.top - margins.bottom)
  );
  const densityAt12pt = 8.95;
  const fontScale = Math.pow(12 / fontSize, 1.82);
  const contentWidth = Math.max(2, trim.width - margins.inside - margins.outside);
  const contentHeight = Math.max(3, trim.height - margins.top - margins.bottom);
  const lineHeightInches = (fontSize * lineSpacing) / 72;
  const linesPerPage = Math.max(
    10,
    Math.round(contentHeight / lineHeightInches) - PRINT_PAGE_LINE_SAFETY
  );
  const effectiveLineHeightInches = contentHeight / linesPerPage;
  const effectiveLineSpacing = (effectiveLineHeightInches * 72) / fontSize;
  const lineScale = 1.44 / effectiveLineSpacing;
  const charsPerLine = Math.max(
    28,
    Math.floor((contentWidth * 72) / (fontSize * PRINT_AVERAGE_CHAR_WIDTH_RATIO))
  );

  return {
    charsPerLine,
    linesPerPage,
    wordsPerPage: Math.max(70, Math.round(textArea * densityAt12pt * fontScale * lineScale)),
    paragraphIndentRatio,
    fontSize,
  };
}

function getChapterOpeningReserveLines(textMetrics) {
  return Math.max(3, Math.floor(textMetrics.linesPerPage * 0.1));
}

function estimatePreviewTextLines(text = "", textMetrics = {}, options = {}) {
  const normalized = String(text || "").trim();
  if (!normalized) return 0;

  const indentCharacters = options.continuation
    ? 0
    : Math.round((textMetrics.paragraphIndentRatio || 1.35) * 2.5);
  const words = normalized.split(/\s+/).filter(Boolean);
  let lineCount = 1;
  let lineLimit = Math.max(8, textMetrics.charsPerLine - indentCharacters);
  let currentLineLength = 0;

  words.forEach((word) => {
    const wordLength = word.length;
    if (currentLineLength === 0) {
      currentLineLength = wordLength;
      return;
    }
    if (currentLineLength + 1 + wordLength <= lineLimit) {
      currentLineLength += 1 + wordLength;
      return;
    }
    lineCount += 1;
    lineLimit = textMetrics.charsPerLine;
    currentLineLength = wordLength;
  });

  return Math.max(1, lineCount);
}

function countWords(text = "") {
  return String(text || "").split(/\s+/).filter(Boolean).length;
}

function classifyDiagramRender(content, language, label) {
  const code = String(content || "").replace(/\n$/, "");
  const lines = code.split("\n");
  const normalizedLanguage = String(language || "").trim().toLowerCase();

  if (!isDedicatedDiagramFence(language, content)) {
    return {
      renderMode: "code-block",
      quality: "inline-code",
      reason: `Inline code (${normalizedLanguage || "unknown"})`,
    };
  }

  const shouldTryDiagram =
    normalizedLanguage === "reader-diagram" ||
    ["text", "txt", "plain", "diagram", "flow", ""].includes(normalizedLanguage);

  const readerDiagram = parseReaderDiagram(lines);
  const bookifyDiagram =
    toBookifyDiagram(readerDiagram, label) ||
    (shouldTryDiagram
      ? { type: "pre", title: label || "Diagram", lines }
      : null);

  if (!bookifyDiagram) {
    return { renderMode: "missing", quality: "broken", reason: "No diagram output" };
  }

  if (bookifyDiagram.type === "pre") {
    return {
      renderMode: "pre",
      quality: "fallback",
      reason: "Unparsed ASCII pre block",
      readerType: readerDiagram?.type || null,
    };
  }

  return {
    renderMode: bookifyDiagram.type,
    quality: "good",
    reason: `Styled ${bookifyDiagram.type}`,
    readerType: readerDiagram?.type || null,
  };
}

loadEnv();

const dbUri = process.env.DB_URI;
if (!dbUri) {
  console.error("DB_URI missing");
  process.exit(1);
}

await mongoose.connect(dbUri);
const book = await mongoose.connection.db
  .collection("books")
  .findOne({ _id: new mongoose.Types.ObjectId(BOOK_ID) });

if (!book) {
  console.error("Book not found:", BOOK_ID);
  process.exit(1);
}

const chapters = (book.chapters || []).filter((ch) => String(ch.content || "").trim());
const trim = { width: 7, height: 10 };
const margins = getKdpBookMargins(trim, 210);
const textMetrics = getTextPageMetrics(trim, 12, margins, 1.44, 1.35);
const firstPageReserveLines = getChapterOpeningReserveLines(textMetrics);
const imageRegex = /!\[([^\]]*)]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g;

const audit = {
  bookTitle: book.title,
  bookId: BOOK_ID,
  chapterCount: chapters.length,
  textMetrics,
  diagramPages: [],
  poorDiagrams: [],
  fallbackDiagrams: [],
  shortTextPages: [],
  unfencedDiagramCandidates: [],
};

let interiorPageNumber = 0;
const bumpInterior = () => {
  interiorPageNumber += 1;
  return interiorPageNumber;
};

bumpInterior();
if (String(book.metadata?.copyrightPage || "").trim()) bumpInterior();
const tocPageCount = Math.max(1, Math.ceil(chapters.length / 18));
for (let i = 0; i < tocPageCount; i += 1) bumpInterior();
if (chapters.length && (interiorPageNumber + 1) % 2 === 0) bumpInterior();

chapters.forEach((chapter, chapterIndex) => {
  const content = String(chapter.content || "");
  const images = [];
  let match;
  while ((match = imageRegex.exec(content)) !== null) {
    if (match[2]?.trim()) images.push(match[2]);
  }
  images.forEach(() => bumpInterior());

  const pages = splitKdpMarkdownIntoPreviewPages(
    content,
    textMetrics,
    { firstPageReserveLines: images.length ? 0 : firstPageReserveLines },
    estimatePreviewTextLines
  );

  pages.forEach((page, pageIndex) => {
    const pageNum = bumpInterior();
    const blocks = page.blocks || [];
    const isDiagramOnly = blocks.length === 1 && blocks[0]?.type === "diagram";

    if (isDiagramOnly) {
      const block = blocks[0];
      const classification = classifyDiagramRender(
        block.content,
        block.language,
        block.label
      );
      const entry = {
        pageNum,
        chapterIndex: chapterIndex + 1,
        chapterTitle: chapter.title,
        label: block.label || "",
        language: block.language || "",
        previewSnippet: String(block.content || "").split("\n").slice(0, 3).join(" | "),
        ...classification,
      };
      audit.diagramPages.push(entry);
      if (classification.quality === "poor") audit.poorDiagrams.push(entry);
      if (classification.quality === "fallback") audit.fallbackDiagrams.push(entry);
      return;
    }

    const paragraphBlocks = blocks.filter((b) => b.type === "paragraph");
    const lineEstimate = paragraphBlocks.reduce(
      (sum, b) =>
        sum +
        estimatePreviewTextLines(b.text, textMetrics, {
          continuation: Boolean(b.continuation),
        }),
      0
    );
    const hasChapterHeader = pageIndex === 0 && images.length === 0;
    const headerReserve = hasChapterHeader ? firstPageReserveLines : 0;
    const usableLines = textMetrics.linesPerPage - headerReserve;
    const fillRatio = usableLines > 0 ? lineEstimate / usableLines : 0;
    const wordCount = paragraphBlocks.reduce((sum, b) => sum + countWords(b.text), 0);

    if (fillRatio < 0.45 && wordCount > 0) {
      audit.shortTextPages.push({
        pageNum,
        chapterIndex: chapterIndex + 1,
        chapterTitle: chapter.title,
        wordCount,
        lineEstimate,
        usableLines,
        fillPercent: Math.round(fillRatio * 100),
      });
    }
  });

  const blocks = parseKdpMarkdownBlocks(content);
  blocks.forEach((block, blockIndex) => {
    if (block.type !== "paragraph") return;
    const text = block.text || "";
    const looksLikeDiagram =
      /[→↓│├└┌]/.test(text) ||
      (/^\s*\d+\.\s+/m.test(text) && text.split("\n").length >= 3);

    if (!looksLikeDiagram) return;
    const prev = blocks[blockIndex - 1];
    const next = blocks[blockIndex + 1];
    if (prev?.type === "fence" || next?.type === "fence") return;

    audit.unfencedDiagramCandidates.push({
      chapterIndex: chapterIndex + 1,
      snippet: text.slice(0, 120),
    });
  });
});

audit.totalInteriorPages = interiorPageNumber;

const outPath = resolve(__dirname, "../../backend/scripts/audit-results.json");
await import("fs").then(({ writeFileSync }) =>
  writeFileSync(outPath, JSON.stringify(audit, null, 2))
);

console.log("--- SUMMARY ---");
console.log(`Book: ${audit.bookTitle}`);
console.log(`Interior pages: ${audit.totalInteriorPages}`);
console.log(`Diagram pages: ${audit.diagramPages.length}`);
console.log(`  Good: ${audit.diagramPages.filter((d) => d.quality === "good").length}`);
console.log(`  Fallback (pre): ${audit.fallbackDiagrams.length}`);
console.log(`  Poor (code lang): ${audit.poorDiagrams.length}`);
console.log(`Short text pages (<45% fill): ${audit.shortTextPages.length}`);
console.log(`Unfenced diagram candidates: ${audit.unfencedDiagramCandidates.length}`);
console.log(`Results: ${outPath}`);

await mongoose.disconnect();
