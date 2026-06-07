import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import toast from "react-hot-toast";
import MDEditor from "@uiw/react-md-editor";
import rehypeSanitize from "rehype-sanitize";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Copy,
  Download,
  Eye,
  FileText,
  Image as ImageIcon,
  Loader2,
  PackageCheck,
  Pencil,
  Sparkles,
  TriangleAlert,
  WandSparkles,
  XCircle,
} from "lucide-react";
import DashboardLayout from "../layouts/DashboardLayout";
import axiosInstance from "../lib/axios";
import { API_ENDPOINTS, resolveImageUrl } from "../utils/api-endpoints";
import { normalizeBook } from "../utils/api-shapes";
import { markdownToPlainText } from "../utils/markdown-clipboard";
import { splitKdpMarkdownIntoPreviewPages } from "../utils/kdp-markdown-blocks";
import KdpPreviewBlock from "../components/kdp/KdpPreviewBlock";
import KdpPreviewDiagram from "../components/kdp/KdpPreviewDiagram";

const TRIM_SIZES = [
  { id: "5x8", label: '5" × 8"', width: 5, height: 8 },
  { id: "5.25x8", label: '5.25" × 8"', width: 5.25, height: 8 },
  { id: "5.5x8.5", label: '5.5" × 8.5"', width: 5.5, height: 8.5 },
  { id: "6x9", label: '6" × 9"', width: 6, height: 9 },
  { id: "7x10", label: '7" × 10"', width: 7, height: 10 },
  { id: "8.5x11", label: '8.5" × 11"', width: 8.5, height: 11 },
];

const PAPER_TYPES = [
  {
    id: "bw-white",
    label: "B&W white paper",
    spinePerPage: 0.002252,
    previewPaper: "#ffffff",
    previewInk: "#111827",
  },
  {
    id: "bw-cream",
    label: "B&W cream paper",
    spinePerPage: 0.0025,
    previewPaper: "#f8f1df",
    previewInk: "#17120b",
  },
  {
    id: "color",
    label: "Color interior",
    spinePerPage: 0.002347,
    previewPaper: "#ffffff",
    previewInk: "#111827",
  },
];

const FONT_SIZE_OPTIONS = [
  { value: "10", label: "10 pt compact" },
  { value: "11", label: "11 pt standard" },
  { value: "12", label: "12 pt trade" },
  { value: "13", label: "13 pt large" },
  { value: "14", label: "14 pt reader" },
  { value: "16", label: "16 pt large print" },
  { value: "18", label: "18 pt early reader" },
  { value: "20", label: "20 pt children's" },
  { value: "22", label: "22 pt picture book" },
  { value: "24", label: "24 pt read-aloud" },
  { value: "28", label: "28 pt board book" },
  { value: "32", label: "32 pt display text" },
];

const TABS = [
  { id: "interior", label: "Interior PDF", icon: BookOpen },
  { id: "cover", label: "Cover Builder", icon: ImageIcon },
  { id: "metadata", label: "Listing Copy", icon: FileText },
  { id: "preview", label: "Full Preview", icon: Eye },
  { id: "preflight", label: "Preflight", icon: ClipboardCheck },
];

const KDP_GUTTER_RULES = [
  { maxPages: 150, gutter: 0.375 },
  { maxPages: 300, gutter: 0.5 },
  { maxPages: 500, gutter: 0.625 },
  { maxPages: 700, gutter: 0.75 },
  { maxPages: 828, gutter: 0.875 },
];

const PREVIEW_SERIF_FONT_FAMILY =
  '"Times New Roman", Times, serif';
const PRINT_AVERAGE_CHAR_WIDTH_RATIO = 0.45;
const PRINT_PAGE_LINE_SAFETY = 0;
const MAX_PRINT_FONT_SIZE = 32;

const TOC_DESIGNS = [
  { id: "basic", label: "Standard" },
  { id: "editorial", label: "Editorial" },
  { id: "classic", label: "Classic" },
  { id: "modern", label: "Modern" },
  { id: "luxe", label: "Luxe" },
  { id: "ledger", label: "Ledger" },
];

const META_FIELDS = [
  {
    id: "description",
    label: "Amazon Description",
    action: "kdp_description",
    buttonLabel: "Generate",
    hint: "Up to 4,000 characters. HTML supported on KDP.",
    rows: 10,
  },
  {
    id: "keywords",
    label: "7 Keyword Slots",
    action: "kdp_keywords",
    buttonLabel: "Generate",
    hint: "One phrase per line. Max 7 entries, max 50 chars each.",
    rows: 7,
  },
  {
    id: "categories",
    label: "Categories",
    action: "kdp_categories",
    buttonLabel: "Suggest",
    hint: "KDP allows up to 10 categories via Author Central.",
    rows: 6,
  },
  {
    id: "backCoverBlurb",
    label: "Back-Cover Blurb",
    action: "kdp_blurb",
    buttonLabel: "Generate",
    hint: "Keep under 150 words for standard paperback layouts.",
    rows: 8,
  },
  {
    id: "authorBio",
    label: "Author Bio",
    action: "kdp_author_bio",
    buttonLabel: "Write Bio",
    hint: "Used on the back cover and Amazon author page.",
    rows: 6,
  },
  {
    id: "copyrightPage",
    label: "Copyright Page",
    action: "kdp_copyright",
    buttonLabel: "Draft",
    hint: "Front matter page included in the interior PDF.",
    rows: 6,
  },
];

const DEFAULT_SETTINGS = {
  format: "paperback",
  trimSize: "6x9",
  paperType: "bw-white",
  pageCountOverride: "",
  fontSize: "12",
  interiorBleed: "none",
  marginTop: "",
  marginBottom: "",
  marginInside: "",
  marginOutside: "",
  lineSpacing: "1.44",
  paragraphIndent: "1.35",
  renderDiagrams: "false",
  coverImageSize: "2K",
  tocDesign: "basic",
};

const DEFAULT_METADATA = {
  tableOfContents: "",
  description: "",
  keywords: "",
  categories: "",
  backCoverBlurb: "",
  authorBio: "",
  copyrightPage: "",
  coverPrompt: "",
  riskNotes: "",
};

function countWords(value = "") {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function stripMarkdown(value = "") {
  return String(value || "")
    .replace(/!\[[^\]]*]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/[`*_>#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeFontSize(value) {
  const size = Number.parseFloat(value);

  if (!Number.isFinite(size)) return 12;

  return Math.min(MAX_PRINT_FONT_SIZE, Math.max(9, size));
}

function normalizeMeasurement(value, fallback, min, max = 2) {
  const size = Number.parseFloat(value);

  if (!Number.isFinite(size)) return fallback;

  return Math.min(max, Math.max(min, size));
}

function normalizeLineSpacing(value) {
  return normalizeMeasurement(value, 1.44, 1.15, 1.8);
}

function normalizeParagraphIndent(value) {
  return normalizeMeasurement(value, 1.35, 0, 2.25);
}

function usesInteriorBleed(settings = {}) {
  return settings.interiorBleed === "bleed";
}

function shouldRenderKdpDiagrams(settings = {}) {
  return String(settings.renderDiagrams || "").toLowerCase() === "true";
}

function getKdpGutterMinimum(pageCount = 24) {
  const normalizedPageCount = Math.max(24, Number(pageCount) || 24);

  return (
    KDP_GUTTER_RULES.find((rule) => normalizedPageCount <= rule.maxPages)
      ?.gutter || KDP_GUTTER_RULES[KDP_GUTTER_RULES.length - 1].gutter
  );
}

function getKdpBookMargins(trim, pageCount = 24, settings = {}) {
  const gutterMinimum = getKdpGutterMinimum(pageCount);
  const outsideMinimum = usesInteriorBleed(settings) ? 0.375 : 0.25;
  const compactTrim = trim.width <= 5.5 || trim.height <= 8;
  const baseMargins = compactTrim
    ? { top: 0.68, bottom: 0.78, inside: 0.78, outside: 0.58 }
    : { top: 0.78, bottom: 0.88, inside: 0.9, outside: 0.68 };

  return {
    top: normalizeMeasurement(
      settings.marginTop,
      baseMargins.top,
      outsideMinimum
    ),
    bottom: normalizeMeasurement(
      settings.marginBottom,
      baseMargins.bottom,
      outsideMinimum
    ),
    inside: normalizeMeasurement(
      settings.marginInside,
      Math.max(gutterMinimum + 0.2, baseMargins.inside),
      gutterMinimum
    ),
    outside: normalizeMeasurement(
      settings.marginOutside,
      Math.max(outsideMinimum, baseMargins.outside),
      outsideMinimum
    ),
    gutterMinimum,
    outsideMinimum,
  };
}

function getTextPageMetrics(
  trim,
  fontSize,
  margins,
  lineSpacing = 1.44,
  paragraphIndentRatio = 1.35
) {
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
    Math.floor(
      (contentWidth * 72) / (fontSize * PRINT_AVERAGE_CHAR_WIDTH_RATIO)
    )
  );

  return {
    charsPerLine,
    effectiveLineSpacing,
    fontSize,
    lineHeightPoints: effectiveLineHeightInches * 72,
    lineWidthPoints: contentWidth * 72,
    linesPerPage,
    paragraphIndentPoints: fontSize * paragraphIndentRatio,
    paragraphIndentRatio,
    renderLineBuffer: 0,
    wordsPerPage: Math.max(
      70,
      Math.round(textArea * densityAt12pt * fontScale * lineScale)
    ),
  };
}

function roundToEvenPageCount(value) {
  const pageCount = Math.max(1, Math.ceil(value));

  return pageCount % 2 === 0 ? pageCount : pageCount + 1;
}

function getPlainParagraphs(value = "") {
  return String(value || "")
    .replace(/!\[[^\]]*]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((paragraph) =>
      paragraph
        .replace(/[`*_>#]/g, " ")
        .replace(/^\s*[-+]\s+/gm, "")
        .replace(/[ \t\n]+/g, " ")
        .trim()
    )
    .filter(Boolean);
}

function getMarkdownImageBlocks(value = "") {
  const source = String(value || "");
  const imageRegex = /!\[([^\]]*)]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g;
  const images = [];
  let match;

  while ((match = imageRegex.exec(source)) !== null) {
    const url = String(match[2] || "").trim();

    if (url) {
      images.push({
        alt: String(match[1] || "Chapter illustration").trim(),
        url,
      });
    }
  }

  return images;
}

function getChapterImagePageCount(chapter = {}) {
  return getMarkdownImageBlocks(chapter.content).length;
}

function normalizeTextPageMetrics(metricsOrWordsPerPage = 220) {
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

function getChapterOpeningReserveLines(textMetrics) {
  return Math.max(3, Math.floor(textMetrics.linesPerPage * 0.1));
}

function shouldCompactKdpDiagramBlock(block) {
  if (!block || (block.type !== "diagram" && block.type !== "code")) {
    return false;
  }

  const sourceLines = String(block.content || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean).length;
  const bracketNodes = (String(block.content || "").match(/\[[^\]]{2,}\]/g) || [])
    .length;

  return sourceLines <= 6 && bracketNodes <= 3;
}

