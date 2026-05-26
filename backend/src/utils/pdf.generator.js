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

const md = new MarkdownIt();

const PDF_CONFIG = {
  fonts: {
    heading: "Helvetica-Bold",
    body: "Helvetica",
    bodyBold: "Helvetica-Bold",
    bodyItalic: "Helvetica-Oblique",
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
    paragraphGap: 12,
    chapterGap: 40,
    headingGap: 20,
    listItemGap: 8,
    lineHeight: 1.5,
  },
  list: {
    bulletIndent: 20, // Distance from left margin to bullet
    textIndent: 35, // Distance from left margin to text (bullet + spacing)
  },
};

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
]);

function normalizeCodeTextForPdf(text = "") {
  return String(text || "")
    .replace(/\t/g, "  ")
    .replace(/\u00A0/g, " ")
    .replace(/[\u2500-\u257F\u25B2-\u25C4\u2190-\u21FF\u2018-\u2026]/g, (char) =>
      pdfCodeCharacterReplacements.get(char) || "?"
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

  return {
    header: paddedRows[0],
    rows: paddedRows.slice(1),
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
  const normalizedLanguage = String(language || "").trim().toLowerCase();

  if (
    normalizedLanguage &&
    !["text", "txt", "diagram", "flow", "plain"].includes(normalizedLanguage)
  ) {
    return true;
  }

  const nonEmptyLines = lines.filter((line) => line.trim());

  if (nonEmptyLines.length === 0) return false;

  const codeMarkers = nonEmptyLines.filter((line) =>
    /^\s*(import|export|const|let|var|function|class|interface|type|return|if|for|while|switch|case|async|await|def|from|\/\/|#include|<\w|[{}])\b/.test(
      line
    ) || /[{};]\s*$/.test(line)
  ).length;

  return codeMarkers >= 3 && codeMarkers / nonEmptyLines.length >= 0.22;
}

function textHeight(doc, text, options = {}) {
  return doc.heightOfString(text || " ", options);
}

function renderFlowDiagram(doc, diagram) {
  if (!diagram?.nodes?.length) return false;

  const cardX = PDF_CONFIG.margins.left;
  const cardW = getContentWidth(doc);
  const padding = 18;
  const gap = 12;
  const nodeCount = diagram.nodes.length;
  const nodeW = (cardW - padding * 2 - gap * (nodeCount - 1)) / nodeCount;
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

  const tableDiagram = parseAsciiTableDiagram(originalLines);

  if (tableDiagram) {
    return renderTableDiagram(doc, tableDiagram);
  }

  const flowDiagram = parseFlowDiagram(originalLines);

  if (flowDiagram) {
    return renderFlowDiagram(doc, flowDiagram);
  }

  const stackDiagram = parseStackDiagram(originalLines);

  if (stackDiagram) {
    return renderStackDiagram(doc, stackDiagram);
  }

  const branchDiagram = parseBranchDiagram(originalLines);

  if (branchDiagram) {
    return renderFlowDiagram(doc, branchDiagram);
  }

  const comparisonDiagram = parseComparisonDiagram(originalLines);

  if (comparisonDiagram) {
    return renderFlowDiagram(doc, comparisonDiagram);
  }

  const linearDiagram = parseLinearFlowDiagram(originalLines);

  if (linearDiagram) {
    return linearDiagram.nodes.length > 4
      ? renderVerticalFlowDiagram(doc, linearDiagram)
      : renderFlowDiagram(doc, linearDiagram);
  }

  return isLooseDiagramBlock(originalLines)
    ? renderPreformattedDiagram(doc, originalLines)
    : false;
}

function renderPreformattedDiagram(doc, originalLines = []) {
  const lines = originalLines.map(normalizeCodeTextForPdf);
  const padding = 12;
  const availableWidth = getContentWidth(doc);
  const innerWidth = availableWidth - padding * 2;
  const maxLineLength = Math.max(...lines.map((line) => line.length), 1);
  const fontSize = Math.max(
    5.5,
    Math.min(8.2, innerWidth / (maxLineLength * 0.58))
  );
  const lineHeight = fontSize * 1.35;
  const blockHeight = lines.length * lineHeight + padding * 2;
  const x = PDF_CONFIG.margins.left;

  ensureSpace(doc, blockHeight + 18);
  doc.moveDown(0.35);

  const top = doc.y;

  doc
    .roundedRect(x, top, availableWidth, blockHeight, 12)
    .fillAndStroke("#f8fafc", "#cbd5e1");

  lines.forEach((line, index) => {
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

  ensureSpace(doc, options.minHeight ?? size * 4);

  doc
    .font(font)
    .fontSize(size)
    .fillColor(color)
    .text(cleanText, x, doc.y, {
      width,
      align: options.align || "left",
      lineGap: options.lineGap ?? 4,
    });

  doc.moveDown(options.after ?? 0.75);
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
  const renderLines = isDiagram
    ? lines
    : lines.flatMap((line) => wrapCodeLine(line, maxChars));
  const widestLineWidth = Math.max(
    ...renderLines.map((line) => doc.widthOfString(line || " "))
  );
  const horizontalScale =
    isDiagram && widestLineWidth > innerWidth
      ? innerWidth / widestLineWidth
      : 1;

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
      doc.save();
      doc.rect(x + padding, lineY - 1, innerWidth, lineHeight + 2).clip();
      doc.translate(x + padding, lineY);
      doc.scale(horizontalScale, 1);
      doc
        .font(PDF_CONFIG.fonts.code)
        .fontSize(codeFontSize)
        .fillColor(PDF_CONFIG.colors.codeBlock)
        .text(line || " ", 0, 0, {
          lineBreak: false,
        });
      doc.restore();

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

          doc.moveDown(0.5);

          images.forEach((image) => {
            renderImageBlock(doc, image.src, image.alt);
          });

          if (textContent) {
            renderTextBlock(doc, textContent);
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

// MAIN PDF GENERATION FUNCTION
async function generatePdf(book, res) {
  await prepareExportImages(book);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: PDF_CONFIG.margins,
      });

      doc.pipe(res);

      doc.on("error", (err) => {
        console.error("PDF generation error:", err);
        reject(err);
      });

      // PAGE 1: COVER PAGE
      if (book.coverImage && !book.coverImage.includes("pravatar")) {
        const imagePath = resolveExportImagePath(book.coverImage);

        try {
          if (imagePath) {
            doc.image(imagePath, {
              fit: [400, 550],
              align: "center",
              valign: "center",
            });

            doc.addPage();
          } else {
            console.warn(`PDF cover image not found: ${book.coverImage}`);
          }
        } catch (imgErr) {
          console.error(`Could not embed cover image: ${book.coverImage}`, imgErr);
        }
      }

      // PAGE 2: TITLE PAGE
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

      // PROCESS CHAPTERS (starts on page 3+)
      (book?.chapters || []).forEach((chapter, index) => {
        try {
          doc.addPage();

          doc
            .font(PDF_CONFIG.fonts.heading)
            .fontSize(PDF_CONFIG.sizes.chapterTitle)
            .fillColor(PDF_CONFIG.colors.chapterTitle)
            .text(chapter.title, {
              align: "left",
            });

          doc.moveDown(2);

          processMdContentForPdf(doc, getChapterMarkdownForExport(chapter));
        } catch (chapterErr) {
          console.error(
            `Error processing chapter ${index + 1} for PDF:`,
            chapterErr
          );
        }
      });

      doc.end();

      doc.on("end", () => {
        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  generatePdf,
  __private: {
    isDiagramCodeBlock,
    normalizeCodeTextForPdf,
    parseAsciiTableDiagram,
    parseBranchDiagram,
    parseComparisonDiagram,
    parseFlowDiagram,
    parseLinearFlowDiagram,
    parseStackDiagram,
  },
};
