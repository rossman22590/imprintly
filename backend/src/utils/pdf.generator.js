const PDFDocument = require("pdfkit");
const MarkdownIt = require("markdown-it");
const {
  collectInlineImages,
  getChapterMarkdownForExport,
  inlineTextWithoutImages,
  normalizeMarkdownForExport,
  prepareExportImages,
  resolveExportImagePath,
} = require("./export-markdown");
const { getBookTypeFamily } = require("./book-type-guidance");
const { extractChildrenSpreadParts } = require("./children-spread-content");
const { splitKdpMarkdownIntoPages } = require("./kdp-markdown-blocks");

const md = new MarkdownIt();

const CHILDREN_IMAGE_PAGE_TEXT = {
  minWords: 35,
  maxWords: 80,
  minFollowupWords: 28,
};

const PDF_CONFIG = {
  fonts: {
    heading: "Times-Bold",
    body: "Times-Roman",
    bodyBold: "Times-Bold",
    bodyItalic: "Times-Italic",
    code: "Courier",
  },
  sizes: {
    title: 32,
    subtitle: 20,
    author: 16,
    chapterTitle: 24,
    h1: 18,
    h2: 16,
    h3: 14,
    body: 11,
    code: 9,
    pageNumber: 9,
  },
  colors: {
    title: "#1a202c",
    subtitle: "#4a5568",
    author: "#2d3748",
    chapterTitle: "#1a202c",
    heading: "#1a202c",
    body: "#000000",
    code: "#d63384",
    codeBlock: "#0f172a",
    codeBg: "#f8fafc",
    codeBorder: "#cbd5e1",
    pageNumber: "#64748b",
  },
  margins: {
    top: 72,
    bottom: 72,
    left: 72,
    right: 72,
  },
  spacing: {
    paragraphGap: 0,
    chapterGap: 40,
    headingGap: 20,
    listItemGap: 8,
    lineHeight: 1.42,
  },
  typography: {
    firstLineIndentRatio: 1.35,
    bodyLineGapRatio: 0.18,
    paragraphAfter: 0.08,
  },
  list: {
    bulletIndent: 20, // Distance from left margin to bullet
    textIndent: 35, // Distance from left margin to text (bullet + spacing)
  },
};

const KDP_TRIM_SIZES = {
  "5x8": [5 * 72, 8 * 72],
  "5.25x8": [5.25 * 72, 8 * 72],
  "5.5x8.5": [5.5 * 72, 8.5 * 72],
  "6x9": [6 * 72, 9 * 72],
  "7x10": [7 * 72, 10 * 72],
  "8.5x11": [8.5 * 72, 11 * 72],
};

const KDP_GUTTER_RULES = [
  { maxPages: 150, gutter: 0.375 },
  { maxPages: 300, gutter: 0.5 },
  { maxPages: 500, gutter: 0.625 },
  { maxPages: 700, gutter: 0.75 },
  { maxPages: 828, gutter: 0.875 },
];

const PRINT_AVERAGE_CHAR_WIDTH_RATIO = 0.45;
const PRINT_PAGE_LINE_SAFETY = 2;
const MAX_KDP_FONT_SIZE = 32;

function normalizeKdpFontSize(value) {
  const size = Number.parseFloat(value);

  if (!Number.isFinite(size)) return 12;

  return Math.min(MAX_KDP_FONT_SIZE, Math.max(9, size));
}

function normalizeKdpMeasurement(value, fallback, min, max = 2) {
  const size = Number.parseFloat(value);

  if (!Number.isFinite(size)) return fallback;

  return Math.min(max, Math.max(min, size));
}

function normalizeKdpLineSpacing(value) {
  return normalizeKdpMeasurement(value, 1.44, 1.15, 1.8);
}

function normalizeKdpParagraphIndent(value) {
  return normalizeKdpMeasurement(value, 1.35, 0, 2.25);
}

function usesKdpInteriorBleed(settings = {}) {
  return settings.interiorBleed === "bleed";
}

function roundToEvenPageCount(value) {
  const pageCount = Math.max(1, Math.ceil(value));

  return pageCount % 2 === 0 ? pageCount : pageCount + 1;
}

function getKdpPageSize(book = {}) {
  const trimPageSize = getKdpTrimPageSize(book);
  const hasBleed = usesKdpInteriorBleed(book?.kdp?.settings || {});

  if (!hasBleed) return trimPageSize;

  return [trimPageSize[0] + 0.125 * 72, trimPageSize[1] + 0.25 * 72];
}

function getKdpTrimPageSize(book = {}) {
  const trimSize = book?.kdp?.settings?.trimSize || "6x9";

  return KDP_TRIM_SIZES[trimSize] || KDP_TRIM_SIZES["6x9"];
}

function getKdpGutterMinimum(pageCount = 24) {
  const normalizedPageCount = Math.max(24, Number(pageCount) || 24);

  return (
    KDP_GUTTER_RULES.find((rule) => normalizedPageCount <= rule.maxPages)
      ?.gutter || KDP_GUTTER_RULES[KDP_GUTTER_RULES.length - 1].gutter
  );
}

function getKdpMarginSpec(
  pageSize = KDP_TRIM_SIZES["6x9"],
  pageCount = 24,
  settings = {}
) {
  const [width, height] = pageSize;
  const trimWidth = width / 72;
  const trimHeight = height / 72;
  const compactTrim = trimWidth <= 5.5 || trimHeight <= 8;
  const gutterMinimum = getKdpGutterMinimum(pageCount);
  const outsideMinimum = usesKdpInteriorBleed(settings) ? 0.375 : 0.25;
  const baseMargins = compactTrim
    ? { top: 0.68, bottom: 0.78, inside: 0.78, outside: 0.58 }
    : { top: 0.78, bottom: 0.88, inside: 0.9, outside: 0.68 };

  return {
    top: normalizeKdpMeasurement(settings.marginTop, baseMargins.top, outsideMinimum),
    bottom: normalizeKdpMeasurement(
      settings.marginBottom,
      baseMargins.bottom,
      outsideMinimum
    ),
    inside: normalizeKdpMeasurement(
      settings.marginInside,
      Math.max(gutterMinimum + 0.2, baseMargins.inside),
      gutterMinimum
    ),
    outside: normalizeKdpMeasurement(
      settings.marginOutside,
      Math.max(outsideMinimum, baseMargins.outside),
      outsideMinimum
    ),
    gutterMinimum,
    outsideMinimum,
  };
}

function getKdpTextPageMetrics(
  pageSize,
  fontSize,
  marginSpec,
  lineSpacing = 1.44,
  paragraphIndentRatio = PDF_CONFIG.typography.firstLineIndentRatio
) {
  const trimWidth = pageSize[0] / 72;
  const trimHeight = pageSize[1] / 72;
  const textArea = Math.max(
    8,
    (trimWidth - marginSpec.inside - marginSpec.outside) *
      (trimHeight - marginSpec.top - marginSpec.bottom)
  );
  const densityAt12pt = 8.95;
  const fontScale = Math.pow(12 / fontSize, 1.82);
  const contentWidth = Math.max(2, trimWidth - marginSpec.inside - marginSpec.outside);
  const contentHeight = Math.max(3, trimHeight - marginSpec.top - marginSpec.bottom);
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
    Math.floor(
      (contentWidth * 72) / (fontSize * PRINT_AVERAGE_CHAR_WIDTH_RATIO)
    )
  );

  return {
    charsPerLine,
    effectiveLineSpacing,
    font: PDF_CONFIG.fonts.body,
    fontSize,
    lineHeightPoints: effectiveLineHeightInches * 72,
    lineWidthPoints: contentWidth * 72,
    linesPerPage,
    paragraphIndentPoints: fontSize * paragraphIndentRatio,
    paragraphIndentRatio,
    renderLineBuffer: 2,
    wordsPerPage: Math.max(
      70,
      Math.round(textArea * densityAt12pt * fontScale * lineScale)
    ),
  };
}

function getKdpWordsPerPage(pageSize, fontSize, marginSpec, lineSpacing = 1.44) {
  return getKdpTextPageMetrics(
    pageSize,
    fontSize,
    marginSpec,
    lineSpacing
  ).wordsPerPage;
}

function getKdpTocEntriesPerPage(pageSize, fontSize, marginSpec) {
  const trimHeight = pageSize[1] / 72;
  const usableHeight = Math.max(4, trimHeight - marginSpec.top - marginSpec.bottom);
  const reservedHeaderHeight = 0.85;
  const entryHeight = Math.max(0.17, (fontSize / 72) * 1.35);

  return Math.max(
    12,
    Math.floor((usableHeight - reservedHeaderHeight) / entryHeight)
  );
}

function getKdpTocPageCount(chapters, pageSize, fontSize, marginSpec) {
  return Math.max(
    1,
    Math.ceil(
      Math.max(1, chapters.length) /
        getKdpTocEntriesPerPage(pageSize, fontSize, marginSpec)
    )
  );
}