function escapeRegExp(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripChapterOpenerFromMarkdown(
  markdown = "",
  chapterIndex,
  chapterTitle = ""
) {
  const chapterNum = chapterIndex + 1;
  const titlePart = escapeRegExp(String(chapterTitle || "").trim());
  const exactOpenerPattern = new RegExp(
    `^#{0,6}\\s*Chapter\\s+${chapterNum}\\s*[:\\-–]?\\s*${titlePart}\\s*\\n+`,
    "im"
  );
  const fallbackOpenerPattern = new RegExp(
    `^#{0,6}\\s*Chapter\\s+${chapterNum}\\s*[:\\-–]?\\s*[^\\n]+\\n+`,
    "im"
  );
  const source = String(markdown || "");

  if (exactOpenerPattern.test(source)) {
    return source.replace(exactOpenerPattern, "");
  }

  return source.replace(fallbackOpenerPattern, "");
}

function stripDuplicateChapterHeaderBlocks(
  blocks = [],
  chapterIndex,
  chapterTitle = ""
) {
  const cleaned = [...blocks];
  const chapterNum = chapterIndex + 1;
  const normalizedTitle = String(chapterTitle || "").trim().toLowerCase();
  const chapterPrefix = new RegExp(
    `^chapter\\s+${chapterNum}\\s*[:\\-–]?\\s*`,
    "i"
  );

  while (cleaned.length) {
    const first = cleaned[0];
    const text = String(first.text || "").trim();

    const fullChapterHeading = normalizedTitle
      ? new RegExp(
          `^chapter\\s+${chapterNum}\\s*[:\\-–]?\\s*${escapeRegExp(
            String(chapterTitle || "").trim()
          )}$`,
          "i"
        )
      : null;

    if (
      first.type === "heading" &&
      (chapterPrefix.test(text) ||
        (fullChapterHeading && fullChapterHeading.test(text)))
    ) {
      cleaned.shift();
      continue;
    }

    if (
      first.type === "heading" &&
      normalizedTitle &&
      text.toLowerCase() === normalizedTitle
    ) {
      cleaned.shift();
      continue;
    }

    if (first.type === "paragraph" && chapterPrefix.test(text)) {
      const remainder = text.replace(chapterPrefix, "").trim();

      if (!remainder || remainder.toLowerCase() === normalizedTitle) {
        cleaned.shift();
        continue;
      }

      cleaned[0] = { ...first, text: remainder };
    }

    break;
  }

  return cleaned;
}

let previewMeasureContext;
const previewWordWidthCache = new Map();

function getPreviewMeasureContext(fontSize) {
  if (typeof document === "undefined") return null;

  if (!previewMeasureContext) {
    previewMeasureContext = document.createElement("canvas").getContext("2d");
  }

  if (!previewMeasureContext) return null;

  previewMeasureContext.font = `${fontSize}px ${PREVIEW_SERIF_FONT_FAMILY}`;

  return previewMeasureContext;
}

function getPreviewMeasuredTokenWidth(token, fontSize) {
  const cacheKey = `${fontSize}:${token}`;

  if (previewWordWidthCache.has(cacheKey)) {
    return previewWordWidthCache.get(cacheKey);
  }

  const context = getPreviewMeasureContext(fontSize);

  if (!context) return null;

  const width = context.measureText(token).width;

  if (previewWordWidthCache.size > 12000) {
    previewWordWidthCache.clear();
  }

  previewWordWidthCache.set(cacheKey, width);

  return width;
}

function estimateMeasuredPreviewTextLines(normalized, textMetrics, options = {}) {
  const fontSize = Number(textMetrics.fontSize);
  const lineWidth = Number(textMetrics.lineWidthPoints);

  if (!Number.isFinite(fontSize) || !Number.isFinite(lineWidth)) return null;

  const words = normalized.split(/\s+/).filter(Boolean);

  if (!words.length) return 0;

  const spaceWidth = getPreviewMeasuredTokenWidth(" ", fontSize);

  if (!Number.isFinite(spaceWidth)) return null;

  const indentWidth = options.continuation
    ? 0
    : Number(textMetrics.paragraphIndentPoints) ||
      fontSize * (Number(textMetrics.paragraphIndentRatio) || 1.35);
  let lineCount = 1;
  let lineLimit = Math.max(fontSize * 2, lineWidth - indentWidth);
  let currentLineWidth = 0;

  for (const word of words) {
    const wordWidth = getPreviewMeasuredTokenWidth(word, fontSize);

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

function estimatePreviewTextLines(text = "", textMetrics, options = {}) {
  const normalized = String(text || "").trim();

  if (!normalized) return 0;

  const measuredLineCount = estimateMeasuredPreviewTextLines(
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
        (Number(textMetrics.paragraphIndentRatio) || 1.35) /
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

function splitTextIntoPreviewPages(
  text = "",
  metricsOrWordsPerPage = 220,
  options = {}
) {
  const textMetrics = normalizeTextPageMetrics(metricsOrWordsPerPage);

  return splitKdpMarkdownIntoPreviewPages(
    text,
    textMetrics,
    options,
    estimatePreviewTextLines
  );
}

function getTocEntriesPerPage(trim, fontSize, margins) {
  const usableHeight = Math.max(4, trim.height - margins.top - margins.bottom);
  const reservedHeaderHeight = 0.85;
  const entryHeight = Math.max(0.17, (fontSize / 72) * 1.35);

  return Math.max(
    12,
    Math.floor((usableHeight - reservedHeaderHeight) / entryHeight)
  );
}

function getTocPageCount(chapters, trim, fontSize, margins) {
  return Math.max(
    1,
    Math.ceil(
      Math.max(1, chapters.length) / getTocEntriesPerPage(trim, fontSize, margins)
    )
  );
}

function estimateTextPageCount({
  chapters,
  metadata,
  tocPageCount,
  textMetrics,
  settings,
}) {
  const frontMatterBasePages =
    1 + (String(metadata.copyrightPage || "").trim() ? 1 : 0) + tocPageCount;
  const rectoBlankPage =
    chapters.length && (frontMatterBasePages + 1) % 2 === 0 ? 1 : 0;
  const frontMatterPages = frontMatterBasePages + rectoBlankPage;
  const firstPageReserveLines = getChapterOpeningReserveLines(textMetrics);
  const chapterPages = chapters.reduce(
    (sum, chapter) =>
      sum +
      splitTextIntoPreviewPages(chapter.content, textMetrics, {
        firstPageReserveLines,
        renderDiagrams: shouldRenderKdpDiagrams(settings),
      }).length,
    0
  );
  const chapterImagePages = chapters.reduce(
    (sum, chapter) => sum + getChapterImagePageCount(chapter),
    0
  );

  return frontMatterPages + chapterImagePages + chapterPages;
}

function estimateBookLayout({ chapters, metadata, trim, fontSize, settings }) {
  const lineSpacing = normalizeLineSpacing(settings.lineSpacing);
  const paragraphIndent = normalizeParagraphIndent(settings.paragraphIndent);
  let pageCount = 120;
  let margins = getKdpBookMargins(trim, pageCount, settings);
  let textMetrics = getTextPageMetrics(
    trim,
    fontSize,
    margins,
    lineSpacing,
    paragraphIndent
  );
  let tocPageCount = getTocPageCount(chapters, trim, fontSize, margins);
  let textPageCount = estimateTextPageCount({
    chapters,
    metadata,
    tocPageCount,
    textMetrics,
    settings,
  });

  for (let index = 0; index < 5; index += 1) {
    pageCount = roundToEvenPageCount(textPageCount);
    margins = getKdpBookMargins(trim, pageCount, settings);
    textMetrics = getTextPageMetrics(
      trim,
      fontSize,
      margins,
      lineSpacing,
      paragraphIndent
    );
    tocPageCount = getTocPageCount(chapters, trim, fontSize, margins);
    textPageCount = estimateTextPageCount({
      chapters,
      metadata,
      tocPageCount,
      textMetrics,
      settings,
    });
  }

  const finalChapterPages = chapters.reduce(
    (sum, chapter) =>
      sum +
      splitTextIntoPreviewPages(chapter.content, textMetrics, {
        firstPageReserveLines: getChapterOpeningReserveLines(textMetrics),
        renderDiagrams: shouldRenderKdpDiagrams(settings),
      }).length,
    0
  );
  const finalFrontMatterPages =
    1 +
    (String(metadata.copyrightPage || "").trim() ? 1 : 0) +
    tocPageCount +
    (chapters.length && (1 + (String(metadata.copyrightPage || "").trim() ? 1 : 0) + tocPageCount + 1) % 2 === 0
      ? 1
      : 0);
  textPageCount = roundToEvenPageCount(
    Math.max(textPageCount, finalFrontMatterPages + finalChapterPages)
  );

  return {
    margins,
    pageCount: roundToEvenPageCount(textPageCount),
    textPageCount,
    textMetrics,
    tocPageCount,
    tocEntriesPerPage: getTocEntriesPerPage(trim, fontSize, margins),
    wordsPerPage: textMetrics.wordsPerPage,
  };
}

function getPreviewPagePadding(page, margins, pageCanvas, hasBleed = false) {
  if (!page?.interiorPageNumber) return undefined;

  const isRightHandPage = page.interiorPageNumber % 2 === 1;
  const bleedEdge = hasBleed ? 0.125 : 0;
  const left = isRightHandPage ? margins.inside : margins.outside + bleedEdge;
  const right = isRightHandPage ? margins.outside + bleedEdge : margins.inside;
  const toPageWidthUnit = (inches) =>
    `${((inches / pageCanvas.width) * 100).toFixed(4)}cqw`;

  return {
    paddingTop: toPageWidthUnit(margins.top + bleedEdge),
    paddingRight: toPageWidthUnit(right),
    paddingBottom: toPageWidthUnit(margins.bottom + bleedEdge),
    paddingLeft: toPageWidthUnit(left),
  };
}

function buildPreviewPages({
  book,
  chapters,
  metadata,
  tocEntriesPerPage,
  tocPageCount,
  textMetrics,
  finalInteriorPageCount,
  settings,
}) {
  const pages = [
    { id: "front-cover-blank", kind: "spread-blank", label: "Front Cover" },
    { id: "front-cover", kind: "cover", label: "Front Cover" },
  ];
  let interiorPageNumber = 0;
  const addInteriorPage = (page) => {
    interiorPageNumber += 1;
    const previewPage = { ...page, interiorPageNumber };
    pages.push(previewPage);

    return previewPage;
  };

  addInteriorPage({
    id: "title",
    kind: "title",
    label: "Title Page",
    title: book?.title || "Untitled",
    subtitle: book?.subtitle || "",
    author: book?.author || "",
  });

  if (String(metadata.copyrightPage || "").trim()) {
    addInteriorPage({
      id: "copyright",
      kind: "front-matter",
      label: "Copyright",
      title: "Copyright",
      paragraphs: getPlainParagraphs(metadata.copyrightPage),
    });
  }

  const tocPages = [];

  for (let tocIndex = 0; tocIndex < tocPageCount; tocIndex += 1) {
    const tocPage = {
      id: `toc-${tocIndex + 1}`,
      kind: "toc",
      label: tocIndex === 0 ? "Contents" : `Contents, p. ${tocIndex + 1}`,
      title: "Contents",
      entries: [],
    };
    tocPages.push(addInteriorPage(tocPage));
  }

  if (chapters.length && (interiorPageNumber + 1) % 2 === 0) {
    addInteriorPage({
      id: "blank-before-chapter-1",
      kind: "blank",
      label: "Blank verso",
      paragraphs: [],
    });
  }

  const tocEntries = [];
  const firstPageReserveLines = getChapterOpeningReserveLines(textMetrics);

  chapters.forEach((chapter, chapterIndex) => {
    const imageBlocks = getMarkdownImageBlocks(chapter.content);
    let tocPageNumber = null;
    const addTocEntryOnce = (previewPage) => {
      if (tocPageNumber) return;

      tocPageNumber = previewPage.interiorPageNumber;
      tocEntries.push({
        chapterLabel: `Chapter ${chapterIndex + 1}`,
        title: chapter.title || `Chapter ${chapterIndex + 1}`,
        pageNumber: tocPageNumber,
      });
    };

    imageBlocks.forEach((image, imageIndex) => {
      const previewPage = addInteriorPage({
        id: `chapter-${chapterIndex}-image-${imageIndex}`,
        kind: "chapter-image",
        label: `${chapter.title || `Chapter ${chapterIndex + 1}`} illustration${
          imageIndex > 0 ? ` ${imageIndex + 1}` : ""
        }`,
        chapterLabel: `Chapter ${chapterIndex + 1}`,
        title:
          imageIndex === 0 ? chapter.title || `Chapter ${chapterIndex + 1}` : "",
        image,
      });

      addTocEntryOnce(previewPage);
    });

    let hasRenderedChapterHeader = imageBlocks.length > 0;

    const chapterMarkdown =
      imageBlocks.length > 0
        ? chapter.content
        : stripChapterOpenerFromMarkdown(
            chapter.content,
            chapterIndex,
            chapter.title
          );

    splitTextIntoPreviewPages(chapterMarkdown, textMetrics, {
      firstPageReserveLines: imageBlocks.length ? 0 : firstPageReserveLines,
      renderDiagrams: shouldRenderKdpDiagrams(settings),
    }).forEach((pageContent, pageIndex) => {
        const isDiagramOnlyPage =
          pageContent.blocks?.length === 1 &&
          pageContent.blocks[0]?.type === "diagram";
        const showChapterHeader = !hasRenderedChapterHeader && !isDiagramOnlyPage;
        let pageBlocks = pageContent.blocks || [];

        if (showChapterHeader) {
          pageBlocks = stripDuplicateChapterHeaderBlocks(
            pageBlocks,
            chapterIndex,
            chapter.title
          );
        }

        const previewPage = {
          id: `chapter-${chapterIndex}-${pageIndex}`,
          kind: "chapter",
          label: isDiagramOnlyPage
            ? pageContent.blocks[0]?.label || "Diagram"
            : `${chapter.title || `Chapter ${chapterIndex + 1}`}${
                pageIndex > 0 ? `, p. ${pageIndex + 1}` : ""
              }`,
          chapterLabel: showChapterHeader ? `Chapter ${chapterIndex + 1}` : "",
          title: showChapterHeader
            ? chapter.title || `Chapter ${chapterIndex + 1}`
            : "",
          blocks: pageBlocks,
        };

        if (showChapterHeader) {
          hasRenderedChapterHeader = true;
        }

        const addedPreviewPage = addInteriorPage(previewPage);

        addTocEntryOnce(addedPreviewPage);
      });
  });

  tocPages.forEach((tocPage, tocIndex) => {
    tocPage.entries = tocEntries.slice(
      tocIndex * tocEntriesPerPage,
      (tocIndex + 1) * tocEntriesPerPage
    );
  });

  while (interiorPageNumber < finalInteriorPageCount) {
    addInteriorPage({
      id: `blank-${interiorPageNumber + 1}`,
      kind: "blank",
      label: "Blank Page",
      paragraphs: [],
    });
  }

  pages.push(
    {
      id: "back-cover",
      kind: "back-cover",
      label: "Back Cover",
      paragraphs: getPlainParagraphs(metadata.backCoverBlurb),
    },
    { id: "back-cover-blank", kind: "spread-blank", label: "Back Cover" }
  );

  return {
    interiorPageCount: interiorPageNumber,
    pages,
  };
}

function safeFileName(value = "book") {
  return String(value || "book").replace(/[^a-zA-Z0-9-_]+/g, "_");
}

function buildBookContext(book, metadata, settings) {
  const chapters = Array.isArray(book?.chapters) ? book.chapters : [];
  const chapterSummaries = chapters
    .slice(0, 16)
    .map((chapter, index) => {
      const excerpt = stripMarkdown(chapter.content || "").slice(0, 520);
      return `Chapter ${index + 1}: ${chapter.title || "Untitled"}\n${excerpt}`;
    })
    .join("\n\n");

  return `Book title: ${book?.title || "Untitled"}
Subtitle: ${book?.subtitle || ""}
Author: ${book?.author || ""}
Genre: ${book?.genre || ""}
Audience: ${book?.audience || ""}
KDP format: ${settings.format}
Trim size: ${settings.trimSize}
Paper type: ${settings.paperType}
Interior bleed: ${settings.interiorBleed}
Font size: ${settings.fontSize}
Render diagrams: ${shouldRenderKdpDiagrams(settings) ? "enabled" : "disabled"}
Margins: top ${settings.marginTop || "auto"}, bottom ${
    settings.marginBottom || "auto"
  }, inside ${settings.marginInside || "auto"}, outside ${
    settings.marginOutside || "auto"
  }
Line spacing: ${settings.lineSpacing}

Current KDP assets:
Table of contents: ${metadata.tableOfContents}
Description: ${metadata.description}
Keywords: ${metadata.keywords}
Categories: ${metadata.categories}
Back cover blurb: ${metadata.backCoverBlurb}
Author bio: ${metadata.authorBio}

Book content:
${chapterSummaries}`;
}

function downloadBlob(data, filename, type) {
  const url = window.URL.createObjectURL(new Blob([data], { type }));
  const linkEl = document.createElement("a");
  linkEl.href = url;
  linkEl.setAttribute("download", filename);
  document.body.appendChild(linkEl);
  linkEl.click();
  linkEl.parentNode.removeChild(linkEl);
  window.URL.revokeObjectURL(url);
}

function readCachedKdp(storageKey) {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return null;

  try {
    return JSON.parse(saved);
  } catch {
    localStorage.removeItem(storageKey);
    return null;
  }
}

function hasKdpValues(payload = {}) {
  return Object.values(payload || {}).some((value) => String(value || "").trim());
}

const markdownComponents = {
  a({ href = "", children }) {
    const isExternal = /^https?:\/\//i.test(href);

    return (
      <a
        href={href}
        target={isExternal ? "_blank" : undefined}
        rel={isExternal ? "noreferrer" : undefined}
      >
        {children}
      </a>
    );
  },
  img({ src = "", alt = "" }) {
    return <img src={resolveImageUrl(src)} alt={alt} loading="lazy" />;
  },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StudioLabel({ children }) {
  return (
    <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-violet-600 mb-1.5">
      {children}
    </span>
  );
}

function StudioSelect({ label, value, onChange, children }) {
  return (
    <label className="block">
      <StudioLabel>{label}</StudioLabel>
      <div className="relative">
        <select
          value={value}
          onChange={onChange}
          className="w-full appearance-none bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 pr-8 transition cursor-pointer shadow-sm"
        >
          {children}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400 pointer-events-none" />
      </div>
    </label>
  );
}

function StudioTextarea({ label, value, onChange, action, rows = 8, hint }) {
  const [isPreview, setIsPreview] = useState(
    () => String(value || "").trim().length > 0
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdownToPlainText(value));
      toast.success("Copied.");
    } catch {
      toast.error("Copy failed.");
    }
  };

  const minH = Math.max(rows * 32, 220);

  return (
    <section>
      <header className="mb-2.5">
        <StudioLabel>{label}</StudioLabel>
        {hint && <p className="text-[11px] text-gray-500 -mt-0.5">{hint}</p>}
      </header>

      <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2.5">
            <div className="flex p-0.5 rounded-lg bg-gray-200 gap-px">
              <button
                type="button"
                onClick={() => setIsPreview(false)}
                aria-pressed={!isPreview}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  !isPreview
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Pencil className="size-3" />
                Edit
              </button>
              <button
                type="button"
                onClick={() => setIsPreview(true)}
                aria-pressed={isPreview}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  isPreview
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Eye className="size-3" />
                Preview
              </button>
            </div>
            <span className="text-xs text-gray-400 font-mono tabular-nums">
              {countWords(value)}w
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <GhostButton onClick={handleCopy} icon={Copy}>
              Copy
            </GhostButton>
            {action}
          </div>
        </div>

        {/* Content */}
        {isPreview ? (
          <div
            className="px-5 py-4 overflow-auto bg-white"
            style={{ minHeight: `${minH}px`, maxHeight: "36rem" }}
          >
            {String(value || "").trim() ? (
              <MDEditor.Markdown
                source={value || ""}
                rehypePlugins={[[rehypeSanitize]]}
                components={markdownComponents}
                wrapperElement={{ "data-color-mode": "light" }}
                style={{
                  backgroundColor: "transparent",
                  color: "#374151",
                  fontFamily: PREVIEW_SERIF_FONT_FAMILY,
                  fontSize: 14,
                  lineHeight: 1.8,
                }}
              />
            ) : (
              <div
                className="flex flex-col items-center justify-center gap-3 text-gray-400"
                style={{ minHeight: `${minH}px` }}
              >
                <Eye className="size-7 opacity-25" />
                <p className="text-sm text-center max-w-xs">
                  Nothing to preview yet —{" "}
                  <button
                    type="button"
                    onClick={() => setIsPreview(false)}
                    className="text-violet-600 hover:underline font-medium"
                  >
                    Edit
                  </button>{" "}
                  or use AI to generate.
                </p>
              </div>
            )}
          </div>
        ) : (
          <textarea
            rows={rows}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Write here, or use AI to generate…"
            className="w-full border-0 px-5 py-4 text-sm text-gray-900 leading-6 resize-y outline-none placeholder-gray-400 bg-white"
            style={{ minHeight: `${minH}px` }}
          />
        )}
      </div>
    </section>
  );
}

function Metric({ label, value, note, highlight = false }) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight
          ? "border-violet-200 bg-violet-50"
          : "border-gray-200 bg-white shadow-sm"
      }`}
    >
      <p
        className={`text-[10px] font-bold uppercase tracking-[0.14em] ${
          highlight ? "text-violet-600" : "text-gray-500"
        }`}
      >
        {label}
      </p>
      <p
        className={`mt-1.5 text-2xl font-bold font-mono tracking-tight ${
          highlight ? "text-violet-700" : "text-gray-900"
        }`}
      >
        {value}
      </p>
      {note && <p className="mt-1 text-[11px] text-gray-500">{note}</p>}
    </div>
  );
}

function AiButton({ children, onClick, loading, icon }) {
  const IconComponent = icon || Sparkles;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm shadow-violet-500/20 transition hover:from-violet-700 hover:to-purple-700 hover:shadow-violet-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <IconComponent className="size-3.5" />
      )}
      {children}
    </button>
  );
}

function GhostButton({ children, onClick, icon: Icon, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-200 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {Icon && <Icon className="size-3.5" />}
      {children}
    </button>
  );
}

function CheckRow({ check }) {
  const styles = {
    pass: {
      border: "border-l-emerald-500",
      icon: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    warn: {
      border: "border-l-amber-500",
      icon: "text-amber-600",
      bg: "bg-amber-50",
    },
    fail: {
      border: "border-l-rose-500",
      icon: "text-rose-600",
      bg: "bg-rose-50",
    },
  };
  const s = styles[check.status] || styles.warn;
  const Icon =
    check.status === "pass"
      ? CheckCircle2
      : check.status === "warn"
        ? TriangleAlert
        : XCircle;

  return (
    <div
      className={`rounded-xl border-l-2 border border-gray-200 ${s.border} ${s.bg} px-4 py-3.5`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`size-4 mt-0.5 shrink-0 ${s.icon}`} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">{check.title}</p>
          <p className="mt-0.5 text-xs text-gray-600 leading-5">{check.detail}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function KDPStudioPage() {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("interior");
  const [activeMetaField, setActiveMetaField] = useState("description");
  const [isMetaPreview, setIsMetaPreview] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [metadata, setMetadata] = useState(DEFAULT_METADATA);
  const [runningTool, setRunningTool] = useState("");
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  const [isSavingKdp, setIsSavingKdp] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [saveError, setSaveError] = useState("");
  const [manualSaveState, setManualSaveState] = useState("idle");
  const [previewPageIndex, setPreviewPageIndex] = useState(0);
  const [hasHydratedKdp, setHasHydratedKdp] = useState(false);
  const lastPersistedPayloadRef = useRef("");
  const saveRequestIdRef = useRef(0);
  const manualSaveTimeoutRef = useRef(null);
  const storageKey = `bookify-kdp-studio:${bookId}`;

  useEffect(
    () => () => {
      if (manualSaveTimeoutRef.current) {
        window.clearTimeout(manualSaveTimeoutRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (!hasHydratedKdp) return;
    localStorage.setItem(storageKey, JSON.stringify({ settings, metadata }));
  }, [hasHydratedKdp, metadata, settings, storageKey]);

  useEffect(() => {
    const fetchBook = async () => {
      setIsLoading(true);
      setHasHydratedKdp(false);

      try {
        const { data } = await axiosInstance.get(
          `${API_ENDPOINTS.BOOKS.GET_BY_ID}/${bookId}`
        );
        const normalizedBook = normalizeBook(data?.book);
        const serverKdp = normalizedBook?.kdp || {};
        const cachedKdp = readCachedKdp(storageKey);
        const hasServerKdp =
          Boolean(serverKdp.updatedAt) || hasKdpValues(serverKdp.assets);
        const nextSettings = {
          ...DEFAULT_SETTINGS,
          ...((hasServerKdp ? serverKdp.settings : cachedKdp?.settings) || {}),
        };
        const nextMetadata = {
          ...DEFAULT_METADATA,
          ...((hasServerKdp ? serverKdp.assets : cachedKdp?.metadata) || {}),
        };

        setBook(normalizedBook);
        setSettings(nextSettings);
        setMetadata(nextMetadata);
        setLastSavedAt(serverKdp.updatedAt ? new Date(serverKdp.updatedAt) : null);
        setSaveError("");
        lastPersistedPayloadRef.current = hasServerKdp
          ? JSON.stringify({ settings: nextSettings, metadata: nextMetadata })
          : "";
        setHasHydratedKdp(true);
      } catch (error) {
        console.error("Error fetching KDP book:", error);
        toast.error("Failed to load KDP Studio.");
        navigate("/dashboard");
      } finally {
        setIsLoading(false);
      }
    };

    fetchBook();
  }, [bookId, navigate, storageKey]);

  const chapters = useMemo(
    () => (Array.isArray(book?.chapters) ? book.chapters : []),
    [book?.chapters]
  );
  const wordCount = useMemo(
    () => chapters.reduce((sum, chapter) => sum + countWords(chapter.content), 0),
    [chapters]
  );
  const trim = TRIM_SIZES.find((item) => item.id === settings.trimSize) || TRIM_SIZES[3];
  const paper =
    PAPER_TYPES.find((item) => item.id === settings.paperType) || PAPER_TYPES[0];
  const fontSize = normalizeFontSize(settings.fontSize);
  const lineSpacing = normalizeLineSpacing(settings.lineSpacing);
  const paragraphIndent = normalizeParagraphIndent(settings.paragraphIndent);
  const hasInteriorBleed = usesInteriorBleed(settings);
  const pageCanvas = {
    width: trim.width + (hasInteriorBleed ? 0.125 : 0),
    height: trim.height + (hasInteriorBleed ? 0.25 : 0),
  };
  const bookLayout = useMemo(
    () => estimateBookLayout({ chapters, metadata, trim, fontSize, settings }),
    [chapters, fontSize, metadata, settings, trim]
  );
  const {
    margins: bookMargins,
    textMetrics,
    tocEntriesPerPage,
    tocPageCount,
    wordsPerPage,
  } = bookLayout;
  const bodyLineSpacing = textMetrics.effectiveLineSpacing || lineSpacing;
  const estimatedPageCount = bookLayout.pageCount;
  const requestedPageCount = Number(settings.pageCountOverride);
  const pageCount =
    requestedPageCount > estimatedPageCount
      ? roundToEvenPageCount(requestedPageCount)
      : estimatedPageCount;
  const spineWidth = pageCount * paper.spinePerPage;
  const coverWidth = trim.width * 2 + spineWidth + 0.25;
  const coverHeight = trim.height + 0.25;
  const coverImageUrl = book?.coverImage ? resolveImageUrl(book.coverImage) : "";
  const coverMockupStyle = {
    aspectRatio: `${coverWidth} / ${coverHeight}`,
    gridTemplateColumns: `${trim.width}fr ${Math.max(spineWidth, 0.015)}fr ${trim.width}fr`,
  };
  const previewPageWidth = Math.min(460, Math.round(pageCanvas.width * 72));
  const previewTextFontSize = `${((fontSize / Math.max(1, pageCanvas.width * 72)) * 100).toFixed(
    4
  )}cqw`;
  const pagePreviewStyle = {
    maxWidth: `${previewPageWidth}px`,
    width: "100%",
    aspectRatio: `${pageCanvas.width} / ${pageCanvas.height}`,
    backgroundColor: paper.previewPaper,
    color: paper.previewInk,
    containerType: "inline-size",
  };
  const { pages: previewPages } = useMemo(
    () =>
      buildPreviewPages({
        book,
        chapters,
        metadata,
        tocEntriesPerPage,
        tocPageCount,
        textMetrics,
        finalInteriorPageCount: pageCount,
        settings,
      }),
    [
      book,
      chapters,
      metadata,
      pageCount,
      settings,
      tocEntriesPerPage,
      tocPageCount,
      textMetrics,
    ]
  );
  const lastPreviewSpreadIndex = Math.max(
    0,
    previewPages.length <= 2
      ? 0
      : (previewPages.length - 1) % 2 === 0
        ? previewPages.length - 1
        : previewPages.length - 2
  );
  const normalizedPreviewPageIndex =
    previewPageIndex <= 1
      ? 0
      : previewPageIndex % 2 === 0
        ? previewPageIndex
        : previewPageIndex - 1;
  const spreadStartIndex = Math.min(
    normalizedPreviewPageIndex,
    lastPreviewSpreadIndex
  );
  const currentPreviewPage = previewPages[spreadStartIndex] || previewPages[0];
  const spreadPages = previewPages
    .slice(spreadStartIndex, spreadStartIndex + 2)
    .filter(Boolean);

  const preflightChecks = useMemo(
    () => [
      {
        title: "Book identity",
        status: book?.title && book?.author ? "pass" : "fail",
        detail:
          book?.title && book?.author
            ? "Title and author are present."
            : "Add a title and author before upload.",
      },
      {
        title: "Cover image",
        status: book?.coverImage ? "pass" : "fail",
        detail: book?.coverImage
          ? "A front cover exists for exports and cover planning."
          : "Generate or upload a cover before KDP upload.",
      },
      {
        title: "Table of contents",
        status: chapters.length ? "pass" : "warn",
        detail: chapters.length
          ? "Dynamic TOC page numbers are generated from the full preview."
          : "Add chapters before generating table of contents page numbers.",
      },
      {
        title: "Print spine",
        status: pageCount >= 80 ? "pass" : "warn",
        detail:
          pageCount >= 80
            ? "Spine text can be considered."
            : "KDP generally prints spine text only above 79 pages.",
      },
      {
        title: "Print page minimum",
        status: pageCount >= 24 ? "pass" : "warn",
        detail:
          pageCount >= 24
            ? "Interior page count meets the common KDP paperback minimum."
            : "KDP print books commonly require at least 24 interior pages; add content instead of padding blanks.",
      },
      {
        title: "Listing copy",
        status: metadata.description.trim() && metadata.keywords.trim() ? "pass" : "warn",
        detail: "Description and keyword slots should be ready before upload.",
      },
      {
        title: "Interior PDF",
        status: chapters.length && wordCount > 1000 ? "pass" : "warn",
        detail: `${chapters.length} chapters, ${wordCount.toLocaleString()} words, ${fontSize} pt at ${trim.label}.`,
      },
      {
        title: "Wrap cover dimensions",
        status: "pass",
        detail: `${coverWidth.toFixed(3)}" × ${coverHeight.toFixed(3)}" at final page count.`,
      },
    ],
    [
      book?.author,
      book?.coverImage,
      book?.title,
      chapters.length,
      coverHeight,
      coverWidth,
      fontSize,
      metadata.description,
      metadata.keywords,
      pageCount,
      trim.label,
      wordCount,
    ]
  );

  const readinessScore = Math.round(
    (preflightChecks.filter((c) => c.status === "pass").length /
      preflightChecks.length) *
      100
  );

  // SVG ring values
  const ringR = 38;
  const ringCircumference = 2 * Math.PI * ringR;
  const ringOffset = ringCircumference * (1 - readinessScore / 100);

  const updateSetting = (key, value) =>
    setSettings((current) => ({ ...current, [key]: value }));
  const updateMetadata = (key, value) =>
    setMetadata((current) => ({ ...current, [key]: value }));

  const handleMetaFieldChange = (fieldId) => {
    setActiveMetaField(fieldId);
    setIsMetaPreview(String(metadata[fieldId] || "").trim().length > 0);
  };

  const markManualSaveState = (state) => {
    if (manualSaveTimeoutRef.current) {
      window.clearTimeout(manualSaveTimeoutRef.current);
    }
    setManualSaveState(state);
    if (state === "saved" || state === "error") {
      manualSaveTimeoutRef.current = window.setTimeout(() => {
        setManualSaveState("idle");
      }, 1800);
    }
  };

  const persistKdp = useCallback(
    async (nextMetadata, nextSettings, options = {}) => {
      const payloadFingerprint = JSON.stringify({
        settings: nextSettings,
        metadata: nextMetadata,
      });

      if (payloadFingerprint === lastPersistedPayloadRef.current) {
        return true;
      }

      const requestId = saveRequestIdRef.current + 1;
      saveRequestIdRef.current = requestId;

      if (requestId === saveRequestIdRef.current) {
        setIsSavingKdp(true);
        setSaveError("");
      }

      try {
        const { data } = await axiosInstance.patch(
          `${API_ENDPOINTS.BOOKS.UPDATE_KDP}/${bookId}/kdp`,
          { settings: nextSettings, metadata: nextMetadata }
        );
        const updatedBook = normalizeBook(data?.book);

        if (updatedBook) setBook(updatedBook);

        if (requestId === saveRequestIdRef.current) {
          lastPersistedPayloadRef.current = payloadFingerprint;
          setLastSavedAt(new Date());
          setSaveError("");
        }

        if (options.showToast) toast.success("KDP assets saved to this book.");
        return true;
      } catch (error) {
        console.error("Error saving KDP Studio:", error);
        if (requestId === saveRequestIdRef.current) {
          setSaveError(error.response?.data?.error || "Save failed");
        }
        if (options.showToast) {
          toast.error(error.response?.data?.error || "KDP save failed.");
        }
        return false;
      } finally {
        if (requestId === saveRequestIdRef.current) setIsSavingKdp(false);
      }
    },
    [bookId]
  );

  useEffect(() => {
    if (!hasHydratedKdp || isLoading) return undefined;
    const timeoutId = window.setTimeout(() => persistKdp(metadata, settings), 900);
    return () => window.clearTimeout(timeoutId);
  }, [hasHydratedKdp, isLoading, metadata, persistKdp, settings]);

  useEffect(() => {
    setPreviewPageIndex((current) =>
      Math.min(current, Math.max(0, previewPages.length - 1))
    );
  }, [previewPages.length]);

  const handleManualKdpSave = async () => {
    markManualSaveState("saving");
    const wasSaved = await persistKdp(metadata, settings, { showToast: true });
    markManualSaveState(wasSaved ? "saved" : "error");
  };

  const goToPreviewPage = (nextIndex) => {
    const spreadIndex = nextIndex <= 1 ? 0 : nextIndex % 2 === 0 ? nextIndex : nextIndex - 1;
    const clampedIndex = Math.min(
      Math.max(0, spreadIndex),
      lastPreviewSpreadIndex
    );

    setPreviewPageIndex(clampedIndex);
  };

  const runPublishingTool = async (action, target) => {
    if (!book) return;
    setRunningTool(action);
    const loadingToast = toast.loading("Running publishing AI...");

    try {
      const {
        data: { content },
      } = await axiosInstance.post(API_ENDPOINTS.AI.QUALITY_TOOL, {
        action,
        content: buildBookContext(book, metadata, settings),
        provider: book.generation?.provider || "gemini",
        bookTitle: book.title,
        chapterTitle: "KDP Studio",
        audience: book.audience || "General readers",
      });

      const nextMetadata = { ...metadata, [target]: content || "" };
      updateMetadata(target, content || "");
      const wasSaved = await persistKdp(nextMetadata, settings);
      toast.dismiss(loadingToast);
      toast[wasSaved ? "success" : "error"](
        wasSaved ? "Generated and saved to this book." : "Generated, but save failed."
      );
    } catch (error) {
      console.error("Error running publishing AI:", error);
      toast.dismiss(loadingToast);
      toast.error(error.response?.data?.error || "Publishing AI failed.");
    } finally {
      setRunningTool("");
    }
  };

  const exportFile = async (kind) => {
    const extension = kind.toLowerCase();
    const endpoint = API_ENDPOINTS.EXPORTS[kind.toUpperCase()];
    const contentTypes = {
      pdf: "application/pdf",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      epub: "application/epub+zip",
      markdown: "text/markdown",
    };
    const loadingToast = toast.loading(`Preparing ${extension.toUpperCase()}...`);

    try {
      const wasSaved = await persistKdp(metadata, settings);

      if (!wasSaved) {
        toast.dismiss(loadingToast);
        toast.error("Save current KDP settings before exporting.");
        return;
      }

      const { data } = await axiosInstance.get(
        `${endpoint}/${bookId}/${extension}`,
        { responseType: "blob" }
      );
      downloadBlob(
        data,
        `${safeFileName(book?.title)}.${extension === "markdown" ? "md" : extension}`,
        contentTypes[extension]
      );
      toast.dismiss(loadingToast);
      toast.success(`${extension.toUpperCase()} downloaded.`);
    } catch (error) {
      console.error(`Error exporting ${extension}:`, error);
      toast.dismiss(loadingToast);
      toast.error(`Failed to export ${extension.toUpperCase()}.`);
    }
  };

  const exportTableOfContentsPdf = async () => {
    const wasSaved = await persistKdp(metadata, settings);
    if (!wasSaved) {
      toast.error("Save the table of contents before downloading.");
      return;
    }
    const loadingToast = toast.loading("Preparing TOC PDF...");
    try {
      const { data } = await axiosInstance.get(
        `${API_ENDPOINTS.EXPORTS.PDF}/${bookId}/kdp-table-of-contents.pdf?design=${encodeURIComponent(settings.tocDesign)}`,
        { responseType: "blob" }
      );
      downloadBlob(
        data,
        `${safeFileName(book?.title)}_table_of_contents.pdf`,
        "application/pdf"
      );
      toast.dismiss(loadingToast);
      toast.success("TOC PDF downloaded.");
    } catch (error) {
      console.error("Error exporting TOC PDF:", error);
      toast.dismiss(loadingToast);
      toast.error("Failed to export TOC PDF.");
    }
  };

  const generateCover = async () => {
    if (!book) return;
    setIsGeneratingCover(true);
    const loadingToast = toast.loading("Generating KDP cover...");
    const prompt =
      metadata.coverPrompt.trim() ||
      `Create a professional KDP front cover for "${book.title}" by ${book.author}. Genre: ${book.genre || "book"}. Audience: ${book.audience || "general readers"}.`;

    try {
      const {
        data: { book: nextBook },
      } = await axiosInstance.post(API_ENDPOINTS.AI.GENERATE_COVER_IMAGE, {
        bookId,
        prompt,
        aspectRatio: "2:3",
        imageSize: settings.coverImageSize,
        model: "gemini-3.1-flash-image-preview",
        mode: "generate",
      });

      setBook(normalizeBook(nextBook));
      await persistKdp(metadata, settings);
      toast.dismiss(loadingToast);
      toast.success("Cover generated.");
    } catch (error) {
      console.error("Error generating KDP cover:", error);
      toast.dismiss(loadingToast);
      toast.error(error.response?.data?.error || "Cover generation failed.");
    } finally {
      setIsGeneratingCover(false);
    }
  };

  const copyToClipboard = async (value) => {
    try {
      await navigator.clipboard.writeText(markdownToPlainText(value));
      toast.success("Copied.");
    } catch {
      toast.error("Copy failed.");
    }
  };

  const downloadReport = async () => {
    const wasSaved = await persistKdp(metadata, settings);

    if (!wasSaved) {
      toast.error("Save risk notes before downloading the PDF.");
      return;
    }

    const loadingToast = toast.loading("Preparing risk notes PDF...");

    try {
      const { data } = await axiosInstance.get(
        `${API_ENDPOINTS.EXPORTS.PDF}/${bookId}/kdp-report.pdf`,
        { responseType: "blob" }
      );
      downloadBlob(
        data,
        `${safeFileName(book?.title)}_risk_notes.pdf`,
        "application/pdf"
      );
      toast.dismiss(loadingToast);
      toast.success("Risk notes PDF downloaded.");
    } catch (error) {
      console.error("Error exporting risk notes PDF:", error);
      toast.dismiss(loadingToast);
      toast.error("Failed to export risk notes PDF.");
    }
  };

  // ─── Loading ───────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <DashboardLayout>
        <main className="min-h-screen bg-gray-50">
          <div className="mx-auto max-w-7xl px-4 md:px-6 py-6 space-y-5 animate-pulse">
            <div className="h-36 rounded-2xl bg-gray-200" />
            <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5">
              <div className="space-y-4">
                <div className="h-48 rounded-2xl bg-gray-200" />
                <div className="h-64 rounded-2xl bg-gray-200" />
              </div>
              <div className="h-[36rem] rounded-2xl bg-gray-200" />
            </div>
          </div>
        </main>
      </DashboardLayout>
    );
  }

  if (!book) return null;

  // ─── Save status label ─────────────────────────────────────────────────────
  const saveChip = isSavingKdp ? (
    <span className="flex items-center gap-1.5 text-xs text-gray-500">
      <Loader2 className="size-3 animate-spin" />
      Saving…
    </span>
  ) : saveError ? (
    <span className="flex items-center gap-1.5 text-xs text-rose-600">
      <TriangleAlert className="size-3" />
      {saveError}
    </span>
  ) : (
    <span className="flex items-center gap-1.5 text-xs text-gray-500">
      <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
      {lastSavedAt
        ? `Saved ${lastSavedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
        : "Ready"}
    </span>
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <main className="min-h-screen bg-gray-50 text-gray-900">
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-6 space-y-5">

          {/* ── Header ──────────────────────────────────────────────────────── */}
          <header className="rounded-2xl border border-gray-200 bg-white px-6 py-5 shadow-sm">
            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
              {/* Left: back + title */}
              <div className="flex items-start gap-4 min-w-0">
                <Link
                  to={`/books/${bookId}/edit`}
                  aria-label="Back to editor"
                  className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-gray-100 text-gray-500 transition hover:bg-gray-200 hover:text-gray-700"
                >
                  <ArrowLeft className="size-4" />
                </Link>
                <div className="min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-violet-600">
                      <Sparkles className="size-3" />
                      KDP Studio
                    </span>
                    {saveChip}
                  </div>
                  <h1 className="mt-2 truncate text-2xl md:text-3xl font-bold tracking-tight text-gray-900">
                    {book.title}
                  </h1>
                  {book.author && (
                    <p className="mt-1 text-sm text-gray-500">by {book.author}</p>
                  )}
                </div>
              </div>

              {/* Right: action bar */}
              <div className="flex items-center gap-1 p-1 rounded-xl border border-gray-200 bg-gray-50 self-start xl:self-auto shrink-0 flex-wrap">
                <button
                  type="button"
                  onClick={handleManualKdpSave}
                  disabled={manualSaveState === "saving" || isSavingKdp}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-gray-700 hover:bg-white hover:text-gray-900 hover:shadow-sm disabled:opacity-50 transition"
                >
                  {manualSaveState === "saving" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : manualSaveState === "saved" ? (
                    <CheckCircle2 className="size-3.5 text-emerald-600" />
                  ) : (
                    <CheckCircle2 className="size-3.5" />
                  )}
                  <span className="hidden sm:inline">
                    {manualSaveState === "saving"
                      ? "Saving…"
                      : manualSaveState === "saved"
                        ? "Saved"
                        : manualSaveState === "error"
                          ? "Retry save"
                          : "Save"}
                  </span>
                </button>

                <div className="w-px h-5 bg-gray-200 mx-0.5" />

                <button
                  type="button"
                  onClick={() => exportFile("pdf")}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-gray-700 hover:bg-white hover:text-gray-900 hover:shadow-sm transition"
                >
                  <Download className="size-3.5" />
                  <span className="hidden sm:inline">PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => exportFile("epub")}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-gray-700 hover:bg-white hover:text-gray-900 hover:shadow-sm transition"
                >
                  <Download className="size-3.5" />
                  <span className="hidden sm:inline">EPUB</span>
                </button>

                <div className="w-px h-5 bg-gray-200 mx-0.5" />

                <button
                  type="button"
                  onClick={downloadReport}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-200 hover:bg-violet-100 transition"
                >
                  <PackageCheck className="size-3.5" />
                  <span className="hidden sm:inline">Risk PDF</span>
                </button>
              </div>
            </div>
          </header>

          {/* ── Body ────────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5 items-start">

            {/* ── Sidebar ─────────────────────────────────────────────────── */}
            <aside className="space-y-4">

              {/* Readiness ring */}
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-600 mb-4">
                  KDP Readiness
                </p>
                <div className="flex items-center gap-4">
                  <div className="shrink-0">
                    <svg width="84" height="84" viewBox="0 0 100 100" aria-hidden="true">
                      <circle
                        cx="50"
                        cy="50"
                        r={ringR}
                        fill="none"
                        stroke="#ede9fe"
                        strokeWidth="8"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r={ringR}
                        fill="none"
                        stroke="#7c3aed"
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={ringCircumference}
                        strokeDashoffset={ringOffset}
                        transform="rotate(-90 50 50)"
                        style={{ transition: "stroke-dashoffset 0.6s ease" }}
                      />
                      <text
                        x="50"
                        y="50"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#4c1d95"
                        fontSize="17"
                        fontWeight="700"
                        fontFamily="ui-monospace, monospace"
                      >
                        {readinessScore}%
                      </text>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {readinessScore === 100
                        ? "Upload ready"
                        : readinessScore >= 70
                          ? "Almost there"
                          : "Needs work"}
                    </p>
                    <p className="mt-1 text-xs text-gray-500 leading-5">
                      {preflightChecks.filter((c) => c.status === "pass").length} of{" "}
                      {preflightChecks.length} checks passing
                    </p>
                  </div>
                </div>
              </div>

              {/* Print settings */}
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-600">
                  Print Settings
                </p>

                <StudioSelect
                  label="Format"
                  value={settings.format}
                  onChange={(e) => updateSetting("format", e.target.value)}
                >
                  <option value="ebook">eBook</option>
                  <option value="paperback">Paperback</option>
                  <option value="hardcover">Hardcover</option>
                </StudioSelect>

                <StudioSelect
                  label="Trim size"
                  value={settings.trimSize}
                  onChange={(e) => updateSetting("trimSize", e.target.value)}
                >
                  {TRIM_SIZES.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </StudioSelect>

                <StudioSelect
                  label="Paper & ink"
                  value={settings.paperType}
                  onChange={(e) => updateSetting("paperType", e.target.value)}
                >
                  {PAPER_TYPES.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </StudioSelect>

                <StudioSelect
                  label="Body font size"
                  value={String(settings.fontSize || "12")}
                  onChange={(e) => updateSetting("fontSize", e.target.value)}
                >
                  {FONT_SIZE_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </StudioSelect>

                <StudioSelect
                  label="Interior bleed"
                  value={settings.interiorBleed || "none"}
                  onChange={(e) => updateSetting("interiorBleed", e.target.value)}
                >
                  <option value="none">No bleed</option>
                  <option value="bleed">Bleed interior PDF</option>
                </StudioSelect>

                <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={shouldRenderKdpDiagrams(settings)}
                    onChange={(e) =>
                      updateSetting(
                        "renderDiagrams",
                        e.target.checked ? "true" : "false"
                      )
                    }
                    className="mt-0.5 size-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                  />
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-gray-900">
                      Render diagrams
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-4 text-gray-500">
                      Convert explicit diagram fences into styled KDP diagrams.
                      Leave off when fenced text should stay as manuscript text.
                    </span>
                  </span>
                </label>

                <div>
                  <StudioLabel>Margins (inches)</StudioLabel>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      ["marginTop", "Top", bookMargins.top],
                      ["marginBottom", "Bottom", bookMargins.bottom],
                      ["marginInside", "Inside", bookMargins.inside],
                      ["marginOutside", "Outside", bookMargins.outside],
                    ].map(([key, label, value]) => (
                      <label key={key} className="block">
                        <span className="mb-1 block text-[10px] font-medium text-gray-500">
                          {label}
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.05"
                          value={settings[key] || ""}
                          onChange={(e) => updateSetting(key, e.target.value)}
                          placeholder={Number(value).toFixed(2)}
                          className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 placeholder-gray-400 transition shadow-sm"
                        />
                      </label>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[11px] leading-4 text-gray-500">
                    Blank values use KDP-safe defaults. Below-minimum values are
                    clamped during preview and export.
                  </p>
                </div>

                <div>
                  <StudioLabel>Body measurements</StudioLabel>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="mb-1 block text-[10px] font-medium text-gray-500">
                        Line spacing
                      </span>
                      <input
                        type="number"
                        min="1.15"
                        max="1.8"
                        step="0.05"
                        value={settings.lineSpacing || ""}
                        onChange={(e) => updateSetting("lineSpacing", e.target.value)}
                        placeholder="1.44"
                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 placeholder-gray-400 transition shadow-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[10px] font-medium text-gray-500">
                        First-line indent
                      </span>
                      <input
                        type="number"
                        min="0"
                        max="2.25"
                        step="0.05"
                        value={settings.paragraphIndent || ""}
                        onChange={(e) =>
                          updateSetting("paragraphIndent", e.target.value)
                        }
                        placeholder="1.35"
                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 placeholder-gray-400 transition shadow-sm"
                      />
                    </label>
                  </div>
                </div>

                <label className="block">
                  <StudioLabel>Final page count</StudioLabel>
                  <input
                    type="number"
                    value={settings.pageCountOverride}
                    onChange={(e) => updateSetting("pageCountOverride", e.target.value)}
                    placeholder={`${estimatedPageCount} (estimated)`}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 placeholder-gray-400 transition shadow-sm"
                  />
                  <p className="mt-1.5 text-[11px] leading-4 text-gray-500">
                    Preview uses {trim.label}, {fontSize} pt justified type,
                    {bookMargins.inside.toFixed(3)}" inside margins,{" "}
                    {bodyLineSpacing.toFixed(2)} line spacing, and about {wordsPerPage}{" "}
                    words per page. Lower overrides are ignored so the count
                    still matches the full preview.
                  </p>
                </label>
              </div>
            </aside>

            {/* ── Main panel ──────────────────────────────────────────────── */}
            <section className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">

              {/* Tab bar */}
              <nav
                className="flex gap-1 p-2 border-b border-gray-200 overflow-x-auto bg-gray-50/50"
                aria-label="KDP Studio sections"
              >
                {TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      aria-pressed={isActive}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                        isActive
                          ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-sm shadow-violet-500/25"
                          : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      <Icon className="size-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>

              {/* Tab content */}
              <div className="p-5 md:p-6">

                {/* ── Interior PDF ──────────────────────────────────────── */}
                {activeTab === "interior" && (
                  <div className="space-y-6">

                    {/* Metrics */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <Metric
                        label="Words"
                        value={wordCount.toLocaleString()}
                        note={`${chapters.length} chapters`}
                      />
                      <Metric
                        label="Pages"
                        value={pageCount}
                        note={
                          requestedPageCount > estimatedPageCount
                            ? "Manual override"
                            : "Matches preview"
                        }
                        highlight
                      />
                      <Metric
                        label="Spine"
                        value={`${spineWidth.toFixed(3)}"`}
                        note={paper.label}
                      />
                      <Metric
                        label="Wrap width"
                        value={`${coverWidth.toFixed(2)}"`}
                        note={`${coverHeight.toFixed(2)}" tall`}
                      />
                    </div>

                    {/* Download PDF */}
                    <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50 px-5 py-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          KDP Upload PDF
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          Print-ready manuscript at your selected trim size.
                        </p>
                      </div>
                      <GhostButton onClick={() => exportFile("pdf")} icon={Download}>
                        Download PDF
                      </GhostButton>
                    </div>

                    {/* TOC */}
                    <StudioTextarea
                      label="Table of contents"
                      value={metadata.tableOfContents}
                      rows={10}
                      onChange={(value) => updateMetadata("tableOfContents", value)}
                      action={
                        <>
                          <GhostButton onClick={exportTableOfContentsPdf} icon={Download}>
                            Download PDF
                          </GhostButton>
                          <AiButton
                            onClick={() => runPublishingTool("kdp_toc", "tableOfContents")}
                            loading={runningTool === "kdp_toc"}
                          >
                            Generate TOC
                          </AiButton>
                        </>
                      }
                    />

                    {/* TOC design picker */}
                    <div>
                      <StudioLabel>TOC PDF design</StudioLabel>
                      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-1">
                        {TOC_DESIGNS.map((design) => {
                          const isActive = settings.tocDesign === design.id;
                          return (
                            <button
                              key={design.id}
                              type="button"
                              onClick={() => updateSetting("tocDesign", design.id)}
                              className={`rounded-xl border p-3 text-left text-xs font-medium transition-all ${
                                isActive
                                  ? "border-violet-300 bg-violet-50 text-violet-700"
                                  : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-700"
                              }`}
                            >
                              {/* Mini visual swatch */}
                              <div className="mb-2 space-y-1">
                                <div
                                  className={`h-px rounded-full ${isActive ? "bg-violet-500" : "bg-gray-300"}`}
                                />
                                <div
                                  className={`h-px rounded-full w-2/3 ${isActive ? "bg-violet-300" : "bg-gray-200"}`}
                                />
                                <div
                                  className={`h-px rounded-full w-1/2 ${isActive ? "bg-violet-200" : "bg-gray-100"}`}
                                />
                              </div>
                              {design.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Cover Builder ─────────────────────────────────────── */}
                {activeTab === "cover" && (
                  <div className="space-y-6">

                    {/* Cover mock-up */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            Print wrap mock-up
                          </p>
                          <p className="mt-0.5 text-xs text-gray-500">
                            {coverWidth.toFixed(3)}" × {coverHeight.toFixed(3)}" at 300 DPI —{" "}
                            {Math.round(coverWidth * 300)} × {Math.round(coverHeight * 300)} px
                          </p>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-gray-200 bg-gray-900 p-4">
                        <div
                          className="grid w-full overflow-hidden rounded-xl max-h-[32rem]"
                          style={coverMockupStyle}
                        >
                          {/* Back cover */}
                          <div className="relative bg-gradient-to-br from-slate-900 to-[#0c0f18] p-5 border-r border-white/5">
                            <p className="text-[9px] uppercase tracking-[0.18em] text-slate-700 mb-4">
                              Back cover
                            </p>
                            <p className="text-xs text-slate-400 leading-5 line-clamp-8">
                              {metadata.backCoverBlurb ||
                                "Generate a back-cover blurb to preview this panel."}
                            </p>
                            <div className="absolute bottom-4 right-4 grid h-14 w-24 place-items-center rounded-lg border border-white/10 bg-white/5">
                              <p className="text-[9px] text-slate-600">Barcode</p>
                            </div>
                          </div>

                          {/* Spine */}
                          <div className="grid min-w-[2px] place-items-center bg-[#0c0f18] border-r border-white/5">
                            <span className="[writing-mode:vertical-rl] rotate-180 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">
                              {pageCount >= 80 ? book.title : "—"}
                            </span>
                          </div>

                          {/* Front cover */}
                          <div className="relative bg-slate-900 overflow-hidden">
                            {coverImageUrl ? (
                              <img
                                src={coverImageUrl}
                                alt={`${book.title} cover`}
                                className="absolute inset-0 h-full w-full object-contain"
                              />
                            ) : (
                              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-700">
                                <ImageIcon className="size-6" />
                                <p className="text-[10px]">No cover</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Cover generation controls */}
                    <div className="grid grid-cols-1 xl:grid-cols-[1fr_200px] gap-4">
                      <StudioTextarea
                        label="Cover image prompt"
                        value={metadata.coverPrompt}
                        rows={7}
                        onChange={(value) => updateMetadata("coverPrompt", value)}
                        action={
                          <AiButton
                            onClick={() =>
                              runPublishingTool("kdp_cover_prompt", "coverPrompt")
                            }
                            loading={runningTool === "kdp_cover_prompt"}
                          >
                            Generate prompt
                          </AiButton>
                        }
                      />

                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3 self-start">
                        <StudioSelect
                          label="Image size"
                          value={settings.coverImageSize}
                          onChange={(e) => updateSetting("coverImageSize", e.target.value)}
                        >
                          <option value="1K">1K</option>
                          <option value="2K">2K</option>
                          <option value="4K">4K</option>
                        </StudioSelect>

                        <button
                          type="button"
                          onClick={generateCover}
                          disabled={isGeneratingCover}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-violet-500/25 transition hover:from-violet-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isGeneratingCover ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <WandSparkles className="size-4" />
                          )}
                          {isGeneratingCover ? "Generating…" : "Generate Cover"}
                        </button>

                        <GhostButton
                          onClick={() => copyToClipboard(metadata.coverPrompt)}
                          icon={Copy}
                        >
                          Copy prompt
                        </GhostButton>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Listing Copy ──────────────────────────────────────── */}
                {activeTab === "metadata" && (
                  <div className="flex gap-5" style={{ minHeight: "520px" }}>

                    {/* Field navigator */}
                    <nav
                      className="w-48 shrink-0 space-y-0.5"
                      aria-label="Listing copy fields"
                    >
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-violet-500 px-3 pb-2">
                        Fields
                      </p>
                      {META_FIELDS.map((field) => {
                        const value = metadata[field.id];
                        const wc = countWords(value);
                        const isFilled = String(value || "").trim().length > 0;
                        const isActive = activeMetaField === field.id;

                        return (
                          <button
                            key={field.id}
                            type="button"
                            onClick={() => handleMetaFieldChange(field.id)}
                            className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm text-left transition-all ${
                              isActive
                                ? "bg-violet-50 text-violet-700 border border-violet-200"
                                : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                            }`}
                          >
                            <span className="truncate font-medium text-xs">
                              {field.label}
                            </span>
                            <span className="flex items-center gap-1.5 shrink-0">
                              {wc > 0 && (
                                <span className="text-[9px] text-slate-600 font-mono">
                                  {wc}w
                                </span>
                              )}
                              <span
                                className={`size-1.5 rounded-full shrink-0 ${
                                  isFilled ? "bg-emerald-500" : "bg-slate-700"
                                }`}
                              />
                            </span>
                          </button>
                        );
                      })}
                    </nav>

                    {/* Vertical divider */}
                    <div className="w-px bg-gray-200 shrink-0" />

                    {/* Active field editor */}
                    <div className="flex-1 min-w-0">
                      {META_FIELDS.filter((f) => f.id === activeMetaField).map((field) => (
                        <div key={field.id} className="space-y-3">
                          {/* Field title */}
                          <div>
                            <h3 className="text-base font-semibold text-gray-900">
                              {field.label}
                            </h3>
                            <p className="mt-0.5 text-xs text-gray-500">{field.hint}</p>
                          </div>

                          {/* Unified card */}
                          <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                            {/* Toolbar */}
                            <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-gray-100 bg-gray-50">
                              {/* Left: Edit/Preview toggle + word count */}
                              <div className="flex items-center gap-2.5">
                                <div className="flex p-0.5 rounded-lg bg-gray-200 gap-px">
                                  <button
                                    type="button"
                                    onClick={() => setIsMetaPreview(false)}
                                    aria-pressed={!isMetaPreview}
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                                      !isMetaPreview
                                        ? "bg-white text-gray-900 shadow-sm"
                                        : "text-gray-500 hover:text-gray-700"
                                    }`}
                                  >
                                    <Pencil className="size-3" />
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setIsMetaPreview(true)}
                                    aria-pressed={isMetaPreview}
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                                      isMetaPreview
                                        ? "bg-white text-gray-900 shadow-sm"
                                        : "text-gray-500 hover:text-gray-700"
                                    }`}
                                  >
                                    <Eye className="size-3" />
                                    Preview
                                  </button>
                                </div>
                                <span className="text-xs text-gray-400 font-mono tabular-nums">
                                  {countWords(metadata[field.id])}w
                                </span>
                              </div>

                              {/* Right: Copy + AI */}
                              <div className="flex items-center gap-2 shrink-0">
                                <GhostButton
                                  onClick={() => copyToClipboard(metadata[field.id])}
                                  icon={Copy}
                                >
                                  Copy
                                </GhostButton>
                                <AiButton
                                  onClick={() => runPublishingTool(field.action, field.id)}
                                  loading={runningTool === field.action}
                                >
                                  {field.buttonLabel}
                                </AiButton>
                              </div>
                            </div>

                            {/* Content */}
                            {isMetaPreview ? (
                              <div
                                className="px-5 py-4 overflow-auto bg-white"
                                style={{ minHeight: `${Math.max(field.rows * 52, 400)}px`, maxHeight: "44rem" }}
                              >
                                {String(metadata[field.id] || "").trim() ? (
                                  <MDEditor.Markdown
                                    source={metadata[field.id] || ""}
                                    rehypePlugins={[[rehypeSanitize]]}
                                    components={markdownComponents}
                                    wrapperElement={{ "data-color-mode": "light" }}
                                    style={{
                                      backgroundColor: "transparent",
                                      color: "#374151",
                                      fontFamily: PREVIEW_SERIF_FONT_FAMILY,
                                      fontSize: 14,
                                      lineHeight: 1.8,
                                    }}
                                  />
                                ) : (
                                  <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400 py-10">
                                    <Eye className="size-7 opacity-25" />
                                    <p className="text-sm text-center max-w-xs">
                                      Nothing to preview yet — switch to{" "}
                                      <button
                                        type="button"
                                        onClick={() => setIsMetaPreview(false)}
                                        className="text-violet-600 hover:underline font-medium"
                                      >
                                        Edit
                                      </button>{" "}
                                      or use AI to generate.
                                    </p>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <textarea
                                rows={field.rows}
                                value={metadata[field.id]}
                                onChange={(e) => updateMetadata(field.id, e.target.value)}
                                placeholder={`Write your ${field.label.toLowerCase()} here, or use AI to generate…`}
                                className="w-full border-0 px-5 py-4 text-sm text-gray-900 leading-6 resize-y outline-none placeholder-gray-400 bg-white"
                                style={{ minHeight: `${Math.max(field.rows * 52, 400)}px` }}
                              />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Preflight ─────────────────────────────────────────── */}
                {activeTab === "preview" && (
                  <div className="space-y-5">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          Full book preview
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {trim.label}, {paper.label.toLowerCase()}, {fontSize} pt justified body type, {hasInteriorBleed ? "bleed" : "no bleed"}. Interior pages: {pageCount}.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <GhostButton onClick={() => exportFile("pdf")} icon={Download}>
                          Save PDF
                        </GhostButton>
                        <GhostButton onClick={() => exportFile("epub")} icon={Download}>
                          Save EPUB
                        </GhostButton>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <Metric
                        label="Interior pages"
                        value={pageCount}
                        note={`${pageCount + 2} pages with covers`}
                        highlight
                      />
                      <Metric
                        label="Margins"
                        value={`${bookMargins.inside.toFixed(3)}" / ${bookMargins.outside.toFixed(3)}"`}
                        note={`Inside / outside, min outside ${bookMargins.outsideMinimum.toFixed(3)}"`}
                      />
                      <Metric
                        label="Font"
                        value={`${fontSize} pt`}
                        note={`${bodyLineSpacing.toFixed(2)} leading, about ${wordsPerPage} words/page`}
                      />
                      <Metric
                        label="Paper"
                        value={paper.id === "bw-cream" ? "Cream" : paper.id === "color" ? "Color" : "White"}
                        note={paper.label}
                      />
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-gray-100 p-5">
                      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4">
                        <div className="flex w-full items-center justify-between gap-3 text-xs text-gray-500">
                          <span className="truncate font-medium text-gray-700">
                            {currentPreviewPage?.label}
                          </span>
                          <span className="font-mono">
                            {previewPageIndex + 1}/{previewPages.length}
                          </span>
                        </div>

                        {currentPreviewPage?.kind === "cover-wrap" ? (
                          <div className="w-full rounded-2xl border border-gray-200 bg-gray-900 p-4 shadow-inner">
                            <div
                              className="grid w-full overflow-hidden rounded-xl max-h-[32rem]"
                              style={coverMockupStyle}
                            >
                              <div className="relative bg-gradient-to-br from-slate-900 to-[#0c0f18] p-5 border-r border-white/5">
                                <p className="text-[9px] uppercase tracking-[0.18em] text-slate-700 mb-4">
                                  Back cover
                                </p>
                                <p className="text-xs text-slate-400 leading-5 line-clamp-8">
                                  {metadata.backCoverBlurb ||
                                    "Generate a back-cover blurb to preview this panel."}
                                </p>
                                <div className="absolute bottom-4 right-4 grid h-14 w-24 place-items-center rounded-lg border border-white/10 bg-white/5">
                                  <p className="text-[9px] text-slate-600">
                                    Barcode
                                  </p>
                                </div>
                              </div>

                              <div className="grid min-w-[2px] place-items-center bg-[#0c0f18] border-r border-white/5">
                                <span className="[writing-mode:vertical-rl] rotate-180 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">
                                  {pageCount >= 80 ? book.title : "—"}
                                </span>
                              </div>

                              <div className="relative bg-slate-900 overflow-hidden">
                                {coverImageUrl ? (
                                  <img
                                    src={coverImageUrl}
                                    alt={`${book.title} cover`}
                                    className="absolute inset-0 h-full w-full object-contain"
                                  />
                                ) : (
                                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-700">
                                    <ImageIcon className="size-6" />
                                    <p className="text-[10px]">No cover</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="relative w-full rounded-sm bg-gray-300 p-3 shadow-inner">
                            <div className="absolute inset-y-3 left-1/2 hidden w-px bg-black/10 md:block" />
                            <div className="grid w-full grid-cols-2 gap-3">
                              {spreadPages.map((previewPage) => {
                                const isSpreadPlaceholder =
                                  previewPage.kind === "spread-blank";
                                const isBackCover =
                                  previewPage.kind === "back-cover";
                                const pagePadding = getPreviewPagePadding(
                                  previewPage,
                                  bookMargins,
                                  pageCanvas,
                                  hasInteriorBleed
                                );
                                const previewPageStyle = {
                                  ...pagePreviewStyle,
                                  ...(isSpreadPlaceholder
                                    ? {
                                        backgroundColor: "transparent",
                                        borderColor: "transparent",
                                        boxShadow: "none",
                                      }
                                    : {}),
                                  ...(isBackCover
                                    ? {
                                        backgroundColor: "#0f172a",
                                        color: "#cbd5e1",
                                      }
                                    : {}),
                                };

                                return (
                                  <article
                                    key={previewPage.id}
                                    className={`relative w-full min-w-0 justify-self-center overflow-hidden border transition duration-300 ease-out ${
                                      isSpreadPlaceholder
                                        ? "border-transparent shadow-none"
                                        : "border-gray-300 shadow-2xl"
                                    }`}
                                    style={previewPageStyle}
                                  >
                                  {isSpreadPlaceholder ? null : previewPage.kind === "cover" ? (
                                    coverImageUrl ? (
                                      <img
                                        src={coverImageUrl}
                                        alt={`${book.title} cover`}
                                        className="absolute inset-0 h-full w-full object-contain"
                                      />
                                    ) : (
                                      <div className="absolute inset-0 grid place-items-center bg-slate-900 text-slate-500">
                                        <ImageIcon className="size-8" />
                                      </div>
                                    )
                                  ) : previewPage.kind === "back-cover" ? (
                                    <div
                                      className="flex h-full flex-col justify-between bg-slate-900 p-[9%] font-serif text-slate-300"
                                      style={{
                                        fontFamily: PREVIEW_SERIF_FONT_FAMILY,
                                        fontSize: previewTextFontSize,
                                      }}
                                    >
                                      <div>
                                        <p className="text-[0.62em] font-bold uppercase tracking-[0.16em] opacity-50">
                                          Back Cover
                                        </p>
                                        <div className="mt-6 space-y-[0.35em] text-[0.82em] leading-[1.55] text-justify">
                                          {(previewPage.paragraphs?.length
                                            ? previewPage.paragraphs
                                            : [
                                                "Back-cover copy will appear here after it is written.",
                                              ]
                                          ).map((paragraph, paragraphIndex) => (
                                            <p
                                              key={`${previewPage.id}-${paragraphIndex}`}
                                              className="m-0"
                                            >
                                              {paragraph}
                                            </p>
                                          ))}
                                        </div>
                                      </div>
                                      <div className="ml-auto grid h-14 w-24 place-items-center border border-current/25 text-[0.62em] opacity-50">
                                        Barcode
                                      </div>
                                    </div>
                                  ) : previewPage.kind === "title" ? (
                                    <div
                                      className="flex h-full flex-col items-center justify-center font-serif text-center"
                                      style={{
                                        ...pagePadding,
                                        fontFamily: PREVIEW_SERIF_FONT_FAMILY,
                                        fontSize: previewTextFontSize,
                                      }}
                                    >
                                      <h2 className="text-[1.45em] font-bold leading-tight">
                                        {previewPage.title}
                                      </h2>
                                      {previewPage.subtitle && (
                                        <p className="mt-4 text-[0.9em] leading-snug opacity-70">
                                          {previewPage.subtitle}
                                        </p>
                                      )}
                                      {previewPage.author && (
                                        <p className="mt-10 text-[0.78em] uppercase tracking-[0.14em] opacity-65">
                                          by {previewPage.author}
                                        </p>
                                      )}
                                    </div>
                                  ) : previewPage.kind === "toc" ? (
                                    <div
                                      className="relative h-full font-serif"
                                      style={{
                                        ...pagePadding,
                                        fontFamily: PREVIEW_SERIF_FONT_FAMILY,
                                        fontSize: previewTextFontSize,
                                      }}
                                    >
                                      <h3 className="mb-[1.25em] text-center text-[1.25em] font-bold leading-tight">
                                        Contents
                                      </h3>
                                      <div className="space-y-[0.46em] text-[0.86em] leading-tight">
                                        {previewPage.entries.map((entry) => (
                                          <div
                                            key={`${entry.chapterLabel}-${entry.pageNumber}`}
                                            className="grid grid-cols-[auto_1fr_auto] items-end gap-2"
                                          >
                                            <span className="whitespace-nowrap text-[0.78em] uppercase tracking-[0.08em] opacity-55">
                                              {entry.chapterLabel}
                                            </span>
                                            <span className="overflow-hidden whitespace-nowrap font-medium">
                                              {entry.title}
                                            </span>
                                            <span className="font-mono text-[0.9em]">
                                              {entry.pageNumber}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                      <span className="absolute bottom-[3.5%] left-1/2 -translate-x-1/2 font-mono text-[0.95em] font-medium opacity-80">
                                        {previewPage.interiorPageNumber}
                                      </span>
                                    </div>
                                  ) : previewPage.kind === "chapter-image" ? (
                                    <div
                                      className="relative flex h-full flex-col font-serif"
                                      style={{
                                        ...pagePadding,
                                        fontFamily: PREVIEW_SERIF_FONT_FAMILY,
                                        fontSize: previewTextFontSize,
                                      }}
                                    >
                                      {previewPage.chapterLabel && previewPage.title && (
                                        <div className="mb-[1em] text-center">
                                          <p className="mb-[0.45em] text-[0.78em] font-semibold uppercase tracking-[0.16em] opacity-55">
                                            {previewPage.chapterLabel}
                                          </p>
                                          <h3 className="text-[1.18em] font-bold leading-tight">
                                            {previewPage.title}
                                          </h3>
                                        </div>
                                      )}
                                      <div className="flex min-h-0 flex-1 items-center justify-center pb-[1.5em]">
                                        <img
                                          src={resolveImageUrl(previewPage.image?.url)}
                                          alt={
                                            previewPage.image?.alt ||
                                            `${previewPage.title || "Chapter"} illustration`
                                          }
                                          className="max-h-full max-w-full object-contain"
                                        />
                                      </div>
                                      {previewPage.interiorPageNumber && (
                                        <span className="absolute bottom-[3.5%] left-1/2 -translate-x-1/2 font-mono text-[0.95em] font-medium opacity-80">
                                          {previewPage.interiorPageNumber}
                                        </span>
                                      )}
                                    </div>
                                  ) : previewPage.kind === "blank" ? (
                                    <div className="h-full" style={pagePadding} />
                                  ) : (
                                    (() => {
                                      const isDiagramOnlyRenderPage =
                                        previewPage.blocks?.length === 1 &&
                                        previewPage.blocks[0]?.type === "diagram";

                                      return (
                                    <div
                                      className="relative flex h-full min-h-0 flex-col font-serif"
                                      style={{
                                        ...pagePadding,
                                        fontFamily: PREVIEW_SERIF_FONT_FAMILY,
                                        fontSize: previewTextFontSize,
                                      }}
                                    >
                                      {previewPage.chapterLabel && previewPage.title && (
                                        <div className="mb-[1.25em] shrink-0 text-center">
                                          <p className="mb-[0.55em] text-[0.78em] font-semibold uppercase tracking-[0.16em] opacity-55">
                                            {previewPage.chapterLabel}
                                          </p>
                                          <h3 className="text-[1.25em] font-bold leading-tight">
                                            {previewPage.title}
                                          </h3>
                                        </div>
                                      )}
                                      <div
                                        className={`min-h-0 flex-1 overflow-hidden text-[1em]${
                                          isDiagramOnlyRenderPage
                                            ? " flex flex-col justify-center"
                                            : ""
                                        }`}
                                        style={{ lineHeight: bodyLineSpacing }}
                                      >
                                        {(previewPage.blocks?.length
                                          ? previewPage.blocks
                                          : (previewPage.paragraphs?.length
                                              ? previewPage.paragraphs.map(
                                                  (paragraph) => ({
                                                    type: "paragraph",
                                                    text:
                                                      typeof paragraph ===
                                                      "object"
                                                        ? paragraph.text
                                                        : paragraph,
                                                    continuation:
                                                      typeof paragraph ===
                                                        "object" &&
                                                      paragraph.continuation,
                                                  })
                                                )
                                              : [{ type: "paragraph", text: " " }]
                                            )
                                        ).map((block, blockIndex) => (
                                          <KdpPreviewBlock
                                            key={`${previewPage.id}-${blockIndex}`}
                                            block={block}
                                            paragraphIndent={paragraphIndent}
                                            showParagraphIndent={
                                              previewPage.kind === "chapter"
                                            }
                                            diagramCompact={
                                              (previewPage.blocks?.length || 0) >
                                                1 &&
                                              !(previewPage.blocks || []).some(
                                                (pageBlock) =>
                                                  (pageBlock.type === "diagram" ||
                                                    pageBlock.type === "code") &&
                                                  !shouldCompactKdpDiagramBlock(
                                                    pageBlock
                                                  )
                                              )
                                            }
                                            diagramFullPage={
                                              isDiagramOnlyRenderPage
                                            }
                                            baseFontSize={fontSize}
                                          />
                                        ))}
                                      </div>
                                      {previewPage.interiorPageNumber && (
                                        <span className="absolute bottom-[3.5%] left-1/2 -translate-x-1/2 font-mono text-[0.95em] font-medium opacity-80">
                                          {previewPage.interiorPageNumber}
                                        </span>
                                      )}
                                    </div>
                                      );
                                    })()
                                  )}
                                  </article>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <div className="flex w-full items-center justify-center gap-2">
                          <GhostButton
                            onClick={() => goToPreviewPage(0)}
                            disabled={spreadStartIndex === 0}
                          >
                            First spread
                          </GhostButton>
                          <GhostButton
                            onClick={() => goToPreviewPage(spreadStartIndex - 2)}
                            disabled={spreadStartIndex === 0}
                          >
                            Previous spread
                          </GhostButton>
                          <GhostButton
                            onClick={() => goToPreviewPage(spreadStartIndex + 2)}
                            disabled={spreadStartIndex >= lastPreviewSpreadIndex}
                          >
                            Next spread
                          </GhostButton>
                          <GhostButton
                            onClick={() => goToPreviewPage(lastPreviewSpreadIndex)}
                            disabled={spreadStartIndex >= lastPreviewSpreadIndex}
                          >
                            Last spread
                          </GhostButton>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "preflight" && (
                  <div className="space-y-6">

                    {/* Score + AI risk scan */}
                    <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-5 items-start">
                      {/* Score card */}
                      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 flex flex-col items-center text-center w-full md:w-52 shrink-0">
                        <svg width="110" height="110" viewBox="0 0 100 100" aria-hidden="true">
                          <circle
                            cx="50"
                            cy="50"
                            r={ringR}
                            fill="none"
                            stroke="#ede9fe"
                            strokeWidth="7"
                          />
                          <circle
                            cx="50"
                            cy="50"
                            r={ringR}
                            fill="none"
                            stroke={
                              readinessScore === 100
                                ? "#10b981"
                                : readinessScore >= 70
                                  ? "#7c3aed"
                                  : "#f43f5e"
                            }
                            strokeWidth="7"
                            strokeLinecap="round"
                            strokeDasharray={ringCircumference}
                            strokeDashoffset={ringOffset}
                            transform="rotate(-90 50 50)"
                            style={{ transition: "stroke-dashoffset 0.6s ease" }}
                          />
                          <text
                            x="50"
                            y="46"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill="#4c1d95"
                            fontSize="19"
                            fontWeight="700"
                            fontFamily="ui-monospace, monospace"
                          >
                            {readinessScore}%
                          </text>
                          <text
                            x="50"
                            y="62"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill="#9ca3af"
                            fontSize="9"
                            fontFamily="ui-sans-serif, sans-serif"
                          >
                            READY
                          </text>
                        </svg>
                        <p className="mt-3 text-sm font-semibold text-gray-900">
                          {readinessScore === 100
                            ? "Upload ready"
                            : readinessScore >= 70
                              ? "Almost there"
                              : "Needs work"}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {preflightChecks.filter((c) => c.status === "pass").length}/
                          {preflightChecks.length} checks passing
                        </p>
                      </div>

                      {/* AI risk scan */}
                      <StudioTextarea
                        label="AI risk notes"
                        hint="KDP content policy review — missing pages, risky content, copyright flags."
                        value={metadata.riskNotes}
                        rows={7}
                        onChange={(value) => updateMetadata("riskNotes", value)}
                        action={
                          <AiButton
                            onClick={() =>
                              runPublishingTool("kdp_risk_check", "riskNotes")
                            }
                            loading={runningTool === "kdp_risk_check"}
                            icon={Sparkles}
                          >
                            Run AI scan
                          </AiButton>
                        }
                      />
                    </div>

                    {/* Checks grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {preflightChecks.map((check) => (
                        <CheckRow key={check.title} check={check} />
                      ))}
                    </div>

                    {/* Download risk notes */}
                    <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50 px-5 py-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Risk notes PDF</p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          Downloads only the AI risk scan results for this book.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={downloadReport}
                        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-violet-500/20 hover:from-violet-700 hover:to-purple-700 transition shrink-0"
                      >
                        <PackageCheck className="size-4" />
                        Download Risk Notes
                      </button>
                    </div>
                  </div>
                )}

              </div>
            </section>
          </div>
        </div>
      </main>
    </DashboardLayout>
  );
}

export default KDPStudioPage;
