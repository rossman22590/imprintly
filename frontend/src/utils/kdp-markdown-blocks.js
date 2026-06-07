const CODE_LANGUAGES = new Set([
  "bash",
  "c",
  "cpp",
  "csharp",
  "css",
  "go",
  "html",
  "java",
  "javascript",
  "js",
  "json",
  "kotlin",
  "php",
  "python",
  "py",
  "ruby",
  "rust",
  "shell",
  "sql",
  "swift",
  "ts",
  "typescript",
  "xml",
  "yaml",
  "yml",
]);

function stripKdpInlineMarkdown(text = "") {
  return String(text || "")
    .replace(/!\[[^\]]*]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function normalizeKdpParagraphText(paragraph = "") {
  return String(paragraph || "")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/[ \t\n]+/g, " ")
    .trim();
}

function parseKdpTextSegment(text = "") {
  const stripped = stripKdpInlineMarkdown(text).replace(/\r\n/g, "\n");

  if (!stripped.trim()) return [];

  return stripped
    .split(/\n{2,}/)
    .map(normalizeKdpParagraphText)
    .filter(Boolean)
    .map((paragraphText) => ({
      type: "paragraph",
      text: paragraphText,
    }));
}

export function parseKdpMarkdownBlocks(markdown = "") {
  const source = String(markdown || "").replace(/\r\n/g, "\n");
  const blocks = [];
  const fenceRegex = /```([^\n`]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = fenceRegex.exec(source)) !== null) {
    const before = source.slice(lastIndex, match.index);
    blocks.push(...parseKdpTextSegment(before));

    const language = String(match[1] || "").trim();
    const content = String(match[2] || "").replace(/\n$/, "");

    if (content.trim()) {
      blocks.push({
        type: "fence",
        language,
        content,
      });
    }

    lastIndex = match.index + match[0].length;
  }

  blocks.push(...parseKdpTextSegment(source.slice(lastIndex)));

  return mergeLabelParagraphsIntoDiagrams(blocks);
}

