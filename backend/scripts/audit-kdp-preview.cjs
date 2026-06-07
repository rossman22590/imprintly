/**
 * Audits KDP full-preview pagination for a book: diagram rendering quality and short pages.
 * Usage: node --env-file=.env.local scripts/audit-kdp-preview.cjs [bookId]
 */
const mongoose = require("mongoose");
const path = require("path");
const { pathToFileURL } = require("url");

const BOOK_ID = process.argv[2] || "6a1515e8744abaa018a74109";

const CODE_LANGUAGES = new Set([
  "bash", "c", "cpp", "csharp", "css", "go", "html", "java", "javascript", "js",
  "json", "kotlin", "php", "python", "py", "ruby", "rust", "shell", "sql", "swift",
  "ts", "typescript", "xml", "yaml", "yml",
]);

const PRINT_PAGE_LINE_SAFETY = 2;
const PRINT_AVERAGE_CHAR_WIDTH_RATIO = 0.52;

function getKdpBookMargins(trim, pageCount) {
  const baseInside = 0.9;
  const baseOutside = 0.68;
  const spineScale = pageCount > 150 ? 1.02 : 1;

  return {
    top: 0.78,
    bottom: 0.88,
    inside: baseInside * spineScale,
    outside: Math.max(0.25, baseOutside),
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

function classifyDiagramRender(content, language, label, parseReaderDiagram, toBookifyDiagram) {
  const code = String(content || "").replace(/\n$/, "");
  const lines = code.split("\n");
  const normalizedLanguage = String(language || "").trim().toLowerCase();
  const shouldTryDiagram =
    normalizedLanguage === "reader-diagram" ||
    ["text", "txt", "plain", "diagram", "flow", ""].includes(normalizedLanguage);

  if (!shouldTryDiagram) {
    return {
      renderMode: "code-block",
      quality: "poor",
      reason: `Fenced as code (${normalizedLanguage || "unknown"}) — preview shows monospace, not styled diagram`,
    };
  }

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
      reason: "Unparsed ASCII — shown as monospace pre block",
      readerType: readerDiagram?.type || null,
    };
  }

  return {
    renderMode: bookifyDiagram.type,
    quality: "good",
    reason: `Styled ${bookifyDiagram.type} diagram`,
    readerType: readerDiagram?.type || null,
  };
}

async function loadFrontendDiagramUtils() {
  const { parseReaderDiagram } = require("./reader-diagrams.bundle.cjs");
  const { toBookifyDiagram } = await import(
    pathToFileURL(
      path.resolve(__dirname, "../../frontend/src/utils/bookify-diagram.js")
    ).href
  );
  const { splitKdpMarkdownIntoPreviewPages, parseKdpMarkdownBlocks } = await import(
    pathToFileURL(
      path.resolve(__dirname, "../../frontend/src/utils/kdp-markdown-blocks.js")
    ).href
  );

  return { parseReaderDiagram, toBookifyDiagram, splitKdpMarkdownIntoPreviewPages, parseKdpMarkdownBlocks };
}

async function main() {
  const dbUri = process.env.DB_URI;
  if (!dbUri) {
    console.error("DB_URI missing");
    process.exit(1);
  }

  let diagramUtils;
  try {
    diagramUtils = await loadFrontendDiagramUtils();
  } catch (error) {
    console.error("Failed to load frontend diagram utils:", error.message);
    console.error("Run: cd frontend && npm install esbuild-register (or use node 22+ with jsx)");
    process.exit(1);
  }

  const {
    parseReaderDiagram,
    toBookifyDiagram,
    splitKdpMarkdownIntoPreviewPages,
    parseKdpMarkdownBlocks,
  } = diagramUtils;

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
    emptyTextPages: [],
    unfencedDiagramCandidates: [],
    totalInteriorPages: 0,
  };

  let globalPageIndex = 0;
  let interiorPageNumber = 0;

  const bumpInterior = () => {
    interiorPageNumber += 1;
    return interiorPageNumber;
  };

  bumpInterior(); // title
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
      globalPageIndex += 1;
      const pageNum = bumpInterior();
      const blocks = page.blocks || [];
      const isDiagramOnly =
        blocks.length === 1 && blocks[0]?.type === "diagram";

      if (isDiagramOnly) {
        const block = blocks[0];
        const classification = classifyDiagramRender(
          block.content,
          block.language,
          block.label,
          parseReaderDiagram,
          toBookifyDiagram
        );

        const entry = {
          pageNum,
          globalPageIndex,
          chapterIndex: chapterIndex + 1,
          chapterTitle: chapter.title,
          label: block.label || "",
          language: block.language || "",
          lineCount: String(block.content || "").split("\n").length,
          previewSnippet: String(block.content || "").split("\n").slice(0, 3).join(" | "),
          ...classification,
        };

        audit.diagramPages.push(entry);
        if (classification.quality === "poor") audit.poorDiagrams.push(entry);
        if (classification.quality === "fallback") audit.fallbackDiagrams.push(entry);
        return;
      }

      const paragraphBlocks = blocks.filter((b) => b.type === "paragraph");
      const wordCount = paragraphBlocks.reduce((sum, b) => sum + countWords(b.text), 0);
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

      if (wordCount === 0 && blocks.length === 0) {
        audit.emptyTextPages.push({ pageNum, chapterIndex: chapterIndex + 1, chapterTitle: chapter.title });
      } else if (fillRatio < 0.45 && wordCount > 0) {
        audit.shortTextPages.push({
          pageNum,
          chapterIndex: chapterIndex + 1,
          chapterTitle: chapter.title,
          wordCount,
          lineEstimate,
          usableLines,
          fillPercent: Math.round(fillRatio * 100),
          lastParagraph: paragraphBlocks.at(-1)?.text?.slice(-120) || "",
        });
      }
    });

    const blocks = parseKdpMarkdownBlocks(content);
    blocks.forEach((block, blockIndex) => {
      if (block.type !== "paragraph") return;
      const text = block.text || "";
      const looksLikeDiagram =
        /[→↓│├└┌]/.test(text) ||
        (/^\s*\d+\.\s+/m.test(text) && text.split("\n").length >= 3) ||
        (/^\s*[-*]\s+/m.test(text) && /:\s/.test(text) && text.split("\n").length >= 4);

      if (!looksLikeDiagram) return;

      const prev = blocks[blockIndex - 1];
      const next = blocks[blockIndex + 1];
      if (prev?.type === "fence" || next?.type === "fence") return;

      audit.unfencedDiagramCandidates.push({
        chapterIndex: chapterIndex + 1,
        chapterTitle: chapter.title,
        snippet: text.slice(0, 160),
      });
    });
  });

  audit.totalInteriorPages = interiorPageNumber;

  console.log(JSON.stringify(audit, null, 2));
  console.log("\n--- SUMMARY ---");
  console.log(`Book: ${audit.bookTitle}`);
  console.log(`Diagram pages: ${audit.diagramPages.length}`);
  console.log(`  Good (styled): ${audit.diagramPages.filter((d) => d.quality === "good").length}`);
  console.log(`  Fallback (pre/ASCII): ${audit.fallbackDiagrams.length}`);
  console.log(`  Poor (code language): ${audit.poorDiagrams.length}`);
  console.log(`Short text pages (<45% fill): ${audit.shortTextPages.length}`);
  console.log(`Unfenced diagram candidates: ${audit.unfencedDiagramCandidates.length}`);

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