function getPlainWordCount(value = "") {
  return stripInlineMarkdown(value)
    .replace(/\s+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function getMarkdownImageBlocks(value = "") {
  return md
    .parse(normalizeMarkdownForExport(value), {})
    .flatMap((token) => collectInlineImages(token))
    .map((image) => ({
      alt: image.alt || "Chapter illustration",
      src: image.src,
    }))
    .filter((image) => image.src);
}

function normalizeKdpTextPageMetrics(metricsOrWordsPerPage = 220) {
  if (
    metricsOrWordsPerPage &&
    typeof metricsOrWordsPerPage === "object" &&
    Number.isFinite(metricsOrWordsPerPage.linesPerPage) &&
    Number.isFinite(metricsOrWordsPerPage.charsPerLine)
  ) {
    return metricsOrWordsPerPage;
  }

  const wordsPerPage = Math.max(70, Number(metricsOrWordsPerPage) || 220);

  return {
    charsPerLine: 54,
    linesPerPage: Math.max(10, Math.round(wordsPerPage / 9.2)),
    wordsPerPage,
  };
}

function getKdpChapterOpeningReserveLines(textMetrics) {
  return Math.max(5, Math.floor(textMetrics.linesPerPage * 0.14));
}

let kdpMeasureDoc;
const kdpWordWidthCache = new Map();

function getKdpMeasureDoc() {
  if (!kdpMeasureDoc) {
    kdpMeasureDoc = new PDFDocument({ autoFirstPage: false });
  }

  return kdpMeasureDoc;
}

function getKdpMeasuredTokenWidth(token, font, fontSize) {
  const cacheKey = `${font}:${fontSize}:${token}`;

  if (kdpWordWidthCache.has(cacheKey)) {
    return kdpWordWidthCache.get(cacheKey);
  }

  const doc = getKdpMeasureDoc();
  doc.font(font).fontSize(fontSize);

  const width = doc.widthOfString(token);

  if (kdpWordWidthCache.size > 12000) {
    kdpWordWidthCache.clear();
  }

  kdpWordWidthCache.set(cacheKey, width);

  return width;
}

function estimateMeasuredKdpTextLines(normalized, textMetrics, options = {}) {
  const font = textMetrics.font || PDF_CONFIG.fonts.body;
  const fontSize = Number(textMetrics.fontSize);
  const lineWidth = Number(textMetrics.lineWidthPoints);

  if (!Number.isFinite(fontSize) || !Number.isFinite(lineWidth)) return null;

  const words = normalized.split(/\s+/).filter(Boolean);

  if (!words.length) return 0;

  const spaceWidth = getKdpMeasuredTokenWidth(" ", font, fontSize);

  if (!Number.isFinite(spaceWidth)) return null;

  const indentWidth = options.continuation
    ? 0
    : Number(textMetrics.paragraphIndentPoints) ||
      fontSize *
        (Number(textMetrics.paragraphIndentRatio) ||
          PDF_CONFIG.typography.firstLineIndentRatio);
  let lineCount = 1;
  let lineLimit = Math.max(fontSize * 2, lineWidth - indentWidth);
  let currentLineWidth = 0;

  for (const word of words) {
    const wordWidth = getKdpMeasuredTokenWidth(word, font, fontSize);

    if (!Number.isFinite(wordWidth)) return null;

    if (currentLineWidth === 0) {
      currentLineWidth = wordWidth;
      continue;
    }

    if (currentLineWidth + spaceWidth + wordWidth <= lineLimit) {
      currentLineWidth += spaceWidth + wordWidth;
      continue;
    }

    lineCount += 1;
    lineLimit = lineWidth;
    currentLineWidth = wordWidth;
  }

  return Math.max(1, lineCount);
}

function estimateKdpTextLines(text = "", textMetrics, options = {}) {
  const normalized = String(text || "").trim();

  if (!normalized) return 0;

  const measuredLineCount = estimateMeasuredKdpTextLines(
    normalized,
    textMetrics,
    options
  );

  if (Number.isFinite(measuredLineCount)) {
    return measuredLineCount;
  }

  const indentCharacters = options.continuation
    ? 0
    : Math.ceil(
        (Number(textMetrics.paragraphIndentRatio) ||
          PDF_CONFIG.typography.firstLineIndentRatio) /
          PRINT_AVERAGE_CHAR_WIDTH_RATIO
      );
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

function splitKdpTextIntoPrintPages(
  text = "",
  metricsOrWordsPerPage = 220,
  options = {}
) {
  const textMetrics = normalizeKdpTextPageMetrics(metricsOrWordsPerPage);

  return splitKdpMarkdownIntoPages(
    text,
    textMetrics,
    options,
    estimateKdpTextLines
  );
}

function estimateKdpTextPageCount(text = "", textMetrics = 220, options = {}) {
  return splitKdpTextIntoPrintPages(text, textMetrics, options).length;
}

function getKdpFrontMatterPageCount(book = {}, tocPageCount = 1) {
  const chapters = Array.isArray(book?.chapters) ? book.chapters : [];
  const hasCopyrightPage = String(book?.kdp?.assets?.copyrightPage || "").trim();
  const basePageCount = 1 + (hasCopyrightPage ? 1 : 0) + tocPageCount;
  const rectoBlankPage =
    chapters.length && (basePageCount + 1) % 2 === 0 ? 1 : 0;

  return basePageCount + rectoBlankPage;
}

function estimateKdpChapterPageCount(chapter, textMetrics) {
  const normalizedMetrics = normalizeKdpTextPageMetrics(textMetrics);
  const markdown = getChapterMarkdownForExport(chapter);
  const imagePageCount = getMarkdownImageBlocks(markdown).length;

  return (
    imagePageCount +
    estimateKdpTextPageCount(markdown, normalizedMetrics, {
      firstPageReserveLines: imagePageCount
        ? 0
        : getKdpChapterOpeningReserveLines(normalizedMetrics),
    })
  );
}

function estimateKdpInteriorPageCount(book = {}, pageSize, fontSize) {
  const override = Number.parseInt(book?.kdp?.settings?.pageCountOverride, 10);
  const chapters = Array.isArray(book?.chapters) ? book.chapters : [];
  const settings = book?.kdp?.settings || {};
  const lineSpacing = normalizeKdpLineSpacing(settings.lineSpacing);
  const paragraphIndent = normalizeKdpParagraphIndent(settings.paragraphIndent);
  let pageCount = 120;

  for (let index = 0; index < 5; index += 1) {
    const marginSpec = getKdpMarginSpec(pageSize, pageCount, settings);
    const textMetrics = getKdpTextPageMetrics(
      pageSize,
      fontSize,
      marginSpec,
      lineSpacing,
      paragraphIndent
    );
    const tocPageCount = getKdpTocPageCount(
      chapters,
      pageSize,
      fontSize,
      marginSpec
    );
    const frontMatterPages = getKdpFrontMatterPageCount(book, tocPageCount);
    const chapterPages = chapters.reduce((sum, chapter) => {
      return sum + estimateKdpChapterPageCount(chapter, textMetrics);
    }, 0);

    pageCount = roundToEvenPageCount(frontMatterPages + chapterPages);
  }

  return Number.isFinite(override) && override > pageCount
    ? roundToEvenPageCount(override)
    : pageCount;
}

function getKdpMargins(
  pageSize = KDP_TRIM_SIZES["6x9"],
  pageCount = 24,
  settings = {}
) {
  const marginSpec = getKdpMarginSpec(pageSize, pageCount, settings);

  return {
    top: marginSpec.top * 72,
    bottom: marginSpec.bottom * 72,
    left: marginSpec.inside * 72,
    right: marginSpec.outside * 72,
    inside: marginSpec.inside * 72,
    outside: marginSpec.outside * 72,
    gutterMinimum: marginSpec.gutterMinimum * 72,
    outsideMinimum: marginSpec.outsideMinimum * 72,
  };
}

function getKdpPdfConfig(book = {}) {
  const settings = book?.kdp?.settings || {};
  const bodySize = normalizeKdpFontSize(book?.kdp?.settings?.fontSize);
  const lineSpacing = normalizeKdpLineSpacing(settings.lineSpacing);
  const paragraphIndent = normalizeKdpParagraphIndent(settings.paragraphIndent);
  const scale = bodySize / PDF_CONFIG.sizes.body;
  const trimPageSize = getKdpTrimPageSize(book);
  const pageSize = getKdpPageSize(book);
  const pageCount = estimateKdpInteriorPageCount(book, trimPageSize, bodySize);
  const marginSpec = getKdpMarginSpec(trimPageSize, pageCount, settings);
  const textMetrics = getKdpTextPageMetrics(
    trimPageSize,
    bodySize,
    marginSpec,
    lineSpacing,
    paragraphIndent
  );
  const effectiveLineSpacing = textMetrics.effectiveLineSpacing || lineSpacing;
  const chapters = Array.isArray(book?.chapters) ? book.chapters : [];
  const tocEntriesPerPage = getKdpTocEntriesPerPage(
    pageSize,
    bodySize,
    marginSpec
  );
  const tocPageCount = getKdpTocPageCount(
    chapters,
    pageSize,
    bodySize,
    marginSpec
  );
  return {
    bookTypeFamily: getBookTypeFamily(book.genre),
    hasBleed: usesKdpInteriorBleed(settings),
    margins: getKdpMargins(trimPageSize, pageCount, settings),
    pageCount,
    pageSize,
    trimPageSize,
    folioStartPageNumber: getKdpFrontMatterPageCount(book, tocPageCount) + 1,
    tocEntriesPerPage,
    tocPageCount,
    sizes: {
      ...PDF_CONFIG.sizes,
      title: Math.max(24, Math.round(32 * Math.min(scale, 1.18))),
      subtitle: Math.max(16, Math.round(20 * Math.min(scale, 1.12))),
      author: Math.max(13, Math.round(16 * Math.min(scale, 1.08))),
      chapterTitle: Math.max(15, Math.round(bodySize * 1.25)),
      h1: Math.max(16, Math.round(bodySize * 1.55)),
      h2: Math.max(14, Math.round(bodySize * 1.35)),
      h3: Math.max(13, Math.round(bodySize * 1.18)),
      body: bodySize,
      code: Math.max(7.5, bodySize - 2),
      pageNumber: Math.max(9, bodySize - 1.5),
    },
    typography: {
      ...PDF_CONFIG.typography,
      bodyLineGapRatio: Math.max(0, effectiveLineSpacing - 1.26),
      firstLineIndentRatio: paragraphIndent,
      lineSpacing: effectiveLineSpacing,
    },
  };
}

function applyPdfRuntimeConfig(runtimeConfig) {
  const previous = {
    margins: { ...PDF_CONFIG.margins },
    sizes: { ...PDF_CONFIG.sizes },
    typography: { ...PDF_CONFIG.typography },
  };

  Object.assign(PDF_CONFIG.margins, runtimeConfig.margins);
  Object.assign(PDF_CONFIG.sizes, runtimeConfig.sizes);
  Object.assign(PDF_CONFIG.typography, runtimeConfig.typography);

  return () => {
    Object.keys(PDF_CONFIG.margins).forEach((key) => {
      if (!(key in previous.margins)) delete PDF_CONFIG.margins[key];
    });
    Object.assign(PDF_CONFIG.margins, previous.margins);
    Object.assign(PDF_CONFIG.sizes, previous.sizes);
    Object.assign(PDF_CONFIG.typography, previous.typography);
  };
}

function getKdpInteriorPageMargins(runtimeConfig, interiorPageNumber = 1) {
  const isRightHandPage = interiorPageNumber % 2 === 1;
  const { margins } = runtimeConfig;
  const bleedEdge = runtimeConfig.hasBleed ? 0.125 * 72 : 0;

  return {
    top: margins.top + bleedEdge,
    bottom: margins.bottom + bleedEdge,
    left: isRightHandPage ? margins.inside : margins.outside + bleedEdge,
    right: isRightHandPage ? margins.outside + bleedEdge : margins.inside,
  };
}

function setPdfCurrentMargins(doc, margins) {
  Object.assign(PDF_CONFIG.margins, margins);

  if (doc.page) {
    doc.page.margins = { ...margins };
    doc.x = margins.left;
    doc.y = margins.top;
  }
}

function configureKdpInteriorPagination(doc, runtimeConfig, interiorPageNumber = 1) {
  const originalAddPage = doc.addPage.bind(doc);

  doc._kdpInteriorPageNumber = interiorPageNumber;
  setPdfCurrentMargins(
    doc,
    getKdpInteriorPageMargins(runtimeConfig, doc._kdpInteriorPageNumber)
  );

  doc.addPage = (options = {}) => {
    doc._kdpInteriorPageNumber += 1;
    const margins = getKdpInteriorPageMargins(
      runtimeConfig,
      doc._kdpInteriorPageNumber
    );
    const result = originalAddPage({
      ...options,
      size: options.size || runtimeConfig.pageSize,
      margins,
    });
    setPdfCurrentMargins(doc, margins);

    return result;
  };

  return originalAddPage;
}

function shouldRenderKdpFolio(interiorPageNumber, runtimeConfig) {
  return interiorPageNumber >= (runtimeConfig.folioStartPageNumber || 1);
}

function renderKdpPageFolios(doc, runtimeConfig, firstInteriorPageIndex = 0) {
  if (typeof doc.bufferedPageRange !== "function") return;

  const range = doc.bufferedPageRange();
  const end = range.start + range.count;

  for (
    let pageIndex = Math.max(range.start, firstInteriorPageIndex);
    pageIndex < end;
    pageIndex += 1
  ) {
    const interiorPageNumber = pageIndex - firstInteriorPageIndex + 1;

    if (!shouldRenderKdpFolio(interiorPageNumber, runtimeConfig)) continue;

    const margins = getKdpInteriorPageMargins(runtimeConfig, interiorPageNumber);
    const contentWidth = runtimeConfig.pageSize[0] - margins.left - margins.right;
    const footerY =
      runtimeConfig.pageSize[1] - Math.max(28, margins.bottom * 0.52);

    doc.switchToPage(pageIndex);
    const previousPageMargins = { ...doc.page.margins };
    const previousX = doc.x;
    const previousY = doc.y;
    doc.page.margins = {
      ...doc.page.margins,
      bottom: -10000,
    };
    doc
      .font(PDF_CONFIG.fonts.body)
      .fontSize(PDF_CONFIG.sizes.pageNumber)
      .fillColor(PDF_CONFIG.colors.pageNumber)
      .text(String(interiorPageNumber), margins.left, footerY, {
        align: "center",
        height: PDF_CONFIG.sizes.pageNumber * 2,
        lineBreak: false,
        width: contentWidth,
      });
    doc.page.margins = previousPageMargins;
    doc.x = previousX;
    doc.y = previousY;
  }

  if (end > range.start) {
    doc.switchToPage(end - 1);
  }
}

function getKdpRuntimeTextMetrics(runtimeConfig) {
  const marginSpec = {
    top: runtimeConfig.margins.top / 72,
    bottom: runtimeConfig.margins.bottom / 72,
    inside: runtimeConfig.margins.inside / 72,
    outside: runtimeConfig.margins.outside / 72,
  };
  return getKdpTextPageMetrics(
    runtimeConfig.trimPageSize || runtimeConfig.pageSize,
    runtimeConfig.sizes.body,
    marginSpec,
    runtimeConfig.typography?.lineSpacing || 1.44,
    runtimeConfig.typography?.firstLineIndentRatio ||
      PDF_CONFIG.typography.firstLineIndentRatio
  );
}

function getKdpRuntimeWordsPerPage(runtimeConfig) {
  return getKdpRuntimeTextMetrics(runtimeConfig).wordsPerPage;
}

function getChapterPrintPageEstimate(chapter, runtimeConfig) {
  const textMetrics = getKdpRuntimeTextMetrics(runtimeConfig);

  return estimateKdpChapterPageCount(chapter, textMetrics);
}

function buildKdpTocEntries(book = {}, runtimeConfig) {
  const chapters = Array.isArray(book?.chapters) ? book.chapters : [];
  let nextPageNumber = runtimeConfig.folioStartPageNumber || 3;

  return chapters.map((chapter, index) => {
    const entry = {
      chapterLabel: `Chapter ${index + 1}`,
      pageNumber: nextPageNumber,
      title: chapter.title || `Chapter ${index + 1}`,
    };
    nextPageNumber += getChapterPrintPageEstimate(chapter, runtimeConfig);

    return entry;
  });
}

function wrapKdpFixedLines(text = "", textMetrics, options = {}) {
  const normalized = String(text || "").trim();

  if (!normalized) return [];

  const font = textMetrics.font || PDF_CONFIG.fonts.body;
  const fontSize = Number(textMetrics.fontSize) || PDF_CONFIG.sizes.body;
  const lineWidth = Number(textMetrics.lineWidthPoints) || 300;
  const blockquoteIndent = options.blockquote ? fontSize * 1.1 : 0;
  const indentWidth = options.continuation
    ? blockquoteIndent
    : blockquoteIndent +
      (Number(textMetrics.paragraphIndentPoints) ||
        fontSize * PDF_CONFIG.typography.firstLineIndentRatio);
  const spaceWidth = getKdpMeasuredTokenWidth(" ", font, fontSize);
  const words = normalized.split(/\s+/).filter(Boolean);
  const lines = [];
  let currentWords = [];
  let currentWidth = 0;
  let lineIndent = indentWidth;
  let lineLimit = Math.max(fontSize * 2, lineWidth - lineIndent);

  const flushLine = () => {
    if (!currentWords.length) return;

    lines.push({
      indent: lineIndent,
      limit: lineLimit,
      text: currentWords.join(" "),
      width: currentWidth,
    });
    currentWords = [];
    currentWidth = 0;
    lineIndent = blockquoteIndent;
    lineLimit = Math.max(fontSize * 2, lineWidth - lineIndent);
  };

  words.forEach((word) => {
    const wordWidth = getKdpMeasuredTokenWidth(word, font, fontSize);

    if (!currentWords.length) {
      currentWords = [word];
      currentWidth = wordWidth;
      return;
    }

    if (currentWidth + spaceWidth + wordWidth <= lineLimit) {
      currentWords.push(word);
      currentWidth += spaceWidth + wordWidth;
      return;
    }

    flushLine();
    currentWords = [word];
    currentWidth = wordWidth;
  });

  flushLine();

  return lines;
}

function renderKdpFixedBodyParagraph(doc, text = "", textMetrics, options = {}) {
  const lines = wrapKdpFixedLines(text, textMetrics, options);

  if (!lines.length) return;

  const font = textMetrics.font || PDF_CONFIG.fonts.body;
  const fontSize = Number(textMetrics.fontSize) || PDF_CONFIG.sizes.body;
  const lineHeight =
    Number(textMetrics.lineHeightPoints) ||
    fontSize * (PDF_CONFIG.typography.lineSpacing || 1.42);
  const x = PDF_CONFIG.margins.left;
  let y = doc.y;

  doc.font(font).fontSize(fontSize).fillColor(PDF_CONFIG.colors.body);

  lines.forEach((line, index) => {
    const isLastLine = index === lines.length - 1;
    const words = line.text.split(/\s+/).filter(Boolean);
    const spaceCount = Math.max(0, words.length - 1);
    const wordWidths = words.map((word) =>
      getKdpMeasuredTokenWidth(word, font, fontSize)
    );
    const totalWordWidth = wordWidths.reduce((sum, width) => sum + width, 0);
    const naturalSpaceWidth = getKdpMeasuredTokenWidth(" ", font, fontSize);
    const justifiedSpaceWidth =
      !isLastLine && spaceCount
        ? Math.max(
            naturalSpaceWidth,
            (line.limit - totalWordWidth) / spaceCount
          )
        : naturalSpaceWidth;
    const previousMargins = { ...doc.page.margins };
    const previousX = doc.x;
    const previousY = doc.y;
    let cursorX = x + line.indent;

    doc.page.margins = { ...doc.page.margins, bottom: -10000 };

    words.forEach((word, wordIndex) => {
      doc.text(word, cursorX, y, {
        height: lineHeight,
        lineBreak: false,
        width: wordWidths[wordIndex] + fontSize,
      });
      cursorX +=
        wordWidths[wordIndex] +
        (wordIndex < words.length - 1 ? justifiedSpaceWidth : 0);
    });

    doc.page.margins = previousMargins;
    doc.x = previousX;
    doc.y = previousY;
    y += lineHeight;
  });

  doc.y = y;
}

function renderKdpDedicatedDiagramPage(doc, block) {
  const caption = String(block.label || "").trim();
  const originalLines = String(block.content || "")
    .replace(/\n$/, "")
    .split("\n");
  const language = String(block.language || "").trim();
  const contentWidth = getContentWidth(doc);
  const pageTop = PDF_CONFIG.margins.top + 20;

  doc.y = pageTop;

  if (caption) {
    doc
      .font(PDF_CONFIG.fonts.bodyItalic)
      .fontSize(Math.max(10, PDF_CONFIG.sizes.body - 1))
      .fillColor(PDF_CONFIG.colors.subtitle)
      .text(caption, PDF_CONFIG.margins.left, doc.y, {
        width: contentWidth,
        align: "center",
      });

    doc.y += 30;
  }

  if (!renderSemanticDiagram(doc, originalLines, language)) {
    renderPreformattedDiagram(doc, originalLines);
  }
}

function renderKdpChapterImagePage(
  doc,
  chapter,
  chapterIndex,
  image,
  imageIndex,
  textMetrics
) {
  doc.addPage();

  const chapterLabel = `Chapter ${chapterIndex + 1}`;

  if (imageIndex === 0) {
    doc
      .font(PDF_CONFIG.fonts.heading)
      .fontSize(Math.max(10, PDF_CONFIG.sizes.body - 1))
      .fillColor(PDF_CONFIG.colors.pageNumber)
      .text(chapterLabel, { align: "center" });

    doc.moveDown(0.45);

    doc
      .font(PDF_CONFIG.fonts.heading)
      .fontSize(PDF_CONFIG.sizes.chapterTitle)
      .fillColor(PDF_CONFIG.colors.chapterTitle)
      .text(chapter.title || chapterLabel, { align: "center" });

    doc.moveDown(0.8);
  }

  const imagePath = resolveExportImagePath(image.src);
  const contentWidth =
    doc.page.width - PDF_CONFIG.margins.left - PDF_CONFIG.margins.right;
  const footerReserve = PDF_CONFIG.sizes.pageNumber * 2.5;
  const imageTop = doc.y;
  const imageHeight = Math.max(
    textMetrics.lineHeightPoints * 4,
    doc.page.height - imageTop - PDF_CONFIG.margins.bottom - footerReserve
  );

  if (imagePath) {
    doc.image(imagePath, PDF_CONFIG.margins.left, imageTop, {
      align: "center",
      fit: [contentWidth, imageHeight],
      valign: "center",
    });
    doc.y = imageTop + imageHeight;
    return;
  }

  doc
    .save()
    .roundedRect(PDF_CONFIG.margins.left, imageTop, contentWidth, imageHeight, 8)
    .stroke("#cbd5e1")
    .fillColor(PDF_CONFIG.colors.pageNumber)
    .font(PDF_CONFIG.fonts.bodyItalic)
    .fontSize(Math.max(9, PDF_CONFIG.sizes.body - 1))
    .text(image.alt || "Chapter illustration", PDF_CONFIG.margins.left, imageTop + imageHeight / 2 - 10, {
      align: "center",
      width: contentWidth,
    })
    .restore();
  doc.y = imageTop + imageHeight;
}

function renderKdpChapterPrintPages(doc, chapter, chapterIndex, runtimeConfig) {
  const textMetrics = getKdpRuntimeTextMetrics(runtimeConfig);
  const markdown = getChapterMarkdownForExport(chapter);
  const imageBlocks = getMarkdownImageBlocks(markdown);
  const firstPageReserveLines = imageBlocks.length
    ? 0
    : getKdpChapterOpeningReserveLines(textMetrics);
  const pages = splitKdpTextIntoPrintPages(
    markdown,
    textMetrics,
    {
      firstPageReserveLines,
    }
  );

  imageBlocks.forEach((image, imageIndex) => {
    renderKdpChapterImagePage(
      doc,
      chapter,
      chapterIndex,
      image,
      imageIndex,
      textMetrics
    );
  });

  let hasRenderedChapterHeader = imageBlocks.length > 0;

  pages.forEach((pageContent) => {
    doc.addPage();

    const pageBlocks = Array.isArray(pageContent.blocks)
      ? pageContent.blocks
      : (pageContent.paragraphs || []).map((paragraph) => {
          const paragraphText =
            typeof paragraph === "object" ? paragraph.text : paragraph;
          const isContinuation =
            typeof paragraph === "object" && paragraph.continuation;

          return {
            type: "paragraph",
            text: paragraphText,
            continuation: isContinuation,
          };
        });

    const isDiagramOnlyPage =
      pageBlocks.length === 1 && pageBlocks[0].type === "diagram";

    if (isDiagramOnlyPage) {
      renderKdpDedicatedDiagramPage(doc, pageBlocks[0]);
      return;
    }

    if (!hasRenderedChapterHeader) {
      doc
        .font(PDF_CONFIG.fonts.heading)
        .fontSize(Math.max(10, PDF_CONFIG.sizes.body - 1))
        .fillColor(PDF_CONFIG.colors.pageNumber)
        .text(`Chapter ${chapterIndex + 1}`, {
          align: "center",
        });

      doc.moveDown(0.5);

      doc
        .font(PDF_CONFIG.fonts.heading)
        .fontSize(PDF_CONFIG.sizes.chapterTitle)
        .fillColor(PDF_CONFIG.colors.chapterTitle)
        .text(chapter.title || `Chapter ${chapterIndex + 1}`, {
          align: "center",
        });

      doc.y = Math.max(
        doc.y + PDF_CONFIG.sizes.body * 0.55,
        PDF_CONFIG.margins.top + firstPageReserveLines * textMetrics.lineHeightPoints
      );
      hasRenderedChapterHeader = true;
    }

    pageBlocks.forEach((block) => {
      if (block.type === "diagram") {
        renderKdpDiagramBlock(doc, block, {
          inline: Boolean(block.inline) || pageBlocks.length > 1,
        });
        return;
      }

      if (block.type === "code") {
        renderCodeBlock(doc, {
          content: block.content,
          info: block.language || "",
        });
        return;
      }

      if (block.type === "heading") {
        const headingSizes = {
          1: PDF_CONFIG.sizes.h1,
          2: PDF_CONFIG.sizes.h2,
          3: PDF_CONFIG.sizes.h3,
          4: PDF_CONFIG.sizes.body + 1,
          5: PDF_CONFIG.sizes.body,
          6: PDF_CONFIG.sizes.body - 0.5,
        };

        doc
          .font(PDF_CONFIG.fonts.heading)
          .fontSize(headingSizes[block.level] || PDF_CONFIG.sizes.h3)
          .fillColor(PDF_CONFIG.colors.heading)
          .text(block.text || "", {
            align: "center",
            width: getContentWidth(doc),
          });
        doc.moveDown(0.45);
        return;
      }

      if (block.type === "blockquote") {
        renderKdpFixedBodyParagraph(doc, block.text || "", textMetrics, {
          continuation: Boolean(block.continuation),
          blockquote: true,
        });
        doc.moveDown(0.2);
        return;
      }

      if (block.type === "list") {
        (block.items || []).forEach((item, itemIndex) => {
          const marker = block.ordered ? `${itemIndex + 1}.` : "•";
          renderListItem(doc, marker, item);
        });
        doc.moveDown(0.2);
        return;
      }

      if (block.type === "table") {
        const header = block.header || [];
        const rows = block.rows || [];
        const columnCount = Math.max(
          header.length,
          ...rows.map((row) => row.length),
          1
        );
        const columnWidth = getContentWidth(doc) / columnCount;

        if (header.length) {
          header.forEach((cell, columnIndex) => {
            doc
              .font(PDF_CONFIG.fonts.heading)
              .fontSize(Math.max(9, PDF_CONFIG.sizes.body - 1))
              .fillColor(PDF_CONFIG.colors.heading)
              .text(cell || "", PDF_CONFIG.margins.left + columnIndex * columnWidth, doc.y, {
                width: columnWidth,
              });
          });
          doc.moveDown(0.55);
        }

        rows.forEach((row) => {
          row.forEach((cell, columnIndex) => {
            doc
              .font(PDF_CONFIG.fonts.body)
              .fontSize(PDF_CONFIG.sizes.body)
              .fillColor(PDF_CONFIG.colors.body)
              .text(cell || "", PDF_CONFIG.margins.left + columnIndex * columnWidth, doc.y, {
                width: columnWidth,
              });
          });
          doc.moveDown(0.35);
        });
        doc.moveDown(0.2);
        return;
      }

      renderKdpFixedBodyParagraph(doc, block.text || "", textMetrics, {
        continuation: Boolean(block.continuation),
      });
    });
  });
}

function renderKdpFrontMatterPage(doc, title, paragraphs = []) {
  doc
    .font(PDF_CONFIG.fonts.heading)
    .fontSize(PDF_CONFIG.sizes.h2)
    .fillColor(PDF_CONFIG.colors.heading)
    .text(title, { align: "center" });
  doc.moveDown(1.4);

  paragraphs.forEach((paragraph, index) => {
    renderTextBlock(doc, paragraph, {
      bodyParagraph: true,
      indent:
        index === 0
          ? 0
          : PDF_CONFIG.sizes.body * PDF_CONFIG.typography.firstLineIndentRatio,
    });
  });
}

function renderKdpTableOfContents(doc, entries, pageIndex = 0) {
  doc
    .font(PDF_CONFIG.fonts.heading)
    .fontSize(PDF_CONFIG.sizes.h2)
    .fillColor(PDF_CONFIG.colors.heading)
    .text("Contents", { align: "center" });
  doc.moveDown(1);

  const contentWidth = getContentWidth(doc);
  const labelWidth = Math.min(72, contentWidth * 0.26);
  const pageWidth = 34;
  const titleWidth = contentWidth - labelWidth - pageWidth - 16;
  const start = pageIndex * 1000;
  const rowHeight = Math.max(PDF_CONFIG.sizes.body * 1.35, 14);

  entries.forEach((entry, index) => {
    ensureSpace(doc, rowHeight + 2);

    const y = doc.y;
    doc
      .font(PDF_CONFIG.fonts.bodyBold)
      .fontSize(Math.max(8.5, PDF_CONFIG.sizes.body - 2))
      .fillColor(PDF_CONFIG.colors.pageNumber)
      .text(entry.chapterLabel, PDF_CONFIG.margins.left, y, {
        width: labelWidth,
        lineBreak: false,
      });

    doc
      .font(PDF_CONFIG.fonts.body)
      .fontSize(PDF_CONFIG.sizes.body)
      .fillColor(PDF_CONFIG.colors.body)
      .text(entry.title, PDF_CONFIG.margins.left + labelWidth + 8, y, {
        width: titleWidth,
        lineBreak: false,
      });

    doc
      .font(PDF_CONFIG.fonts.body)
      .fontSize(PDF_CONFIG.sizes.body)
      .fillColor(PDF_CONFIG.colors.body)
      .text(
        String(entry.pageNumber),
        PDF_CONFIG.margins.left + labelWidth + titleWidth + 16,
        y,
        {
          align: "right",
          width: pageWidth,
          lineBreak: false,
        }
      );

    doc.y = y + rowHeight;

    if (start + index < entries.length - 1) {
      doc
        .moveTo(PDF_CONFIG.margins.left + labelWidth + 8, doc.y - 4)
        .lineTo(PDF_CONFIG.margins.left + labelWidth + titleWidth + 10, doc.y - 4)
        .dash(1, { space: 3 })
        .stroke("#cbd5e1")
        .undash();
    }
  });
}

// Parse inline markdown with proper pattern priority
// Key fix: Bold (**) MUST come before italic (*) to avoid conflicts
function parseInlineMarkdown(text) {
  const segments = [];

  // Order matters! More specific patterns first
  const patterns = [
    { regex: /`([^`]+)`/g, type: "code" }, // Code first (most specific)
    { regex: /\*\*(.+?)\*\*/g, type: "bold" }, // Bold before italic!
    { regex: /__(.+?)__/g, type: "bold" }, // Alternative bold
    { regex: /\*(.+?)\*/g, type: "italic" }, // Italic after bold
    { regex: /_(.+?)_/g, type: "italic" }, // Alternative italic
  ];

  const matches = [];

  // Find all matches from all patterns
  patterns.forEach((pattern) => {
    let match;
    const regex = new RegExp(pattern.regex.source, "g");

    while ((match = regex.exec(text)) !== null) {
      matches.push({
        start: match.index,
        end: regex.lastIndex,
        text: match[1],
        type: pattern.type,
      });
    }
  });

  // Sort matches by position to process them in order
  matches.sort((a, b) => a.start - b.start);

  // Remove overlapping matches (keep first match when conflicts occur)
  const filteredMatches = [];
  let lastEnd = 0;

  matches.forEach((match) => {
    if (match.start >= lastEnd) {
      filteredMatches.push(match);
      lastEnd = match.end;
    }
  });

  // Build segments with plain text and styled text
  let processedUntil = 0;

  filteredMatches.forEach((match) => {
    // Add plain text before this match
    if (match.start > processedUntil) {
      segments.push({
        text: text.substring(processedUntil, match.start),
        type: "plain",
      });
    }

    // Add styled text
    segments.push({
      text: match.text,
      type: match.type,
    });

    processedUntil = match.end;
  });

  // Add remaining plain text
  if (processedUntil < text.length) {
    segments.push({
      text: text.substring(processedUntil),
      type: "plain",
    });
  }

  return segments.length > 0 ? segments : [{ text, type: "plain" }];
}

// Render styled text segments (used for paragraphs and list items)
function renderStyledText(
  doc,
  segments,
  startX = null,
  startY = null,
  options = {}
) {
  const defaultOptions = {
    width: doc.page.width - PDF_CONFIG.margins.left - PDF_CONFIG.margins.right,
    ...options,
  };

  let firstSegment = true;

  segments.forEach((segment, index) => {
    // Set font based on segment type
    switch (segment.type) {
      case "code":
        doc
          .font(PDF_CONFIG.fonts.code)
          .fontSize(PDF_CONFIG.sizes.code)
          .fillColor(PDF_CONFIG.colors.code);
        break;
      case "bold":
        doc
          .font(PDF_CONFIG.fonts.bodyBold)
          .fontSize(PDF_CONFIG.sizes.body)
          .fillColor(PDF_CONFIG.colors.body);
        break;
      case "italic":
        doc
          .font(PDF_CONFIG.fonts.bodyItalic)
          .fontSize(PDF_CONFIG.sizes.body)
          .fillColor(PDF_CONFIG.colors.body);
        break;
      default:
        doc
          .font(PDF_CONFIG.fonts.body)
          .fontSize(PDF_CONFIG.sizes.body)
          .fillColor(PDF_CONFIG.colors.body);
    }

    // First segment can set position if startX/startY provided
    if (firstSegment && startX !== null && startY !== null) {
      doc.text(segment.text, startX, startY, {
        ...defaultOptions,
        continued: index < segments.length - 1,
      });
      firstSegment = false;
    } else if (firstSegment && startX !== null) {
      // Only X position provided (used in lists where Y is already set)
      doc.text(segment.text, startX, doc.y, {
        ...defaultOptions,
        continued: index < segments.length - 1,
      });
      firstSegment = false;
    } else {
      // Subsequent segments continue naturally
      doc.text(segment.text, {
        continued: index < segments.length - 1,
      });
    }
  });
}

function fitImage(doc, imagePath, maxWidth, maxHeight) {
  const image = doc.openImage(imagePath);
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);

  return {
    width: image.width * scale,
    height: image.height * scale,
  };
}

function fitImageAllowUpscale(doc, imagePath, maxWidth, maxHeight) {
  const image = doc.openImage(imagePath);
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height);

  return {
    width: image.width * scale,
    height: image.height * scale,
  };
}

function getCoverImagePlacement(pageWidth, pageHeight, imageWidth, imageHeight) {
  const scale = Math.max(pageWidth / imageWidth, pageHeight / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;

  return {
    x: (pageWidth - width) / 2,
    y: (pageHeight - height) / 2,
    width,
    height,
  };
}

function renderFullPageCover(doc, imagePath) {
  const image = doc.openImage(imagePath);
  const placement = getCoverImagePlacement(
    doc.page.width,
    doc.page.height,
    image.width,
    image.height
  );

  doc.save();
  doc.rect(0, 0, doc.page.width, doc.page.height).clip();
  doc.image(imagePath, placement.x, placement.y, {
    width: placement.width,
    height: placement.height,
  });
  doc.restore();
}

function renderContainedFullPageImage(doc, imagePath) {
  const image = doc.openImage(imagePath);
  const scale = Math.min(doc.page.width / image.width, doc.page.height / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  const x = (doc.page.width - width) / 2;
  const y = (doc.page.height - height) / 2;

  doc.rect(0, 0, doc.page.width, doc.page.height).fill("#ffffff");
  doc.image(imagePath, x, y, {
    width,
    height,
  });
}

function renderKdpBackCoverPage(doc, book = {}) {
  const padding = 42;
  const blurb = stripInlineMarkdown(book?.kdp?.assets?.backCoverBlurb || "");

  doc.rect(0, 0, doc.page.width, doc.page.height).fill("#0f172a");
  doc
    .font(PDF_CONFIG.fonts.heading)
    .fontSize(9)
    .fillColor("#334155")
    .text("BACK COVER", padding, padding, {
      characterSpacing: 1.2,
      width: doc.page.width - padding * 2,
    });

  doc
    .font(PDF_CONFIG.fonts.body)
    .fontSize(11)
    .fillColor("#cbd5e1")
    .text(blurb || "Back-cover copy will appear here after it is written.", padding, padding + 48, {
      lineGap: 5,
      width: doc.page.width - padding * 2,
    });

  doc
    .roundedRect(doc.page.width - padding - 96, doc.page.height - padding - 54, 96, 54, 6)
    .stroke("#334155");
  doc
    .font(PDF_CONFIG.fonts.body)
    .fontSize(8)
    .fillColor("#475569")
    .text("Barcode", doc.page.width - padding - 96, doc.page.height - padding - 33, {
      align: "center",
      width: 96,
    });
}

function renderKdpFrontCoverFallback(doc, book = {}) {
  doc.rect(0, 0, doc.page.width, doc.page.height).fill("#0f172a");
  doc
    .font(PDF_CONFIG.fonts.heading)
    .fontSize(PDF_CONFIG.sizes.title)
    .fillColor("#f8fafc")
    .text(book.title || "Untitled", 48, doc.page.height * 0.34, {
      align: "center",
      width: doc.page.width - 96,
    });

  if (book.subtitle) {
    doc
      .font(PDF_CONFIG.fonts.body)
      .fontSize(PDF_CONFIG.sizes.subtitle)
      .fillColor("#cbd5e1")
      .text(book.subtitle, 48, doc.y + 18, {
        align: "center",
        width: doc.page.width - 96,
      });
  }
}

function renderImageBlock(doc, src, alt = "") {
  const imagePath = resolveExportImagePath(src);
  const availableWidth =
    doc.page.width - PDF_CONFIG.margins.left - PDF_CONFIG.margins.right;

  if (!imagePath) {
    if (alt) {
      doc
        .font(PDF_CONFIG.fonts.bodyItalic)
        .fontSize(9)
        .fillColor(PDF_CONFIG.colors.pageNumber)
        .text(`[Image unavailable: ${alt}]`);
      doc.moveDown(0.5);
    }

    return;
  }

  try {
    const dimensions = fitImage(doc, imagePath, availableWidth, 280);

    if (
      doc.y + dimensions.height >
      doc.page.height - PDF_CONFIG.margins.bottom
    ) {
      doc.addPage();
    }

    const x = PDF_CONFIG.margins.left + (availableWidth - dimensions.width) / 2;

    doc.image(imagePath, x, doc.y, {
      width: dimensions.width,
      height: dimensions.height,
    });
    doc.y += dimensions.height + 12;
  } catch (error) {
    console.error(`Could not embed PDF image: ${imagePath}`, error);
  }
}

function getContentWidth(doc) {
  return doc.page.width - PDF_CONFIG.margins.left - PDF_CONFIG.margins.right;
}

function ensureSpace(doc, height) {
  if (doc.y + height > doc.page.height - PDF_CONFIG.margins.bottom) {
    doc.addPage();
  }
}

function stripInlineMarkdown(text = "") {
  return String(text || "")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function normalizeChildrenPageText(text = "") {
  return stripInlineMarkdown(text)
    .replace(/\s+/g, " ")
    .trim();
}

function countChildrenPageWords(text = "") {
  return normalizeChildrenPageText(text).split(/\s+/).filter(Boolean).length;
}

function splitTextForChildrenImagePage(text = "") {
  const normalizedText = normalizeChildrenPageText(text);
  const words = normalizedText.split(/\s+/).filter(Boolean);

  if (!words.length) {
    return { leftText: "", rightText: "" };
  }

  if (words.length <= CHILDREN_IMAGE_PAGE_TEXT.minWords) {
    return { leftText: normalizedText, rightText: "" };
  }

  const minImagePageWords =
    words.length >= 90 ? CHILDREN_IMAGE_PAGE_TEXT.minWords : 24;
  const minFollowupWords =
    words.length > 90
      ? Math.max(CHILDREN_IMAGE_PAGE_TEXT.minFollowupWords, 42)
      : Math.max(18, Math.floor(words.length * 0.55));
  const maxLeftWords = Math.max(8, words.length - minFollowupWords);
  const targetWords = Math.min(
    CHILDREN_IMAGE_PAGE_TEXT.maxWords,
    Math.max(minImagePageWords, Math.round(words.length * 0.32)),
    maxLeftWords
  );
  const sentenceChunks =
    normalizedText.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g) || [];
  let runningWordCount = 0;
  let boundaryWordCount = 0;

  sentenceChunks.forEach((sentence) => {
    if (boundaryWordCount) return;

    const sentenceWordCount = sentence.trim().split(/\s+/).filter(Boolean)
      .length;
    const nextWordCount = runningWordCount + sentenceWordCount;

    if (nextWordCount > maxLeftWords) {
      boundaryWordCount = runningWordCount || targetWords;
      return;
    }

    runningWordCount = nextWordCount;

    if (
      runningWordCount >=
      Math.min(minImagePageWords, targetWords)
    ) {
      boundaryWordCount = runningWordCount;
    }
  });

  const leftWordCount = Math.min(
    Math.max(boundaryWordCount || targetWords, 1),
    maxLeftWords
  );

  return {
    leftText: words.slice(0, leftWordCount).join(" "),
    rightText: words.slice(leftWordCount).join(" "),
  };
}

function getPlainChildrenTextFromMarkdown(markdown = "", chapterTitle = "") {
  const tokens = md.parse(normalizeMarkdownForExport(markdown), {});
  const title = normalizeChildrenPageText(chapterTitle).toLowerCase();
  const textParts = [];
  let skipNextInline = false;

  tokens.forEach((token, index) => {
    if (skipNextInline) {
      skipNextInline = false;
      return;
    }

    if (token.type === "heading_open") {
      const nextToken = tokens[index + 1];
      const headingText = normalizeChildrenPageText(nextToken?.content || "");
      const normalizedHeading = headingText.toLowerCase();

      skipNextInline = true;

      if (
        headingText &&
        normalizedHeading !== title &&
        !/^(left|right)\s+page\b/i.test(headingText) &&
        !/^(illustration|story text|image page|text page)\b/i.test(headingText)
      ) {
        textParts.push(headingText);
      }

      return;
    }

    if (token.type === "paragraph_open") {
      const nextToken = tokens[index + 1];

      if (nextToken?.type === "inline") {
        const textContent = normalizeChildrenPageText(
          inlineTextWithoutImages(nextToken)
        );

        if (textContent) {
          textParts.push(textContent);
        }
      }
    }
  });

  return textParts.join(" ").replace(/\s+/g, " ").trim();
}

function getFirstMarkdownImage(markdown = "") {
  const tokens = md.parse(normalizeMarkdownForExport(markdown), {});

  for (const token of tokens) {
    if (token.type !== "inline") continue;

    const [image] = collectInlineImages(token);

    if (image) return image;
  }

  return null;
}

function getChildrenPagePartsFromMarkdown(markdown = "", chapterTitle = "") {
  const { leftText, rightText } = extractChildrenSpreadParts(markdown);
  const plainLeftText = getPlainChildrenTextFromMarkdown(leftText, chapterTitle);
  const plainRightText = getPlainChildrenTextFromMarkdown(
    rightText,
    chapterTitle
  );
  const leftWordCount = countChildrenPageWords(plainLeftText);
  const rightWordCount = countChildrenPageWords(plainRightText);
  const combinedText = [plainLeftText, plainRightText].filter(Boolean).join(" ");
  const combinedWordCount = countChildrenPageWords(combinedText);

  if (!plainLeftText && plainRightText) {
    return splitTextForChildrenImagePage(plainRightText);
  }

  if (
    plainLeftText &&
    combinedWordCount >=
      CHILDREN_IMAGE_PAGE_TEXT.minWords +
        CHILDREN_IMAGE_PAGE_TEXT.minFollowupWords &&
    (leftWordCount < CHILDREN_IMAGE_PAGE_TEXT.minWords ||
      leftWordCount > CHILDREN_IMAGE_PAGE_TEXT.maxWords ||
      rightWordCount < Math.ceil(leftWordCount * 1.35))
  ) {
    return splitTextForChildrenImagePage(combinedText);
  }

  if (plainLeftText && plainRightText) {
    return {
      leftText: plainLeftText,
      rightText: plainRightText,
    };
  }

  if (plainLeftText) {
    return splitTextForChildrenImagePage(plainLeftText);
  }

  return splitTextForChildrenImagePage(
    getPlainChildrenTextFromMarkdown(markdown, chapterTitle)
  );
}

const pdfCodeCharacterReplacements = new Map([
  ["\u2500", "-"],
  ["\u2501", "-"],
  ["\u2502", "|"],
  ["\u2503", "|"],
  ["\u250C", "+"],
  ["\u250D", "+"],
  ["\u250E", "+"],
  ["\u250F", "+"],
  ["\u2510", "+"],
  ["\u2511", "+"],
  ["\u2512", "+"],
  ["\u2513", "+"],
  ["\u2514", "+"],
  ["\u2515", "+"],
  ["\u2516", "+"],
  ["\u2517", "+"],
  ["\u2518", "+"],
  ["\u2519", "+"],
  ["\u251A", "+"],
  ["\u251B", "+"],
  ["\u251C", "+"],
  ["\u251D", "+"],
  ["\u251E", "+"],
  ["\u251F", "+"],
  ["\u2520", "+"],
  ["\u2521", "+"],
  ["\u2522", "+"],
  ["\u2523", "+"],
  ["\u2524", "+"],
  ["\u2525", "+"],
  ["\u2526", "+"],
  ["\u2527", "+"],
  ["\u2528", "+"],
  ["\u2529", "+"],
  ["\u252A", "+"],
  ["\u252B", "+"],
  ["\u252C", "+"],
  ["\u252D", "+"],
  ["\u252E", "+"],
  ["\u252F", "+"],
  ["\u2530", "+"],
  ["\u2531", "+"],
  ["\u2532", "+"],
  ["\u2533", "+"],
  ["\u2534", "+"],
  ["\u2535", "+"],
  ["\u2536", "+"],
  ["\u2537", "+"],
  ["\u2538", "+"],
  ["\u2539", "+"],
  ["\u253A", "+"],
  ["\u253B", "+"],
  ["\u253C", "+"],
  ["\u253D", "+"],
  ["\u253E", "+"],
  ["\u253F", "+"],
  ["\u2540", "+"],
  ["\u2541", "+"],
  ["\u2542", "+"],
  ["\u2543", "+"],
  ["\u2544", "+"],
  ["\u2545", "+"],
  ["\u2546", "+"],
  ["\u2547", "+"],
  ["\u2548", "+"],
  ["\u2549", "+"],
  ["\u254A", "+"],
  ["\u254B", "+"],
  ["\u2550", "="],
  ["\u2551", "|"],
  ["\u2552", "+"],
  ["\u2553", "+"],
  ["\u2554", "+"],
  ["\u2555", "+"],
  ["\u2556", "+"],
  ["\u2557", "+"],
  ["\u2558", "+"],
  ["\u2559", "+"],
  ["\u255A", "+"],
  ["\u255B", "+"],
  ["\u255C", "+"],
  ["\u255D", "+"],
  ["\u255E", "+"],
  ["\u255F", "+"],
  ["\u2560", "+"],
  ["\u2561", "+"],
  ["\u2562", "+"],
  ["\u2563", "+"],
  ["\u2564", "+"],
  ["\u2565", "+"],
  ["\u2566", "+"],
  ["\u2567", "+"],
  ["\u2568", "+"],
  ["\u2569", "+"],
  ["\u256A", "+"],
  ["\u256B", "+"],
  ["\u256C", "+"],
  ["\u256D", "+"],
  ["\u256E", "+"],
  ["\u256F", "+"],
  ["\u2570", "+"],
  ["\u2571", "/"],
  ["\u2572", "\\"],
  ["\u2573", "X"],
  ["\u25BC", "v"],
  ["\u25BE", "v"],
  ["\u25B2", "^"],
  ["\u25B4", "^"],
  ["\u25B6", ">"],
  ["\u25BA", ">"],
  ["\u25C0", "<"],
  ["\u25C4", "<"],
  ["\u2190", "<-"],
  ["\u2191", "^"],
  ["\u2192", "->"],
  ["\u2193", "v"],
  ["\u2194", "<->"],
  ["\u21D0", "<="],
  ["\u21D2", "=>"],
  ["\u21D4", "<=>"],
  ["\u2018", "'"],
  ["\u2019", "'"],
  ["\u201C", "\""],
  ["\u201D", "\""],
  ["\u2013", "-"],
  ["\u2014", "-"],
  ["\u2026", "..."],
  ["\u2022", "-"],
  ["\u2023", "-"],
  ["\u2043", "-"],
  ["\u25E6", "-"],
  ["\u00B0", " deg "],
  ["\u2248", "~"],
  ["\u2264", "<="],
  ["\u2265", ">="],
]);

function normalizeCodeTextForPdf(text = "") {
  return String(text || "")
    .replace(/\t/g, "  ")
    .replace(/\u00A0/g, " ")
    .replace(
      /[\u00B0\u2022\u2023\u2043\u2248\u2264\u2265\u2500-\u257F\u25B2-\u25C4\u25E6\u2190-\u21FF\u2018-\u2026]/g,
      (char) => pdfCodeCharacterReplacements.get(char) || "?"
    )
    .replace(/[^\n\r\x20-\x7E]/g, "?");
}

function isDiagramCodeBlock(lines = []) {
  const nonEmptyLines = lines.filter((line) => line.trim());

  if (nonEmptyLines.length < 3) return false;

  const hasUnicodeDiagramGlyph = nonEmptyLines.some((line) =>
    /[\u2500-\u257F\u25B2-\u25C4\u2190-\u21FF]/.test(line)
  );

  if (hasUnicodeDiagramGlyph) return true;

  const hasBoxTable =
    nonEmptyLines.some((line) => /^\s*\+[-=+]+\+?\s*$/.test(line)) &&
    nonEmptyLines.some((line) => /^\s*\|/.test(line));

  if (hasBoxTable) return true;

  const bracketNodeCount = nonEmptyLines.filter((line) =>
    /\[[^\]]{2,}\]/.test(line)
  ).length;
  const connectorLineCount = nonEmptyLines.filter((line) => {
    const trimmed = line.trim();

    return (
      /[-_=]{3,}|[|+]{2,}|[/\\]{2,}/.test(trimmed) ||
      (/^[-_=+|<>^v/\\\s]+$/.test(trimmed) &&
        /[-_=+|<>^v/\\]/.test(trimmed))
    );
  }).length;

  if (bracketNodeCount >= 2 && connectorLineCount >= 1) return true;

  const structuralLines = nonEmptyLines.filter((line) => {
    const trimmed = line.trim();
    const structuralChars = (trimmed.match(/[+\-|_=<>^v/\\[\](){}]/g) || [])
      .length;

    return structuralChars >= 3 && structuralChars / trimmed.length >= 0.22;
  }).length;

  return structuralLines >= Math.max(2, Math.ceil(nonEmptyLines.length * 0.4));
}

function wrapCodeLine(line = "", maxChars = 80) {
  if (!line) return [""];

  const chunks = [];

  for (let index = 0; index < line.length; index += maxChars) {
    chunks.push(line.slice(index, index + maxChars));
  }

  return chunks;
}

function getBracketNodes(line = "") {
  return Array.from(String(line || "").matchAll(/\[([^\]]{2,})\]/g)).map(
    (match) => ({
      label: match[1].trim(),
      start: match.index,
      end: match.index + match[0].length,
      center: match.index + match[0].length / 2,
    })
  );
}

function parseFlowDiagram(lines = []) {
  const normalizedLines = lines.map(normalizeCodeTextForPdf);
  const nodeRows = normalizedLines
    .map((line, index) => ({
      index,
      line,
      nodes: getBracketNodes(line),
    }))
    .filter((row) => row.nodes.length > 0);

  if (nodeRows.length < 2) return null;

  const titleRow =
    nodeRows[0].nodes.length === 1 && nodeRows.length > 1 ? nodeRows[0] : null;
  const childRows = titleRow ? nodeRows.slice(1) : nodeRows;
  const childRow = childRows.reduce(
    (best, row) => (row.nodes.length > best.nodes.length ? row : best),
    childRows[0]
  );

  if (!childRow || childRow.nodes.length < 2 || childRow.nodes.length > 4) {
    return null;
  }

  const detailLines = normalizedLines
    .slice(childRow.index + 1)
    .filter((line) => line.trim());
  const details = childRow.nodes.map(() => []);
  const boundaries = childRow.nodes.map((node, index) => {
    const previousCenter = childRow.nodes[index - 1]?.center ?? 0;
    const nextCenter =
      childRow.nodes[index + 1]?.center ?? Number.POSITIVE_INFINITY;

    return {
      start: index === 0 ? 0 : Math.floor((previousCenter + node.center) / 2),
      end:
        index === childRow.nodes.length - 1
          ? Number.POSITIVE_INFINITY
          : Math.ceil((node.center + nextCenter) / 2),
    };
  });

  detailLines.forEach((line) => {
    let assigned = false;

    boundaries.forEach((boundary, index) => {
      const segment = line
        .slice(boundary.start, boundary.end === Infinity ? undefined : boundary.end)
        .trim();

      if (segment) {
        details[index].push(segment);
        assigned = true;
      }
    });

    if (!assigned && line.trim()) {
      details[details.length - 1].push(line.trim());
    }
  });

  return {
    title: titleRow?.nodes[0]?.label || "",
    nodes: childRow.nodes.map((node, index) => ({
      label: node.label,
      detail: details[index].join("\n"),
    })),
  };
}

function isBoxBorderLine(line = "") {
  const trimmed = String(line || "").trim();
  const horizontalCount = (trimmed.match(/[-=]/g) || []).length;

  return (
    trimmed.startsWith("+") &&
    trimmed.endsWith("+") &&
    horizontalCount >= 8
  );
}

function cleanDiagramSegmentLine(line = "") {
  return String(line || "")
    .replace(/^\s*[|+]\s?/, "")
    .replace(/\s?[|+]\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function parseBoxedListDiagram(lines = []) {
  const normalizedLines = lines.map(normalizeCodeTextForPdf);
  const nonEmptyLines = normalizedLines.filter((line) => line.trim());

  if (nonEmptyLines.filter(isBoxBorderLine).length < 2) return null;

  const segments = [];
  let current = [];
  let hasSeenBorder = false;

  nonEmptyLines.forEach((line) => {
    if (isBoxBorderLine(line)) {
      if (hasSeenBorder && current.length > 0) {
        segments.push(current);
      }

      current = [];
      hasSeenBorder = true;
      return;
    }

    if (hasSeenBorder) current.push(line);
  });

  if (current.length > 0) segments.push(current);

  const cleanedSegments = segments
    .map((segment) => segment.map(cleanDiagramSegmentLine).filter(Boolean))
    .filter((segment) => segment.length > 0);

  if (cleanedSegments.length === 0) return null;

  let title = "";
  let items = [];

  if (cleanedSegments[0].length === 1 && cleanedSegments.length >= 2) {
    title = cleanedSegments[0][0];
    items = cleanedSegments.slice(1).flat();
  } else if (cleanedSegments[0].length >= 3) {
    title = cleanedSegments[0][0];
    items = cleanedSegments[0].slice(1);
  }

  title = String(title || "")
    .replace(/^\[|\]$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  items = items
    .map((item) => String(item || "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((item) => !isBoxBorderLine(item));

  const listLikeItems = items.filter((item) =>
    /^(\d+[).]\s+|[-*]\s+|[A-Za-z][^:]{2,70}:\s+|\[[^\]]{2,}\])/.test(item)
  );

  if (!title || items.length < 2) return null;
  if (listLikeItems.length < Math.ceil(items.length * 0.5)) return null;

  return {
    title,
    items,
  };
}

function isConnectorSegment(lines = []) {
  const cleanedLines = lines.map(cleanDiagramSegmentLine).filter(Boolean);

  if (cleanedLines.length === 0) return true;

  return cleanedLines.every((line) =>
    /^([|v^<>]+|\(?[A-Za-z][A-Za-z\s-]*Request\)?|[-=]+|[|v^<>\s-]+)$/.test(
      line
    )
  );
}

function getConnectorLabel(lines = []) {
  return (
    lines
      .map(cleanDiagramSegmentLine)
      .find((line) => /[A-Za-z]/.test(line)) || ""
  ).replace(/^\((.*)\)$/, "$1");
}

function parseStackDiagram(lines = []) {
  const normalizedLines = lines.map(normalizeCodeTextForPdf);
  const nonEmptyLines = normalizedLines.filter((line) => line.trim());
  const borderCount = nonEmptyLines.filter(isBoxBorderLine).length;

  if (borderCount < 2) return null;

  const titleNode = getBracketNodes(nonEmptyLines[0])[0];
  const title = titleNode?.label || "";
  const bodyLines = titleNode ? nonEmptyLines.slice(1) : nonEmptyLines;
  const segments = [];
  let current = [];
  let hasSeenBorder = false;

  bodyLines.forEach((line) => {
    if (isBoxBorderLine(line)) {
      if (hasSeenBorder && current.length > 0) {
        segments.push(current);
      }

      current = [];
      hasSeenBorder = true;
      return;
    }

    if (hasSeenBorder) {
      current.push(line);
    }
  });

  if (current.length > 0) {
    segments.push(current);
  }

  const layers = [];
  const connectors = [];

  segments.forEach((segment) => {
    const cleanedLines = segment.map(cleanDiagramSegmentLine).filter(Boolean);

    if (cleanedLines.length === 0) return;

    if (isConnectorSegment(cleanedLines)) {
      const label = getConnectorLabel(cleanedLines);

      if (label) {
        connectors.push(label);
      }

      return;
    }

    layers.push({
      label: cleanedLines[0],
      detail: cleanedLines.slice(1).join("\n"),
    });
  });

  if (layers.length < 2) return null;

  return {
    title,
    layers,
    connectors,
  };
}

function cleanNestedBoxLine(line = "") {
  return String(line || "")
    .replace(/^\s*\|\s?/, "")
    .replace(/\s?\|\s*$/, "")
    .trim()
    .replace(/^\|\s?/, "")
    .replace(/\s?\|$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function detailFromBracketNodes(line = "") {
  const nodes = getBracketNodes(line);

  if (!nodes.length) return cleanDiagramSegmentLine(line);

  return nodes
    .map((node) => {
      const after = line
        .slice(node.end)
        .split("[")[0]
        .replace(/^\s*\((.*)\)\s*$/, "$1")
        .trim();

      return after ? `${node.label}: ${after}` : node.label;
    })
    .join("\n");
}

function parseNestedArchitectureDiagram(lines = []) {
  const normalizedLines = lines.map(normalizeCodeTextForPdf);
  const nonEmptyLines = normalizedLines.filter((line) => line.trim());

  if (nonEmptyLines.filter(isBoxBorderLine).length < 2) return null;

  const allBorderIndexes = normalizedLines
    .map((line, index) => ({
      index,
      line: cleanNestedBoxLine(line),
    }))
    .filter((entry) => isBoxBorderLine(entry.line))
    .map((entry) => entry.index);
  const innerBorderIndexes = allBorderIndexes.slice(1, -1);

  if (innerBorderIndexes.length < 4) return null;

  const title =
    normalizedLines
      .slice(1)
      .map(cleanNestedBoxLine)
      .find((line) => line && !isBoxBorderLine(line)) || "Architecture";
  const layers = [];

  for (let index = 0; index < innerBorderIndexes.length - 1; index += 1) {
    const start = innerBorderIndexes[index];
    const end = innerBorderIndexes[index + 1];
    const segment = normalizedLines
      .slice(start + 1, end)
      .map(cleanNestedBoxLine)
      .filter(Boolean)
      .filter((line) => !isBoxBorderLine(line));

    if (segment.length === 0) continue;

    const label = segment[0];
    const detail = segment
      .slice(1)
      .map(detailFromBracketNodes)
      .filter(Boolean)
      .join("\n");

    if (label && !layers.some((layer) => layer.label === label)) {
      layers.push({ label, detail });
    }
  }

  if (layers.length < 2) return null;

  return {
    title,
    layers,
    connectors: [],
  };
}

function splitTableLine(line = "") {
  const trimmed = String(line || "").trim();

  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return null;

  return trimmed
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
}

function parseAsciiTableDiagram(lines = []) {
  const normalizedLines = lines.map(normalizeCodeTextForPdf);
  const nonEmptyLines = normalizedLines.filter((line) => line.trim());
  const borderLines = nonEmptyLines.filter(isBoxBorderLine);

  if (borderLines.length < 2) return null;

  const borderColumnCounts = borderLines.map(
    (line) => Math.max(0, line.trim().split("+").length - 2)
  );
  const maxColumns = Math.max(...borderColumnCounts, 0);

  if (maxColumns < 2) return null;

  const rows = [];
  let currentGroup = [];
  let hasSeenBorder = false;

  const flushGroup = () => {
    if (currentGroup.length === 0) return;

    const parsedLines = currentGroup.map(splitTableLine).filter(Boolean);
    const columnCount = Math.max(...parsedLines.map((cells) => cells.length), 0);

    if (columnCount >= 2) {
      const cells = Array.from({ length: columnCount }, (_, columnIndex) =>
        parsedLines
          .map((lineCells) => lineCells[columnIndex] || "")
          .filter(Boolean)
          .join("\n")
          .trim()
      );

      if (cells.some(Boolean)) {
        rows.push(cells);
      }
    }

    currentGroup = [];
  };

  nonEmptyLines.forEach((line) => {
    if (isBoxBorderLine(line)) {
      if (hasSeenBorder) flushGroup();
      hasSeenBorder = true;
      return;
    }

    if (hasSeenBorder && splitTableLine(line)) {
      currentGroup.push(line);
    }
  });

  flushGroup();

  if (rows.length < 2) return null;

  const columnCount = Math.max(...rows.map((row) => row.length), 0);

  if (columnCount < 2 || columnCount > 5) return null;

  const paddedRows = rows.map((row) =>
    Array.from({ length: columnCount }, (_, index) => row[index] || "")
  );
  const populatedColumnIndexes = Array.from(
    { length: columnCount },
    (_, index) => index
  ).filter((columnIndex) =>
    paddedRows.some((row) => String(row[columnIndex] || "").trim())
  );

  if (populatedColumnIndexes.length < 2) return null;

  const compactRows = paddedRows.map((row) =>
    populatedColumnIndexes.map((columnIndex) => row[columnIndex])
  );

  return {
    header: compactRows[0],
    rows: compactRows.slice(1),
  };
}

function hasDiagramConnectorLine(lines = []) {
  return lines.some((line) => {
    const trimmed = String(line || "").trim();

    return (
      /^[|v^<>+\-/\\\s]+$/.test(trimmed) &&
      /[|v^<>+\-/\\]/.test(trimmed)
    );
  });
}

function parseComparisonDiagram(lines = []) {
  const normalizedLines = lines.map(normalizeCodeTextForPdf);
  const nodeRow = normalizedLines
    .map((line, index) => ({
      index,
      line,
      nodes: getBracketNodes(line),
    }))
    .find((row) => row.nodes.length >= 2 && row.nodes.length <= 4);

  if (!nodeRow || !hasDiagramConnectorLine(normalizedLines)) return null;

  const boundaries = nodeRow.nodes.map((node, index) => {
    const previousCenter = nodeRow.nodes[index - 1]?.center ?? 0;
    const nextCenter =
      nodeRow.nodes[index + 1]?.center ?? Number.POSITIVE_INFINITY;

    return {
      start: index === 0 ? 0 : Math.floor((previousCenter + node.center) / 2),
      end:
        index === nodeRow.nodes.length - 1
          ? Number.POSITIVE_INFINITY
          : Math.ceil((node.center + nextCenter) / 2),
    };
  });
  const details = nodeRow.nodes.map(() => []);

  normalizedLines.slice(nodeRow.index + 1).forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed || /^[|v^<>+\-/\\\s]+$/.test(trimmed)) return;

    boundaries.forEach((boundary, index) => {
      const segment = line
        .slice(boundary.start, boundary.end === Infinity ? undefined : boundary.end)
        .trim();

      if (segment) {
        details[index].push(segment);
      }
    });
  });

  if (!details.some((detailLines) => detailLines.length > 0)) return null;

  return {
    title: "",
    nodes: nodeRow.nodes.map((node, index) => ({
      label: node.label,
      detail: details[index].join("\n"),
    })),
  };
}

function parseBranchDiagram(lines = []) {
  const normalizedLines = lines.map(normalizeCodeTextForPdf);
  const branchRows = normalizedLines
    .map((line) => {
      const match = line.match(/\+[- ]+(.+?)\s*-{2,}\s*\[([^\]]+)\]/);

      if (!match) return null;

      return {
        trigger: match[1].replace(/^"|"$/g, "").trim(),
        target: match[2].trim(),
      };
    })
    .filter(Boolean);

  if (branchRows.length < 2) return null;

  const rootLine =
    normalizedLines.find((line) => /"{1}.+"{1}/.test(line) && /---\+/.test(line)) ||
    normalizedLines.find((line) => /---\+/.test(line)) ||
    "";
  const root =
    rootLine.match(/"([^"]+)"/)?.[1] ||
    rootLine.replace(/[-+|]/g, " ").replace(/\s{2,}/g, " ").trim() ||
    "Branch point";

  return {
    title: root,
    nodes: branchRows.map((row) => ({
      label: row.target,
      detail: row.trigger,
    })),
  };
}

function parseLinearFlowDiagram(lines = []) {
  const normalizedLines = lines.map(normalizeCodeTextForPdf);
  const nonEmptyLines = normalizedLines.filter((line) => line.trim());
  const arrowPattern = /(-->|<-->|<--|->|<-|=>|<==>|<==|==>|===|<=>)/;
  const hasArrow = nonEmptyLines.some((line) => arrowPattern.test(line));

  if (hasArrow && nonEmptyLines.length === 1) {
    const line = nonEmptyLines[0];
    const parts = line
      .split(arrowPattern)
      .filter((part) => part && !arrowPattern.test(part))
      .map((part) =>
        part
          .replace(/^\s*\[|\]\s*$/g, "")
          .replace(/^\s*\(|\)\s*$/g, "")
          .trim()
      )
      .filter(Boolean);

    if (parts.length >= 2 && parts.length <= 5) {
      return {
        title: "",
        nodes: parts.map((part) => ({
          label: part,
          detail: "",
        })),
      };
    }
  }

  const nodeRows = normalizedLines
    .map((line, index) => ({
      index,
      line,
      nodes: getBracketNodes(line),
    }))
    .filter((row) => row.nodes.length > 0);

  if (nodeRows.length < 2 || nodeRows.length > 8) return null;

  if (!hasArrow) {
    if (!hasDiagramConnectorLine(nonEmptyLines)) return null;

    const nodes = [];
    let currentNode = null;

    normalizedLines.forEach((line) => {
      const nodesInLine = getBracketNodes(line);
      const trimmed = line.trim();

      if (nodesInLine.length > 0) {
        if (currentNode) {
          nodes.push(currentNode);
        }

        currentNode = {
          label: nodesInLine[0].label,
          detail: "",
        };
        return;
      }

      if (!currentNode || !trimmed || /^[|v^<>+\-/\\\s]+$/.test(trimmed)) {
        return;
      }

      currentNode.detail = [currentNode.detail, cleanDiagramSegmentLine(line)]
        .filter(Boolean)
        .join("\n");
    });

    if (currentNode) {
      nodes.push(currentNode);
    }

    if (nodes.length >= 2 && nodes.length <= 8) {
      return {
        title: "",
        nodes,
      };
    }

    return null;
  }

  const nodes = [];

  nodeRows.forEach((row) => {
    const primaryNode = row.nodes[0];
    const detail = row.line
      .slice(primaryNode.end)
      .replace(/(<-->|-->|<--|->|<-|=>|<==>|<==|==>|===|<=>)/g, "")
      .trim();

    nodes.push({
      label: primaryNode.label,
      detail,
    });

    row.nodes.slice(1).forEach((node) => {
      nodes.push({
        label: node.label,
        detail: "",
      });
    });
  });

  if (nodes.length < 2 || nodes.length > 8) return null;

  return {
    title: "",
    nodes,
  };
}

function isConnectorOnlyLine(line = "") {
  const trimmed = String(line || "").trim();

  return /^[|v^<>+\-/\\\s]+$/.test(trimmed) && /[|v^<>+\-/\\]/.test(trimmed);
}

function cleanConnectorLabel(value = "") {
  return String(value || "")
    .replace(/^\|?\s*/, "")
    .replace(/^\((.*)\)$/, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function parseProcessBoxLine(line = "") {
  const trimmed = String(line || "").trim();

  if (!trimmed.startsWith("|")) return null;

  const content = trimmed.replace(/^\|\s*/, "").replace(/\s*\|$/, "").trim();

  if (!content || isConnectorOnlyLine(content)) return null;
  if (/^\(.*/.test(content)) {
    return {
      connector: cleanConnectorLabel(content),
    };
  }

  const [labelPart, ...rest] = content.split("|");
  const label = labelPart.trim();
  const detail = rest
    .join("|")
    .replace(/^\s*[-=]*>\s*/, "")
    .trim();

  if (!label) return null;

  return {
    label,
    detail,
  };
}

function parseProcessDiagram(lines = []) {
  const nonEmptyLines = [];

  lines
    .map(normalizeCodeTextForPdf)
    .filter((line) => line.trim())
    .forEach((line) => {
      if (line.trim() === nonEmptyLines[nonEmptyLines.length - 1]?.trim()) {
        return;
      }

      nonEmptyLines.push(line);
    });

  if (nonEmptyLines.length < 5) return null;

  const hasVerticalConnectors = nonEmptyLines.filter(isConnectorOnlyLine).length >= 2;
  const hasBoxLines = nonEmptyLines.some((line) => line.trim().startsWith("|"));

  if (!hasVerticalConnectors || !hasBoxLines) return null;

  const nodes = [];
  let pendingConnector = "";

  const addNode = (label, detail = "") => {
    const cleanLabel = String(label || "")
      .replace(/^\[|\]$/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const cleanDetail = String(detail || "").replace(/\s+/g, " ").trim();

    if (!cleanLabel || /^[-+=]+$/.test(cleanLabel)) return;

    nodes.push({
      label: cleanLabel,
      detail: cleanDetail || pendingConnector,
    });
    pendingConnector = "";
  };

  nonEmptyLines.forEach((line) => {
    const trimmed = line.trim();

    if (isBoxBorderLine(trimmed) || isConnectorOnlyLine(trimmed)) return;

    const boxed = parseProcessBoxLine(trimmed);

    if (boxed?.connector) {
      pendingConnector = [pendingConnector, boxed.connector].filter(Boolean).join(" ");
      return;
    }

    if (boxed?.label) {
      addNode(boxed.label, boxed.detail);
      return;
    }

    const bracketNode = trimmed.match(/^\[([^\]]{2,})\]$/);

    if (bracketNode) {
      addNode(bracketNode[1]);
      return;
    }

    if (/^\(.*/.test(trimmed) || pendingConnector) {
      pendingConnector = [pendingConnector, cleanConnectorLabel(trimmed)]
        .filter(Boolean)
        .join(" ");
      return;
    }

    if (nodes.length === 0 || /:/.test(trimmed)) {
      addNode(trimmed);
      return;
    }

    nodes[nodes.length - 1].detail = [nodes[nodes.length - 1].detail, trimmed]
      .filter(Boolean)
      .join(" ");
  });

  if (nodes.length < 3) return null;

  return {
    title: "Process Flow",
    nodes,
  };
}

function isSystemHeading(line = "") {
  return /^[A-Z0-9][A-Za-z0-9\s/()&.-]{5,}:\s*$/.test(String(line || "").trim());
}

function getPipeBoxLabels(line = "") {
  const parts = String(line || "")
    .split("|")
    .map((part) =>
      part
        .replace(/\+[-=]+>?/g, " ")
        .replace(/[-=]+>/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim()
    )
    .filter((part) => /[A-Za-z]{3,}/.test(part));

  return parts.filter((part) => !/^(v|Deposits|Loans)$/i.test(part));
}

function parseSystemFlowSection(title = "", sectionLines = []) {
  const normalized = sectionLines
    .map(normalizeCodeTextForPdf)
    .filter((line) => line.trim());
  const boxes = [];
  const notes = [];

  normalized.forEach((line) => {
    getBracketNodes(line).forEach((node) => {
      if (!boxes.includes(node.label)) boxes.push(node.label);
    });

    getPipeBoxLabels(line).forEach((label) => {
      if (!boxes.includes(label)) boxes.push(label);
    });

    const parenthetical = line.match(/\(([^)]{6,})\)/)?.[1];

    if (parenthetical) notes.push(parenthetical.trim());
  });

  if (boxes.length < 2) return null;

  const detailLines = normalized
    .filter((line) => !isBoxBorderLine(line))
    .map((line) =>
      line
        .replace(/\[[^\]]+\]/g, " ")
        .replace(/[+\-|<>^v/\\]+/g, " ")
        .replace(/\([^)]*\)/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim()
    )
    .filter((line) => /[A-Za-z]{3,}/.test(line));

  return {
    title: title.replace(/:\s*$/, ""),
    nodes: boxes.map((label, index) => ({
      label,
      detail: index === 0 ? [...detailLines, ...notes].join("\n") : "",
    })),
  };
}

function parseSystemComparisonDiagram(lines = []) {
  const normalized = [];
  const sections = [];
  let currentTitle = "";
  let currentLines = [];

  lines
    .map(normalizeCodeTextForPdf)
    .filter((line) => line.trim())
    .forEach((line) => {
      if (line.trim() === normalized[normalized.length - 1]?.trim()) return;
      normalized.push(line);
    });

  const flush = () => {
    if (!currentTitle || currentLines.length === 0) return;
    const section = parseSystemFlowSection(currentTitle, currentLines);
    if (section) sections.push(section);
  };

  normalized.forEach((line) => {
    if (isSystemHeading(line)) {
      flush();
      currentTitle = line.trim();
      currentLines = [];
      return;
    }

    if (currentTitle) currentLines.push(line);
  });

  flush();

  if (sections.length < 2) return null;

  return {
    title: "System Comparison",
    nodes: sections.map((section) => ({
      label: section.title,
      detail: section.nodes
        .map((node) => [node.label, node.detail].filter(Boolean).join(": "))
        .join("\n"),
    })),
  };
}

function isLooseDiagramBlock(lines = []) {
  const nonEmptyLines = lines.filter((line) => line.trim());

  if (nonEmptyLines.length < 3) return false;

  const text = nonEmptyLines.join("\n");
  const hasDiagramGlyph = /[\u2500-\u257F\u25B2-\u25C4\u2190-\u21FF]/.test(text);
  const bracketRows = nonEmptyLines.filter((line) =>
    /\[[^\]]{2,}\]/.test(line)
  ).length;
  const structuralRows = nonEmptyLines.filter((line) => {
    const trimmed = line.trim();

    return (
      /^[|v^<>+\-/\\\s]+$/.test(trimmed) ||
      /[-+]{2,}/.test(trimmed) ||
      /\+--|---\+/.test(trimmed)
    );
  }).length;

  return (
    hasDiagramGlyph ||
    (bracketRows >= 1 && structuralRows >= 1) ||
    structuralRows >= Math.ceil(nonEmptyLines.length * 0.35)
  );
}

function looksLikeSourceCodeBlock(lines = [], language = "") {
  const { isDedicatedDiagramFence } = require("./kdp-markdown-blocks");

  return !isDedicatedDiagramFence(
    language,
    Array.isArray(lines) ? lines.join("\n") : String(lines || "")
  );
}

function textHeight(doc, text, options = {}) {
  return doc.heightOfString(text || " ", options);
}

function shouldUseVerticalFlowLayout(nodeCount = 0, nodeWidth = 0) {
  return nodeCount > 2 || nodeWidth < 96;
}

function renderFlowDiagram(doc, diagram) {
  if (!diagram?.nodes?.length) return false;

  const cardX = PDF_CONFIG.margins.left;
  const cardW = getContentWidth(doc);
  const padding = 18;
  const gap = 12;
  const nodeCount = diagram.nodes.length;
  const nodeW = (cardW - padding * 2 - gap * (nodeCount - 1)) / nodeCount;

  if (shouldUseVerticalFlowLayout(nodeCount, nodeW)) {
    return renderVerticalFlowDiagram(doc, diagram);
  }
  const titleText = diagram.title || "Diagram";
  const titleW = Math.min(cardW - padding * 2, Math.max(220, cardW * 0.55));
  const titleH = 36;
  const connectorH = nodeCount > 1 ? 46 : 16;
  const nodeHeights = diagram.nodes.map((node) => {
    const labelHeight = textHeight(doc, node.label, {
      width: nodeW - 18,
      align: "center",
    });
    const detailHeight = node.detail
      ? textHeight(doc, node.detail, {
          width: nodeW - 18,
          align: "center",
          lineGap: 2,
        })
      : 0;

    return Math.max(72, labelHeight + detailHeight + 34);
  });
  const nodeH = Math.max(...nodeHeights);
  const cardH = padding + titleH + connectorH + nodeH + padding;

  ensureSpace(doc, cardH + 18);
  doc.moveDown(0.35);

  const top = doc.y;
  const titleX = cardX + (cardW - titleW) / 2;
  const titleY = top + padding;
  const nodeY = titleY + titleH + connectorH;
  const childCenters = diagram.nodes.map(
    (_, index) => cardX + padding + index * (nodeW + gap) + nodeW / 2
  );
  const titleCenterX = cardX + cardW / 2;
  const titleBottomY = titleY + titleH;
  const connectorMidY = titleBottomY + connectorH * 0.52;

  doc
    .roundedRect(cardX, top, cardW, cardH, 12)
    .fillAndStroke("#f8fafc", "#cbd5e1");

  doc
    .roundedRect(titleX, titleY, titleW, titleH, 10)
    .fillAndStroke("#eef2ff", "#c4b5fd");
  doc
    .font(PDF_CONFIG.fonts.bodyBold)
    .fontSize(11)
    .fillColor("#312e81")
    .text(titleText, titleX + 12, titleY + 11, {
      width: titleW - 24,
      align: "center",
      lineBreak: false,
    });

  if (nodeCount > 1) {
    doc
      .save()
      .lineWidth(1.6)
      .strokeColor("#94a3b8")
      .moveTo(titleCenterX, titleBottomY)
      .lineTo(titleCenterX, connectorMidY)
      .moveTo(childCenters[0], connectorMidY)
      .lineTo(childCenters[childCenters.length - 1], connectorMidY);

    childCenters.forEach((centerX) => {
      doc.moveTo(centerX, connectorMidY).lineTo(centerX, nodeY - 6);
    });

    doc.stroke().restore();
  }

  diagram.nodes.forEach((node, index) => {
    const x = cardX + padding + index * (nodeW + gap);

    doc
      .roundedRect(x, nodeY, nodeW, nodeH, 10)
      .fillAndStroke("#ffffff", "#bfdbfe");
    doc
      .font(PDF_CONFIG.fonts.bodyBold)
      .fontSize(10.5)
      .fillColor("#0f172a")
      .text(node.label, x + 9, nodeY + 12, {
        width: nodeW - 18,
        align: "center",
        lineGap: 2,
      });

    if (node.detail) {
      doc
        .font(PDF_CONFIG.fonts.body)
        .fontSize(8.8)
        .fillColor("#475569")
        .text(node.detail, x + 9, doc.y + 5, {
          width: nodeW - 18,
          align: "center",
          lineGap: 2,
        });
    }
  });

  doc.y = top + cardH + 12;
  return true;
}

function renderVerticalFlowDiagram(doc, diagram) {
  if (!diagram?.nodes?.length) return false;

  const cardX = PDF_CONFIG.margins.left;
  const cardW = getContentWidth(doc);
  const padding = 18;
  const nodeW = cardW - padding * 2;
  const titleH = diagram.title ? 34 : 0;
  const connectorH = 24;
  const nodeHeights = diagram.nodes.map((node) => {
    const labelHeight = textHeight(doc, node.label, {
      width: nodeW - 28,
      align: "center",
    });
    const detailHeight = node.detail
      ? textHeight(doc, node.detail, {
          width: nodeW - 28,
          align: "center",
          lineGap: 2,
        })
      : 0;

    return Math.max(48, labelHeight + detailHeight + 28);
  });
  const cardH =
    padding +
    titleH +
    nodeHeights.reduce((sum, height) => sum + height, 0) +
    connectorH * (diagram.nodes.length - 1) +
    padding;

  ensureSpace(doc, cardH + 18);
  doc.moveDown(0.35);

  const top = doc.y;
  let y = top + padding;

  doc
    .roundedRect(cardX, top, cardW, cardH, 12)
    .fillAndStroke("#f8fafc", "#cbd5e1");

  if (diagram.title) {
    doc
      .font(PDF_CONFIG.fonts.bodyBold)
      .fontSize(11)
      .fillColor("#312e81")
      .text(diagram.title, cardX + padding, y + 4, {
        width: nodeW,
        align: "center",
      });
    y += titleH;
  }

  diagram.nodes.forEach((node, index) => {
    const nodeH = nodeHeights[index];
    const nodeX = cardX + padding;

    doc
      .roundedRect(nodeX, y, nodeW, nodeH, 10)
      .fillAndStroke("#ffffff", "#bfdbfe");
    doc
      .font(PDF_CONFIG.fonts.bodyBold)
      .fontSize(10.5)
      .fillColor("#0f172a")
      .text(node.label, nodeX + 14, y + 10, {
        width: nodeW - 28,
        align: "center",
        lineGap: 2,
      });

    if (node.detail) {
      doc
        .font(PDF_CONFIG.fonts.body)
        .fontSize(8.8)
        .fillColor("#475569")
        .text(node.detail, nodeX + 14, doc.y + 4, {
          width: nodeW - 28,
          align: "center",
          lineGap: 2,
        });
    }

    y += nodeH;

    if (index < diagram.nodes.length - 1) {
      const centerX = cardX + cardW / 2;

      doc
        .save()
        .lineWidth(1.5)
        .strokeColor("#94a3b8")
        .moveTo(centerX, y + 3)
        .lineTo(centerX, y + connectorH - 8)
        .stroke()
        .restore();
      doc
        .font(PDF_CONFIG.fonts.bodyBold)
        .fontSize(9)
        .fillColor("#64748b")
        .text("v", cardX + padding, y + 8, {
          width: nodeW,
          align: "center",
          lineBreak: false,
        });

      y += connectorH;
    }
  });

  doc.y = top + cardH + 12;
  return true;
}

function renderTableDiagram(doc, table) {
  if (!table?.header?.length || !table?.rows?.length) return false;

  const cardX = PDF_CONFIG.margins.left;
  const cardW = getContentWidth(doc);
  const padding = 14;
  const columnCount = table.header.length;
  const cellPadding = 7;
  const tableW = cardW - padding * 2;
  const colW = tableW / columnCount;
  const headerH = Math.max(
    32,
    ...table.header.map(
      (cell) =>
        textHeight(doc, cell, {
          width: colW - cellPadding * 2,
          align: "left",
          lineGap: 1,
        }) +
        cellPadding * 2
    )
  );
  const rowHeights = table.rows.map((row) =>
    Math.max(
      36,
      ...row.map(
        (cell) =>
          textHeight(doc, cell, {
            width: colW - cellPadding * 2,
            align: "left",
            lineGap: 2,
          }) +
          cellPadding * 2
      )
    )
  );
  const cardH =
    padding + headerH + rowHeights.reduce((sum, height) => sum + height, 0) + padding;

  ensureSpace(doc, cardH + 18);
  doc.moveDown(0.35);

  const top = doc.y;
  let y = top + padding;

  doc
    .roundedRect(cardX, top, cardW, cardH, 12)
    .fillAndStroke("#f8fafc", "#cbd5e1");

  table.header.forEach((cell, index) => {
    const x = cardX + padding + colW * index;

    doc.rect(x, y, colW, headerH).fillAndStroke("#eef2ff", "#c7d2fe");
    doc
      .font(PDF_CONFIG.fonts.bodyBold)
      .fontSize(8.8)
      .fillColor("#312e81")
      .text(cell, x + cellPadding, y + cellPadding, {
        width: colW - cellPadding * 2,
        lineGap: 1,
      });
  });

  y += headerH;

  table.rows.forEach((row, rowIndex) => {
    const rowH = rowHeights[rowIndex];
    const fill = rowIndex % 2 === 0 ? "#ffffff" : "#f8fafc";

    row.forEach((cell, columnIndex) => {
      const x = cardX + padding + colW * columnIndex;

      doc.rect(x, y, colW, rowH).fillAndStroke(fill, "#dbeafe");
      doc
        .font(PDF_CONFIG.fonts.body)
        .fontSize(8.2)
        .fillColor("#334155")
        .text(cell, x + cellPadding, y + cellPadding, {
          width: colW - cellPadding * 2,
          lineGap: 2,
        });
    });

    y += rowH;
  });

  doc.y = top + cardH + 12;
  return true;
}

function renderBoxedListDiagram(doc, diagram) {
  if (!diagram?.title || !diagram?.items?.length) return false;

  const cardX = PDF_CONFIG.margins.left;
  const cardW = getContentWidth(doc);
  const padding = 18;
  const itemGap = 8;
  const itemW = cardW - padding * 2;

  doc.font(PDF_CONFIG.fonts.bodyBold).fontSize(12);
  const titleH = Math.max(
    34,
    textHeight(doc, diagram.title, {
      width: itemW - 24,
      align: "center",
      lineGap: 2,
    }) + 18
  );

  doc.font(PDF_CONFIG.fonts.body).fontSize(9.6);
  const itemHeights = diagram.items.map((item) => {
    const numberMatch = String(item).match(/^(\d+)[).]\s*(.*)$/);
    const itemText = numberMatch ? numberMatch[2] : item;

    return Math.max(
      32,
      textHeight(doc, itemText, {
        width: itemW - 52,
        lineGap: 2,
      }) + 16
    );
  });
  const cardH =
    padding +
    titleH +
    12 +
    itemHeights.reduce((sum, height) => sum + height, 0) +
    itemGap * Math.max(0, diagram.items.length - 1) +
    padding;

  ensureSpace(doc, cardH + 18);
  doc.moveDown(0.35);

  const top = doc.y;
  let y = top + padding;

  doc
    .roundedRect(cardX, top, cardW, cardH, 12)
    .fillAndStroke("#f8fafc", "#cbd5e1");
  doc
    .roundedRect(cardX + padding, y, itemW, titleH, 10)
    .fillAndStroke("#eef2ff", "#c4b5fd");
  doc
    .font(PDF_CONFIG.fonts.bodyBold)
    .fontSize(12)
    .fillColor("#312e81")
    .text(diagram.title, cardX + padding + 12, y + 10, {
      width: itemW - 24,
      align: "center",
      lineGap: 2,
    });

  y += titleH + 12;

  diagram.items.forEach((item, index) => {
    const itemH = itemHeights[index];
    const numberMatch = String(item).match(/^(\d+)[).]\s*(.*)$/);
    const marker = numberMatch ? numberMatch[1] : String(index + 1);
    const itemText = numberMatch ? numberMatch[2] : item;
    const itemX = cardX + padding;

    doc
      .roundedRect(itemX, y, itemW, itemH, 9)
      .fillAndStroke("#ffffff", "#dbeafe");
    doc.circle(itemX + 18, y + 16, 10).fill("#7c3aed");
    doc
      .font(PDF_CONFIG.fonts.bodyBold)
      .fontSize(8.5)
      .fillColor("#ffffff")
      .text(marker, itemX + 8, y + 11, {
        width: 20,
        align: "center",
        lineBreak: false,
      });
    doc
      .font(PDF_CONFIG.fonts.body)
      .fontSize(9.6)
      .fillColor("#334155")
      .text(itemText, itemX + 42, y + 9, {
        width: itemW - 54,
        lineGap: 2,
      });

    y += itemH + itemGap;
  });

  doc.y = top + cardH + 12;
  return true;
}

function renderStackDiagram(doc, diagram) {
  if (!diagram?.layers?.length) return false;

  const cardX = PDF_CONFIG.margins.left;
  const cardW = getContentWidth(doc);
  const padding = 18;
  const titleH = diagram.title ? 36 : 0;
  const layerW = cardW - padding * 2;
  const connectorH = 30;
  const layerHeights = diagram.layers.map((layer) => {
    const labelHeight = textHeight(doc, layer.label, {
      width: layerW - 28,
      align: "center",
    });
    const detailHeight = layer.detail
      ? textHeight(doc, layer.detail, {
          width: layerW - 28,
          align: "center",
          lineGap: 2,
        })
      : 0;

    return Math.max(54, labelHeight + detailHeight + 30);
  });
  const cardH =
    padding +
    titleH +
    layerHeights.reduce((sum, height) => sum + height, 0) +
    connectorH * (diagram.layers.length - 1) +
    padding;

  ensureSpace(doc, cardH + 18);
  doc.moveDown(0.35);

  const top = doc.y;
  let y = top + padding;

  doc
    .roundedRect(cardX, top, cardW, cardH, 12)
    .fillAndStroke("#f8fafc", "#cbd5e1");

  if (diagram.title) {
    const titleW = Math.min(cardW - padding * 2, Math.max(260, cardW * 0.72));
    const titleX = cardX + (cardW - titleW) / 2;

    doc
      .roundedRect(titleX, y, titleW, titleH, 10)
      .fillAndStroke("#ecfeff", "#67e8f9");
    doc
      .font(PDF_CONFIG.fonts.bodyBold)
      .fontSize(11)
      .fillColor("#164e63")
      .text(diagram.title, titleX + 12, y + 11, {
        width: titleW - 24,
        align: "center",
        lineBreak: false,
      });

    y += titleH + 14;
  }

  diagram.layers.forEach((layer, index) => {
    const layerH = layerHeights[index];
    const layerX = cardX + padding;

    doc
      .roundedRect(layerX, y, layerW, layerH, 10)
      .fillAndStroke("#ffffff", "#bfdbfe");
    doc
      .font(PDF_CONFIG.fonts.bodyBold)
      .fontSize(11)
      .fillColor("#0f172a")
      .text(layer.label, layerX + 14, y + 12, {
        width: layerW - 28,
        align: "center",
        lineGap: 2,
      });

    if (layer.detail) {
      doc
        .font(PDF_CONFIG.fonts.body)
        .fontSize(9)
        .fillColor("#475569")
        .text(layer.detail, layerX + 14, doc.y + 5, {
          width: layerW - 28,
          align: "center",
          lineGap: 2,
        });
    }

    y += layerH;

    if (index < diagram.layers.length - 1) {
      const connectorLabel = diagram.connectors[index] || "";
      const centerX = cardX + cardW / 2;
      const lineStartY = y + 4;
      const lineEndY = y + connectorH - 8;

      doc
        .save()
        .lineWidth(1.6)
        .strokeColor("#94a3b8")
        .moveTo(centerX, lineStartY)
        .lineTo(centerX, lineEndY)
        .stroke()
        .restore();

      doc
        .font(PDF_CONFIG.fonts.bodyBold)
        .fontSize(8.5)
        .fillColor("#64748b")
        .text(connectorLabel || "v", cardX + padding, y + 9, {
          width: layerW,
          align: "center",
          lineBreak: false,
        });

      y += connectorH;
    }
  });

  doc.y = top + cardH + 12;
  return true;
}

function renderSemanticDiagram(doc, originalLines = [], language = "") {
  if (looksLikeSourceCodeBlock(originalLines, language)) {
    return false;
  }

  const {
    extractDiagramLabelDirective,
    parseTreeHubDiagram,
  } = require("./diagram-tree");
  const { lines } = extractDiagramLabelDirective(originalLines);
  const treeDiagram = parseTreeHubDiagram(lines);

  if (treeDiagram) {
    return renderVerticalFlowDiagram(doc, treeDiagram);
  }

  const systemComparison = parseSystemComparisonDiagram(lines);

  if (systemComparison) {
    return renderFlowDiagram(doc, systemComparison);
  }

  const nestedArchitecture = parseNestedArchitectureDiagram(lines);

  if (nestedArchitecture) {
    return renderStackDiagram(doc, nestedArchitecture);
  }

  const boxedList = parseBoxedListDiagram(lines);

  if (boxedList) {
    return renderBoxedListDiagram(doc, boxedList);
  }

  const tableDiagram = parseAsciiTableDiagram(lines);

  if (tableDiagram) {
    return renderTableDiagram(doc, tableDiagram);
  }

  const processDiagram = parseProcessDiagram(lines);

  if (processDiagram) {
    return renderVerticalFlowDiagram(doc, processDiagram);
  }

  const flowDiagram = parseFlowDiagram(lines);

  if (flowDiagram) {
    return renderFlowDiagram(doc, flowDiagram);
  }

  const stackDiagram = parseStackDiagram(lines);

  if (stackDiagram) {
    return renderStackDiagram(doc, stackDiagram);
  }

  const branchDiagram = parseBranchDiagram(lines);

  if (branchDiagram) {
    return renderFlowDiagram(doc, branchDiagram);
  }

  const comparisonDiagram = parseComparisonDiagram(lines);

  if (comparisonDiagram) {
    return renderFlowDiagram(doc, comparisonDiagram);
  }

  const linearDiagram = parseLinearFlowDiagram(lines);

  if (linearDiagram) {
    return renderFlowDiagram(doc, linearDiagram);
  }

  return isLooseDiagramBlock(lines)
    ? renderPreformattedDiagram(doc, lines)
    : false;
}

function renderPreformattedDiagram(doc, originalLines = []) {
  const lines = originalLines.map(normalizeCodeTextForPdf);
  const padding = 12;
  const availableWidth = getContentWidth(doc);
  const innerWidth = availableWidth - padding * 2;
  const fontSize = 7.5;
  const lineHeight = fontSize * 1.35;
  const maxChars = Math.max(24, Math.floor(innerWidth / (fontSize * 0.58)));
  const renderLines = lines.flatMap((line) => wrapCodeLine(line, maxChars));
  const blockHeight = renderLines.length * lineHeight + padding * 2;
  const x = PDF_CONFIG.margins.left;

  ensureSpace(doc, blockHeight + 18);
  doc.moveDown(0.35);

  const top = doc.y;

  doc
    .roundedRect(x, top, availableWidth, blockHeight, 12)
    .fillAndStroke("#f8fafc", "#cbd5e1");

  renderLines.forEach((line, index) => {
    doc
      .font(PDF_CONFIG.fonts.code)
      .fontSize(fontSize)
      .fillColor("#0f172a")
      .text(line || " ", x + padding, top + padding + index * lineHeight, {
        width: innerWidth,
        lineBreak: false,
      });
  });

  doc.y = top + blockHeight + 12;
  return true;
}

function renderTextBlock(doc, text, options = {}) {
  const cleanText = stripInlineMarkdown(text);

  if (!cleanText) return;

  const x = options.x ?? PDF_CONFIG.margins.left;
  const width = options.width ?? getContentWidth(doc);
  const font = options.font ?? PDF_CONFIG.fonts.body;
  const size = options.size ?? PDF_CONFIG.sizes.body;
  const color = options.color ?? PDF_CONFIG.colors.body;
  const isBodyParagraph = Boolean(options.bodyParagraph);

  ensureSpace(doc, options.minHeight ?? size * 4);

  doc
    .font(font)
    .fontSize(size)
    .fillColor(color)
    .text(cleanText, x, doc.y, {
      width,
      align: options.align || (isBodyParagraph ? "justify" : "left"),
      indent: options.indent ?? 0,
      lineGap:
        options.lineGap ??
        (isBodyParagraph
          ? Math.max(1, size * PDF_CONFIG.typography.bodyLineGapRatio)
          : 4),
    });

  doc.moveDown(
    options.after ??
      (isBodyParagraph ? PDF_CONFIG.typography.paragraphAfter : 0.75)
  );
}

function renderCodeBlock(doc, token) {
  const originalLines = token.content.replace(/\n$/, "").split("\n");
  const language = String(token.info || "").trim().split(/\s+/)[0] || "";

  if (renderSemanticDiagram(doc, originalLines, language)) {
    return;
  }

  const lines = originalLines.map(normalizeCodeTextForPdf);
  const maxLineLength = Math.max(...lines.map((line) => line.length), 1);
  const padding = 10;
  const availableWidth = getContentWidth(doc);
  const isDiagram =
    isDiagramCodeBlock(originalLines) || isDiagramCodeBlock(lines);
  const maxFontSize = isDiagram ? 8.2 : PDF_CONFIG.sizes.code;
  const codeFontSize = isDiagram
    ? Math.max(
        5.2,
        Math.min(
          maxFontSize,
          (availableWidth - padding * 2) / (maxLineLength * 0.58)
        )
      )
    : PDF_CONFIG.sizes.code;
  const lineHeight = codeFontSize * 1.35;
  const x = PDF_CONFIG.margins.left;
  const width = availableWidth;
  const innerWidth = width - padding * 2;

  doc.font(PDF_CONFIG.fonts.code).fontSize(codeFontSize);

  const charWidth = Math.max(doc.widthOfString("M"), 1);
  const maxChars = Math.max(16, Math.floor(innerWidth / charWidth));
  const renderLines = lines.flatMap((line) => wrapCodeLine(line, maxChars));

  let index = 0;
  doc.moveDown(0.35);

  while (index < renderLines.length) {
    const pageBottom = doc.page.height - PDF_CONFIG.margins.bottom;
    const availablePageHeight = pageBottom - doc.y - padding * 2;
    const linesOnPage = Math.max(
      1,
      Math.floor(availablePageHeight / lineHeight)
    );

    if (availablePageHeight < lineHeight) {
      doc.addPage();
      continue;
    }

    const chunk = renderLines.slice(index, index + linesOnPage);
    const blockHeight = chunk.length * lineHeight + padding * 2;
    const blockTop = doc.y;

    doc
      .roundedRect(x, blockTop, width, blockHeight, 6)
      .fillAndStroke(PDF_CONFIG.colors.codeBg, PDF_CONFIG.colors.codeBorder);

    let lineY = blockTop + padding;

    chunk.forEach((line) => {
      doc
        .font(PDF_CONFIG.fonts.code)
        .fontSize(codeFontSize)
        .fillColor(PDF_CONFIG.colors.codeBlock)
        .text(line || " ", x + padding, lineY, {
          width: innerWidth,
          lineBreak: false,
        });

      lineY += lineHeight;
    });

    doc.y = blockTop + blockHeight + 10;
    index += chunk.length;

    if (index < renderLines.length) {
      doc.addPage();
    }
  }
}

function renderListItem(doc, marker, text) {
  const markerX = PDF_CONFIG.margins.left + 8;
  const textX = PDF_CONFIG.margins.left + PDF_CONFIG.list.textIndent;
  const width = doc.page.width - textX - PDF_CONFIG.margins.right;

  ensureSpace(doc, 45);
  const currentY = doc.y;

  doc
    .font(PDF_CONFIG.fonts.body)
    .fontSize(PDF_CONFIG.sizes.body)
    .fillColor(PDF_CONFIG.colors.body)
    .text(marker, markerX, currentY, {
      width: 20,
      lineBreak: false,
    });

  doc
    .font(PDF_CONFIG.fonts.body)
    .fontSize(PDF_CONFIG.sizes.body)
    .fillColor(PDF_CONFIG.colors.body)
    .text(stripInlineMarkdown(text), textX, currentY, {
      width,
      lineGap: 4,
    });

  doc.moveDown(0.35);
}

// Process markdown content and render to PDF
function processMdContentForPdf(doc, mdContent) {
  if (!mdContent || mdContent.trim() === "") {
    return;
  }

  const tokens = md.parse(normalizeMarkdownForExport(mdContent), {});
  let i = 0;
  let nextBodyParagraphStartsSection = false;

  while (i < tokens.length) {
    const token = tokens[i];

    try {
      // HANDLE HEADINGS
      if (token.type === "heading_open") {
        const level = parseInt(token.tag.slice(1), 10);
        const nextToken = tokens[i + 1];

        if (nextToken && nextToken.type === "inline") {
          let fontSize;

          switch (level) {
            case 1:
              fontSize = PDF_CONFIG.sizes.h1;
              break;
            case 2:
              fontSize = PDF_CONFIG.sizes.h2;
              break;
            case 3:
              fontSize = PDF_CONFIG.sizes.h3;
              break;
            default:
              fontSize = PDF_CONFIG.sizes.h3;
          }

          doc.moveDown(0.9);
          renderTextBlock(doc, nextToken.content, {
            font: PDF_CONFIG.fonts.heading,
            size: fontSize,
            color: PDF_CONFIG.colors.heading,
            after: 0.45,
            minHeight: 80,
          });
          nextBodyParagraphStartsSection = true;

          i += 2; // Skip heading_open and inline tokens
          continue;
        }
      }

      // HANDLE CODE BLOCKS
      if (token.type === "fence" || token.type === "code_block") {
        renderCodeBlock(doc, token);
        i++;
        continue;
      }

      // HANDLE PARAGRAPHS
      if (token.type === "paragraph_open") {
        const nextToken = tokens[i + 1];

        if (nextToken && nextToken.type === "inline") {
          const images = collectInlineImages(nextToken);
          const textContent = images.length
            ? inlineTextWithoutImages(nextToken).trim()
            : nextToken.content;

          if (images.length) {
            doc.moveDown(0.5);
          }

          images.forEach((image) => {
            renderImageBlock(doc, image.src, image.alt);
          });

          if (textContent) {
            renderTextBlock(doc, textContent, {
              bodyParagraph: true,
              indent: nextBodyParagraphStartsSection
                ? 0
                : PDF_CONFIG.sizes.body *
                  PDF_CONFIG.typography.firstLineIndentRatio,
            });
            nextBodyParagraphStartsSection = false;
          }

          i += 2; // Skip paragraph_open and inline tokens
          continue;
        }
      }

      // HANDLE BULLET LISTS
      if (token.type === "bullet_list_open") {
        doc.moveDown(0.5);
        i++;

        while (i < tokens.length && tokens[i].type !== "bullet_list_close") {
          if (tokens[i].type === "list_item_open") {
            i++;

            if (tokens[i] && tokens[i].type === "paragraph_open") {
              i++;

              if (tokens[i] && tokens[i].type === "inline") {
                renderListItem(doc, "-", tokens[i].content);
              }
            }
          }
          i++;
        }

        doc.moveDown(0.5);
        i++;
        continue;
      }

      // HANDLE ORDERED LISTS
      if (token.type === "ordered_list_open") {
        doc.moveDown(0.5);
        let listCounter = 1;
        i++;

        while (i < tokens.length && tokens[i].type !== "ordered_list_close") {
          if (tokens[i].type === "list_item_open") {
            i++;

            if (tokens[i] && tokens[i].type === "paragraph_open") {
              i++;

              if (tokens[i] && tokens[i].type === "inline") {
                renderListItem(doc, `${listCounter}.`, tokens[i].content);
                listCounter++;
              }
            }
          }
          i++;
        }

        doc.moveDown(0.5);
        i++;
        continue;
      }

      i++;
    } catch (error) {
      console.error("Error processing PDF token:", token, error);
      i++;
    }
  }
}

function renderChildrenImagePlaceholder(doc, x, y, width, height) {
  doc
    .roundedRect(x, y, width, height, 8)
    .fillAndStroke("#f8fafc", "#cbd5e1");
  doc
    .font(PDF_CONFIG.fonts.bodyItalic)
    .fontSize(10)
    .fillColor(PDF_CONFIG.colors.pageNumber)
    .text("Illustration unavailable", x + 16, y + height / 2 - 7, {
      width: width - 32,
      align: "center",
    });
}

function renderChildrenImagePage(doc, { imagePath, alt = "", text = "" }) {
  const pageTop = PDF_CONFIG.margins.top;
  const pageBottom = doc.page.height - PDF_CONFIG.margins.bottom;
  const contentWidth = getContentWidth(doc);
  const imageX = PDF_CONFIG.margins.left;
  const textWidth = Math.min(contentWidth, 410);
  const textX = PDF_CONFIG.margins.left + (contentWidth - textWidth) / 2;
  const textContent = normalizeChildrenPageText(text);
  const imageTextFontSize = 12.5;

  doc.font(PDF_CONFIG.fonts.body).fontSize(imageTextFontSize);
  const textHeightValue = textContent
    ? Math.min(
        185,
        Math.max(
          58,
          textHeight(doc, textContent, {
            width: textWidth,
            align: "center",
            lineGap: 4,
          }) + 8
        )
      )
    : 0;
  const gap = textContent ? 18 : 0;
  const maxImageHeight = Math.max(
    220,
    pageBottom - pageTop - textHeightValue - gap
  );
  let imageBottom = pageTop;

  if (imagePath) {
    try {
      const dimensions = fitImageAllowUpscale(
        doc,
        imagePath,
        contentWidth,
        maxImageHeight
      );
      const x = imageX + (contentWidth - dimensions.width) / 2;

      doc.image(imagePath, x, pageTop, {
        width: dimensions.width,
        height: dimensions.height,
      });
      imageBottom = pageTop + dimensions.height;
    } catch (error) {
      console.error(`Could not embed children's PDF image: ${imagePath}`, error);
      renderChildrenImagePlaceholder(doc, imageX, pageTop, contentWidth, 300);
      imageBottom = pageTop + 300;
    }
  } else {
    if (alt) {
      console.warn(`Children's PDF image unavailable: ${alt}`);
    }

    renderChildrenImagePlaceholder(doc, imageX, pageTop, contentWidth, 300);
    imageBottom = pageTop + 300;
  }

  if (textContent) {
    const textY = Math.min(
      Math.max(imageBottom + gap, pageBottom - textHeightValue),
      pageBottom - textHeightValue
    );

    doc
      .font(PDF_CONFIG.fonts.body)
      .fontSize(imageTextFontSize)
      .fillColor(PDF_CONFIG.colors.body)
      .text(textContent, textX, textY, {
        width: textWidth,
        align: "center",
        lineGap: 4,
      });
  }
}

function renderChildrenTextPage(doc, { title = "", text = "" }) {
  const contentWidth = getContentWidth(doc);
  const textContent = normalizeChildrenPageText(text);

  doc
    .font(PDF_CONFIG.fonts.heading)
    .fontSize(PDF_CONFIG.sizes.h2)
    .fillColor(PDF_CONFIG.colors.chapterTitle)
    .text(title || "Story", {
      align: "center",
    });
  doc.moveDown(1.2);

  if (!textContent) {
    return;
  }

  doc
    .font(PDF_CONFIG.fonts.body)
    .fontSize(14)
    .fillColor(PDF_CONFIG.colors.body)
    .text(textContent, PDF_CONFIG.margins.left, doc.y, {
      width: contentWidth,
      align: "left",
      lineGap: 5,
    });
}

function renderChildrenScenePdf(doc, chapter) {
  const markdown = getChapterMarkdownForExport(chapter);
  const firstImage = getFirstMarkdownImage(markdown);
  const imagePath = firstImage?.src ? resolveExportImagePath(firstImage.src) : "";
  const pageParts = getChildrenPagePartsFromMarkdown(markdown, chapter.title);
  const imagePageText = pageParts.leftText;
  const textPageText = pageParts.rightText || pageParts.leftText;

  doc.addPage();
  renderChildrenImagePage(doc, {
    imagePath,
    alt: firstImage?.alt || chapter.title,
    text: imagePageText,
  });

  doc.addPage();
  renderChildrenTextPage(doc, {
    title: chapter.title,
    text: textPageText,
  });
}

// MAIN PDF GENERATION FUNCTION
async function generatePdf(book, res) {
  await prepareExportImages(book);

  return new Promise((resolve, reject) => {
    const runtimeConfig = getKdpPdfConfig(book);
    const restorePdfConfig = applyPdfRuntimeConfig(runtimeConfig);

    try {
      const doc = new PDFDocument({
        bufferPages: true,
        size: runtimeConfig.pageSize,
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      });

      if (doc._root?.data) {
        doc._root.data.PageLayout = "TwoPageRight";
      }

      doc.pipe(res);

      doc.on("error", (err) => {
        console.error("PDF generation error:", err);
        reject(err);
      });

      // Front cover is page 1 so two-page viewers place it on the right.
      if (book.coverImage && !book.coverImage.includes("pravatar")) {
        const imagePath = resolveExportImagePath(book.coverImage);

        try {
          if (imagePath) {
            renderContainedFullPageImage(doc, imagePath);
          } else {
            console.warn(`PDF cover image not found: ${book.coverImage}`);
            renderKdpFrontCoverFallback(doc, book);
          }
        } catch (imgErr) {
          console.error(`Could not embed cover image: ${book.coverImage}`, imgErr);
          renderKdpFrontCoverFallback(doc, book);
        }
      } else {
        renderKdpFrontCoverFallback(doc, book);
      }

      doc.addPage({
        size: runtimeConfig.pageSize,
        margins: getKdpInteriorPageMargins(runtimeConfig, 1),
      });

      const firstInteriorPageIndex = 1;

      const addRawPdfPage = configureKdpInteriorPagination(doc, runtimeConfig, 1);

      // TITLE PAGE
      doc.moveDown(8);

      doc
        .font(PDF_CONFIG.fonts.heading)
        .fontSize(PDF_CONFIG.sizes.title)
        .fillColor(PDF_CONFIG.colors.title)
        .text(book.title, {
          align: "center",
        });

      doc.moveDown(2);

      if (book.subtitle && book.subtitle.trim()) {
        doc
          .fontSize(PDF_CONFIG.sizes.subtitle)
          .fillColor(PDF_CONFIG.colors.subtitle)
          .text(book.subtitle, {
            align: "center",
          });

        doc.moveDown(2);
      }

      doc
        .fontSize(PDF_CONFIG.sizes.author)
        .fillColor(PDF_CONFIG.colors.author)
        .text(`by ${book.author}`, {
          align: "center",
        });

      doc.moveDown(2);

      doc
        .moveTo(doc.page.width / 2 - 100, doc.y)
        .lineTo(doc.page.width / 2 + 100, doc.y)
        .stroke("#4f46e5");

      const copyrightPage = String(
        book?.kdp?.assets?.copyrightPage || ""
      ).trim();
      const tocEntries = buildKdpTocEntries(book, runtimeConfig);

      if (copyrightPage) {
        doc.addPage();
        renderKdpFrontMatterPage(
          doc,
          "Copyright",
          copyrightPage.split(/\n{2,}/).filter(Boolean)
        );
      }

      for (let tocIndex = 0; tocIndex < runtimeConfig.tocPageCount; tocIndex += 1) {
        const startIndex = tocIndex * runtimeConfig.tocEntriesPerPage;
        const entriesForPage = tocEntries.slice(
          startIndex,
          startIndex + runtimeConfig.tocEntriesPerPage
        );
        doc.addPage();
        renderKdpTableOfContents(doc, entriesForPage, tocIndex);
      }

      if ((book?.chapters || []).length && (doc._kdpInteriorPageNumber + 1) % 2 === 0) {
        doc.addPage();
      }

      (book?.chapters || []).forEach((chapter, index) => {
        try {
          renderKdpChapterPrintPages(doc, chapter, index, runtimeConfig);
        } catch (chapterErr) {
          console.error(
            `Error processing chapter ${index + 1} for PDF:`,
            chapterErr
          );
        }
      });

      while (doc._kdpInteriorPageNumber < runtimeConfig.pageCount) {
        doc.addPage();
      }

      renderKdpPageFolios(doc, runtimeConfig, firstInteriorPageIndex);
      addRawPdfPage({
        size: runtimeConfig.pageSize,
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      });
      renderKdpBackCoverPage(doc, book);
      doc.end();
      restorePdfConfig();

      doc.on("end", () => {
        resolve();
      });
    } catch (error) {
      restorePdfConfig();
      reject(error);
    }
  });
}

module.exports = {
  generatePdf,
  __private: {
    countChildrenPageWords,
    getChildrenPagePartsFromMarkdown,
    getCoverImagePlacement,
    estimateKdpChapterPageCount,
    getFirstMarkdownImage,
    getKdpMargins,
    getKdpPageSize,
    getKdpPdfConfig,
    getKdpTextPageMetrics,
    getMarkdownImageBlocks,
    getKdpChapterOpeningReserveLines,
    isDiagramCodeBlock,
    normalizeCodeTextForPdf,
    splitKdpTextIntoPrintPages,
    splitTextForChildrenImagePage,
    parseAsciiTableDiagram,
    parseBoxedListDiagram,
    parseBranchDiagram,
    parseComparisonDiagram,
    parseFlowDiagram,
    parseLinearFlowDiagram,
    parseNestedArchitectureDiagram,
    parseProcessDiagram,
    parseSystemComparisonDiagram,
    parseStackDiagram,
  },
};