function isDiagramLabelParagraph(text = "") {
  const normalized = String(text || "").trim();

  if (!normalized || normalized.length > 72) return false;

  const wordCount = normalized.split(/\s+/).filter(Boolean).length;

  if (wordCount > 10) return false;
  if (/[.!?]["']?$/.test(normalized)) return false;

  return true;
}

function mergeLabelParagraphsIntoDiagrams(blocks = []) {
  const merged = [];

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    const nextBlock = blocks[index + 1];

    if (
      block.type === "paragraph" &&
      nextBlock?.type === "fence" &&
      isDiagramLabelParagraph(block.text)
    ) {
      merged.push({
        type: "fence",
        language: nextBlock.language,
        content: nextBlock.content,
        label: block.text,
      });
      index += 1;
      continue;
    }

    merged.push(block);
  }

  return merged;
}

function estimateDiagramBlockLines(content = "", language = "") {
  const normalizedLanguage = String(language || "").trim().toLowerCase();
  const lines = String(content || "")
    .replace(/\n$/, "")
    .split("\n")
    .map((line) => line.trimEnd());
  const nonEmptyLines = lines.filter((line) => line.trim());

  if (!nonEmptyLines.length) return 0;

  if (
    normalizedLanguage &&
    CODE_LANGUAGES.has(normalizedLanguage) &&
    !["text", "txt", "plain", "diagram", "flow", "reader-diagram"].includes(
      normalizedLanguage
    )
  ) {
    return Math.max(4, Math.min(nonEmptyLines.length, 14) * 0.75 + 2);
  }

  if (nonEmptyLines.some((line) => line.includes("|"))) {
    const tableRows = nonEmptyLines.filter((line) => line.includes("|")).length;
    return Math.max(7, tableRows * 1.45 + 3);
  }

  const connectorPattern = /^[\s│├└┌┐┘┴┬─═→↓←↑+\-|_.*]+$/;
  const nodeLines = nonEmptyLines.filter((line) => {
    const trimmed = line.trim();
    return trimmed && !connectorPattern.test(trimmed);
  });

  if (nodeLines.length >= 2) {
    return Math.max(6, nodeLines.length * 1.85 + 3);
  }

  return Math.max(5, Math.min(nonEmptyLines.length, 20) * 0.7 + 3);
}

function getWordCountForLineBudget(
  words,
  maxLines,
  textMetrics,
  { continuation = false, estimateTextLines }
) {
  if (maxLines <= 0 || !words.length) return 0;

  let low = 1;
  let high = words.length;
  let best = 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = words.slice(0, mid).join(" ");
    const lineCount = estimateTextLines(candidate, textMetrics, {
      continuation,
    });

    if (lineCount <= maxLines) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best;
}

function splitParagraphBlockIntoPageChunks(
  block,
  textMetrics,
  remainingLines,
  estimateTextLines
) {
  const chunks = [];
  let words = String(block.text || "")
    .split(/\s+/)
    .filter(Boolean);
  let isContinuation = false;

  while (words.length) {
    let budget = remainingLines;

    if (budget <= 0) {
      if (chunks.length) {
        chunks.push({ flushPage: true });
      }
      budget = textMetrics.linesPerPage;
    }

    const chunkSize =
      words.length <= 1
        ? 1
        : getWordCountForLineBudget(words, budget, textMetrics, {
            continuation: isContinuation,
            estimateTextLines,
          });
    const safeChunkSize = Math.max(1, chunkSize);
    const chunkText = words.slice(0, safeChunkSize).join(" ");
    const lineCount = estimateTextLines(chunkText, textMetrics, {
      continuation: isContinuation,
    });

    chunks.push({
      type: "paragraph",
      text: chunkText,
      continuation: isContinuation,
      lineCount,
    });

    remainingLines = budget - lineCount;
    words = words.slice(safeChunkSize);

    if (words.length) {
      isContinuation = true;
      chunks.push({ flushPage: true });
      remainingLines = 0;
    }
  }

  return { chunks, remainingLines };
}

export function splitKdpMarkdownIntoPreviewPages(
  markdown = "",
  textMetrics,
  options = {},
  estimateTextLines
) {
  const blocks = parseKdpMarkdownBlocks(markdown);
  const firstPageReserveLines = Math.max(
    0,
    Number(options.firstPageReserveLines) || 0
  );
  const pages = [];
  let currentBlocks = [];
  let currentLines = firstPageReserveLines;

  const flushPage = () => {
    if (!currentBlocks.length) return;
    pages.push({ blocks: currentBlocks });
    currentBlocks = [];
    currentLines = 0;
  };

  blocks.forEach((block) => {
    if (block.type === "fence") {
      const diagramLines = estimateDiagramBlockLines(
        block.content,
        block.language
      );

      if (
        diagramLines > 0 &&
        currentLines + diagramLines > textMetrics.linesPerPage &&
        currentBlocks.length
      ) {
        flushPage();
      }

      if (diagramLines >= textMetrics.linesPerPage && currentBlocks.length) {
        flushPage();
      }

      currentBlocks.push({
        type: "diagram",
        content: block.content,
        language: block.language || "",
        label: block.label || "",
      });
      currentLines += diagramLines;

      if (currentLines >= textMetrics.linesPerPage) {
        flushPage();
      }

      return;
    }

    const { chunks, remainingLines } = splitParagraphBlockIntoPageChunks(
      block,
      textMetrics,
      textMetrics.linesPerPage - currentLines,
      estimateTextLines
    );

    chunks.forEach((chunk) => {
      if (chunk.flushPage) {
        flushPage();
        return;
      }

      currentBlocks.push({
        type: "paragraph",
        text: chunk.text,
        continuation: chunk.continuation,
      });
      currentLines += chunk.lineCount;

      if (currentLines >= textMetrics.linesPerPage) {
        flushPage();
      }
    });

    if (remainingLines !== textMetrics.linesPerPage - currentLines) {
      currentLines = Math.max(0, textMetrics.linesPerPage - remainingLines);
    }
  });

  flushPage();

  return pages.length
    ? pages
    : [{ blocks: [{ type: "paragraph", text: "" }] }];
}
