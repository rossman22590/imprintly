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

const KDP_EXTENDED_CODE_LANGUAGES = new Set([
  ...CODE_LANGUAGES,
  "dockerfile",
  "env",
  "graphql",
  "jsx",
  "markdown",
  "md",
  "prisma",
  "tsx",
]);

const KDP_DIAGRAM_LANGUAGES = new Set(["reader-diagram", "diagram", "flow"]);
const MIN_PARAGRAPH_ORPHAN_LINES = 3;
const MIN_PARAGRAPH_ORPHAN_WORDS = 4;
const PAGINATION_RENDER_BUFFER_LINES = 2;

function getPaginationLineBudget(textMetrics = {}) {
  const buffer = Math.max(
    2,
    Number(textMetrics.renderLineBuffer) || PAGINATION_RENDER_BUFFER_LINES
  );

  return Math.max(8, textMetrics.linesPerPage - buffer);
}

function looksLikeAsciiDiagramFence(content = "") {
  const text = String(content || "");

  if (/[┌┐└┘├┤│═]{2,}/.test(text)) return true;
  if (
    /\[[^\]]{2,}\]/.test(text) &&
    /[→↓▲▼│|<>^v+\-\\]{2,}/u.test(text)
  ) {
    return true;
  }

  return /^\s*\|[^\n]+\|/m.test(text) && /\+[-+]+\+/.test(text);
}

function looksLikePlainTextFence(content = "") {
  const lines = String(content || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return true;
  if (looksLikeAsciiDiagramFence(content)) return false;

  if (lines.some((line) => /^(system|user):/i.test(line))) return true;
  if (lines.some((line) => /^▲/.test(line))) return true;
  if (lines.every((line) => /^(\/|#|\*|!|\.)/.test(line))) return true;

  const prosePattern =
    /^(system|user|role|prompt|here is|write a|create a|i am|please|import |\/\/|#|@api|>|PROMPT:|✅|❌)/i;
  const proseLines = lines.filter(
    (line) =>
      prosePattern.test(line) || (line.length > 72 && /[a-z]{4,}/i.test(line))
  );

  return proseLines.length >= Math.max(1, Math.ceil(lines.length * 0.4));
}

function isDedicatedDiagramFence(language = "", content = "") {
  const lang = String(language || "").trim().toLowerCase();

  if (KDP_DIAGRAM_LANGUAGES.has(lang)) return true;
  if (KDP_EXTENDED_CODE_LANGUAGES.has(lang)) return false;

  if (["text", "txt", "plain", ""].includes(lang)) {
    if (looksLikePlainTextFence(content)) return false;

    return (
      looksLikeAsciiDiagramFence(content) ||
      estimateDiagramBlockLines(content, lang) >= 5
    );
  }

  return false;
}

function shouldUseDedicatedDiagramPage(
  language = "",
  content = "",
  textMetrics = null
) {
  if (!isDedicatedDiagramFence(language, content)) return false;

  const lineCost = estimateDiagramBlockLines(content, language, textMetrics);
  const rowCount = String(content || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean).length;

  if (looksLikeAsciiDiagramFence(content)) {
    return rowCount >= 6 || lineCost >= 9;
  }

  const pageThreshold = Math.max(
    7,
    Math.floor((textMetrics?.linesPerPage || 30) * 0.28)
  );

  return lineCost >= pageThreshold;
}

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

function isHorizontalRuleParagraph(paragraph = "") {
  const normalized = String(paragraph || "").trim();
  return /^[-*_](?:\s*[-*_]){2,}$/.test(normalized);
}

const PROSE_BLOCK_TYPES = new Set(["paragraph", "heading", "blockquote", "list"]);

function isProseBlock(block) {
  return PROSE_BLOCK_TYPES.has(block?.type);
}

function normalizeKdpParagraphText(paragraph = "") {
  return String(paragraph || "")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/[ \t\n]+/g, " ")
    .trim();
}

function normalizeKdpInlineText(text = "") {
  return String(text || "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function isMarkdownTableSeparatorLine(line = "") {
  const trimmed = String(line || "").trim();
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(trimmed);
}

function splitMarkdownTableRow(line = "") {
  const trimmed = String(line || "").trim().replace(/^\|/, "").replace(/\|$/, "");

  return trimmed
    .split("|")
    .map((cell) => normalizeKdpInlineText(cell.trim()))
    .filter((cell, index, cells) => cell || index === 0 || index === cells.length - 1);
}

function parseMarkdownTableBlock(lines = []) {
  const pipeLines = lines.filter((line) => String(line).includes("|"));

  if (pipeLines.length < 2) return null;

  const separatorIndex = lines.findIndex((line) =>
    isMarkdownTableSeparatorLine(line)
  );

  if (separatorIndex < 1) return null;

  const header = splitMarkdownTableRow(lines[separatorIndex - 1]);
  const rows = lines
    .slice(separatorIndex + 1)
    .filter(
      (line) =>
        String(line).includes("|") && !isMarkdownTableSeparatorLine(line)
    )
    .map(splitMarkdownTableRow)
    .filter((row) => row.some((cell) => cell));

  if (header.length < 2 || !rows.length) return null;

  return {
    type: "table",
    header,
    rows,
  };
}

function parseKdpParagraphBlock(rawParagraph = "") {
  const stripped = stripKdpInlineMarkdown(rawParagraph).replace(/\r\n/g, "\n").trim();

  if (!stripped) return null;

  const lines = stripped.split("\n").map((line) => line.trim()).filter(Boolean);

  if (!lines.length) return null;

  if (lines.length === 1 && isHorizontalRuleParagraph(lines[0])) {
    return null;
  }

  if (
    lines.length === 2 &&
    lines[0] &&
    (/^=+$/.test(lines[1]) || /^-+$/.test(lines[1]))
  ) {
    return {
      type: "heading",
      level: /^=+$/.test(lines[1]) ? 1 : 2,
      text: normalizeKdpInlineText(lines[0]),
    };
  }

  if (lines.length === 1) {
    const atxHeading = lines[0].match(/^(#{1,6})\s+(.+)$/);

    if (atxHeading) {
      return {
        type: "heading",
        level: atxHeading[1].length,
        text: normalizeKdpInlineText(atxHeading[2]),
      };
    }
  }

  if (lines.every((line) => /^>\s?/.test(line))) {
    const quoteText = normalizeKdpParagraphText(
      lines.map((line) => line.replace(/^>\s?/, "")).join("\n")
    );

    if (!quoteText) return null;

    return {
      type: "blockquote",
      text: quoteText,
    };
  }

  const isOrderedList = lines.every((line) => /^\d+\.\s+/.test(line));
  const isUnorderedList = lines.every((line) => /^[-*+]\s+/.test(line));

  if (isOrderedList || isUnorderedList) {
    const items = lines
      .map((line) =>
        normalizeKdpParagraphText(
          line.replace(/^[-*+]\s+/, "").replace(/^\d+\.\s+/, "")
        )
      )
      .filter(Boolean);

    if (!items.length) return null;

    return {
      type: "list",
      ordered: isOrderedList,
      items,
    };
  }

  const markdownTable = parseMarkdownTableBlock(lines);

  if (markdownTable) {
    return markdownTable;
  }

  const paragraphText = normalizeKdpParagraphText(stripped);

  if (!paragraphText || isHorizontalRuleParagraph(paragraphText)) {
    return null;
  }

  return {
    type: "paragraph",
    text: paragraphText,
  };
}

function getProseBlockPlainText(block = {}) {
  if (block.type === "list") {
    return (block.items || []).join(" ");
  }

  return String(block.text || "");
}

function estimateProseBlockLines(
  block,
  textMetrics,
  estimateTextLines,
  options = {}
) {
  if (block.type === "heading") {
    return Math.max(1.5, 2.4 - Math.min(block.level || 3, 3) * 0.35);
  }

  if (block.type === "blockquote") {
    return (
      estimateTextLines(block.text, textMetrics, {
        continuation: Boolean(options.continuation),
      }) + 0.5
    );
  }

  if (block.type === "list") {
    const itemLines = (block.items || []).reduce(
      (sum, item) => sum + estimateTextLines(item, textMetrics),
      0
    );

    return Math.max(1, itemLines * 0.92 + 0.5);
  }

  if (block.type === "diagram") {
    return estimateDiagramBlockLines(
      block.content,
      block.language,
      textMetrics
    );
  }

  return estimateTextLines(block.text, textMetrics, {
    continuation: Boolean(options.continuation),
  });
}

function estimatePaginatedBlockLines(
  block,
  textMetrics,
  estimateTextLines,
  options = {}
) {
  if (!block) return 0;

  if (block.type === "code") {
    return (
      estimateDiagramBlockLines(block.content, block.language, textMetrics) + 1.4
    );
  }

  if (block.type === "diagram") {
    return (
      estimateDiagramBlockLines(block.content, block.language, textMetrics) *
        1.12 +
      1.8
    );
  }

  if (block.type === "table") {
    const rowCount = (block.rows || []).length + (block.header?.length ? 1 : 0);
    return Math.max(4, rowCount * 1.3 + 2.4);
  }

  const base = estimateProseBlockLines(
    block,
    textMetrics,
    estimateTextLines,
    options
  );

  if (block.type === "heading") return base + 0.55;
  if (block.type === "list") return base + 0.65;
  if (block.type === "blockquote") return base + 0.35;

  return base;
}

function parseKdpTextSegment(text = "") {
  const normalized = String(text || "").replace(/\r\n/g, "\n");

  if (!normalized.trim()) return [];

  return normalized
    .split(/\n{2,}/)
    .map(parseKdpParagraphBlock)
    .filter(Boolean);
}

function parseKdpMarkdownBlocks(markdown = "") {
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

function estimateMonospaceCharsPerLine(textMetrics = {}) {
  const charsPerLine = Number(textMetrics.charsPerLine) || 54;
  return Math.max(16, Math.floor((charsPerLine * 0.68) / 1.12));
}

function countWrappedSourceLines(lines = [], charsPerLine = 54) {
  return lines.reduce((sum, line) => {
    const length = Math.max(1, String(line || "").length);
    return sum + Math.ceil(length / charsPerLine);
  }, 0);
}

function estimateDiagramBlockLines(content = "", language = "", textMetrics = null) {
  const normalizedLanguage = String(language || "").trim().toLowerCase();
  const lines = String(content || "")
    .replace(/\n$/, "")
    .split("\n")
    .map((line) => line.trimEnd());
  const nonEmptyLines = lines.filter((line) => line.trim());
  const monoCharsPerLine = textMetrics
    ? estimateMonospaceCharsPerLine(textMetrics)
    : null;
  const blockOverhead = 2;

  if (!nonEmptyLines.length) return 0;

  if (
    normalizedLanguage &&
    CODE_LANGUAGES.has(normalizedLanguage) &&
    !["text", "txt", "plain", "diagram", "flow", "reader-diagram"].includes(
      normalizedLanguage
    )
  ) {
    const sourceLines = monoCharsPerLine
      ? countWrappedSourceLines(nonEmptyLines, monoCharsPerLine)
      : nonEmptyLines.length;

    return Math.max(4, sourceLines * 0.68 + blockOverhead + 1);
  }

  if (nonEmptyLines.some((line) => line.includes("|"))) {
    const tableRows = nonEmptyLines.filter((line) => line.includes("|")).length;
    const wrappedRows = monoCharsPerLine
      ? countWrappedSourceLines(
          nonEmptyLines.filter((line) => line.includes("|")),
          monoCharsPerLine
        )
      : tableRows;

    return Math.max(7, wrappedRows * 1.35 + blockOverhead + 1);
  }

  const connectorPattern = /^[\s│├└┌┐┘┴┬─═→↓←↑+\-|_.*]+$/;
  const nodeLines = nonEmptyLines.filter((line) => {
    const trimmed = line.trim();
    return trimmed && !connectorPattern.test(trimmed);
  });

  if (nodeLines.length >= 2) {
    const verticalStack = nodeLines.length * 2.35 + blockOverhead + 2;
    const wrappedBody = monoCharsPerLine
      ? countWrappedSourceLines(nonEmptyLines, monoCharsPerLine)
      : nonEmptyLines.length;

    return Math.max(5, Math.max(verticalStack, wrappedBody * 0.84 + blockOverhead));
  }

  const sourceLines = monoCharsPerLine
    ? countWrappedSourceLines(nonEmptyLines, monoCharsPerLine)
    : nonEmptyLines.length;

  return Math.max(5, sourceLines * 0.84 + blockOverhead);
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
      budget = getPaginationLineBudget(textMetrics);
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
      const tailLineCount = estimateTextLines(words.join(" "), textMetrics, {
        continuation: true,
      });
      const isTinyTail = words.length < MIN_PARAGRAPH_ORPHAN_WORDS;

      if (
        (isTinyTail ||
          (tailLineCount > 0 && tailLineCount < MIN_PARAGRAPH_ORPHAN_LINES)) &&
        safeChunkSize > 1
      ) {
        const combinedText = `${chunkText} ${words.join(" ")}`.trim();
        const combinedLineCount = estimateTextLines(combinedText, textMetrics, {
          continuation: isContinuation,
        });

        if (combinedLineCount <= budget) {
          chunks[chunks.length - 1] = {
            type: "paragraph",
            text: combinedText,
            continuation: isContinuation,
            lineCount: combinedLineCount,
          };
          remainingLines = budget - combinedLineCount;
          words = [];
          break;
        }
      }

      isContinuation = true;
      chunks.push({ flushPage: true });
      remainingLines = 0;
    }
  }

  return { chunks, remainingLines };
}

function takeLeadingProseLines(
  block,
  maxLines,
  textMetrics,
  estimateTextLines
) {
  if (!block || maxLines < 1) {
    return { head: null, tail: block };
  }

  if (block.type !== "paragraph" && block.type !== "blockquote") {
    const lineCost = estimatePaginatedBlockLines(
      block,
      textMetrics,
      estimateTextLines
    );

    if (lineCost <= maxLines) {
      return { head: block, tail: null };
    }

    return { head: null, tail: block };
  }

  const { chunks } = splitParagraphBlockIntoPageChunks(
    block,
    textMetrics,
    maxLines,
    estimateTextLines
  );
  const headChunk = chunks.find((chunk) => !chunk.flushPage);

  if (!headChunk) {
    return { head: null, tail: block };
  }

  const allWords = String(block.text || "")
    .split(/\s+/)
    .filter(Boolean);
  const headWords = String(headChunk.text || "")
    .split(/\s+/)
    .filter(Boolean);

  if (headWords.length >= allWords.length) {
    return {
      head: {
        type: block.type,
        text: headChunk.text,
        continuation: headChunk.continuation,
      },
      tail: null,
    };
  }

  return {
    head: {
      type: block.type,
      text: headChunk.text,
      continuation: headChunk.continuation,
    },
    tail: {
      type: block.type,
      text: allWords.slice(headWords.length).join(" "),
      continuation: true,
    },
  };
}

function packProseBlocksIntoRoom(
  proseBlocks = [],
  room,
  textMetrics,
  estimateTextLines
) {
  const packed = [];
  const leftover = [];

  for (let index = 0; index < proseBlocks.length; index += 1) {
    const proseBlock = proseBlocks[index];
    const lineCost = estimatePaginatedBlockLines(
      proseBlock,
      textMetrics,
      estimateTextLines
    );

    if (lineCost > 0 && lineCost <= room) {
      packed.push(proseBlock);
      room -= lineCost;
      continue;
    }

    const { head, tail } = takeLeadingProseLines(
      proseBlock,
      room,
      textMetrics,
      estimateTextLines
    );

    if (head) {
      packed.push(head);
      room -= estimateProseBlockLines(head, textMetrics, estimateTextLines);

      if (tail) {
        leftover.push(tail, ...proseBlocks.slice(index + 1));
      } else {
        leftover.push(...proseBlocks.slice(index + 1));
      }

      break;
    }

    leftover.push(...proseBlocks.slice(index));
    break;
  }

  return { packed, leftover };
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

function fillPageBeforeDiagram(
  state,
  upcomingBlocks = [],
  textMetrics,
  estimateTextLines
) {
  const pageBudget = getPaginationLineBudget(textMetrics);

  if (!state.currentBlocks.length || state.currentLines >= pageBudget) {
    return upcomingBlocks;
  }

  let room = pageBudget - state.currentLines;
  const remaining = [];
  let blockIndex = 0;

  while (blockIndex < upcomingBlocks.length && room > 0) {
    const block = upcomingBlocks[blockIndex];
    const continuation = state.currentBlocks.some((currentBlock) =>
      isProseBlock(currentBlock)
    );
    const lineCount = estimatePaginatedBlockLines(block, textMetrics, estimateTextLines, {
      continuation,
    });

    if (!lineCount || lineCount > room) {
      break;
    }

    state.currentBlocks.push(
      block.type === "paragraph"
        ? { ...block, continuation }
        : block
    );
    state.currentLines += lineCount;
    room = pageBudget - state.currentLines;
    blockIndex += 1;
  }

  remaining.push(...upcomingBlocks.slice(blockIndex));

  return remaining;
}

function appendInlineDiagramToPages(block, state, textMetrics) {
  const pageBudget = getPaginationLineBudget(textMetrics);
  const lineCost = estimatePaginatedBlockLines(
    {
      type: "diagram",
      content: block.content,
      language: block.language,
    },
    textMetrics,
    () => 0
  );

  if (
    lineCost > pageBudget - state.currentLines &&
    state.currentBlocks.length
  ) {
    state.flushPage();
  }

  state.currentBlocks.push({
    type: "diagram",
    content: block.content,
    language: block.language || "",
    label: block.label || "",
    inline: true,
  });
  state.currentLines += lineCost;

  if (state.currentLines >= pageBudget) {
    state.flushPage();
  }
}

function appendCodeBlockToPages(block, state, textMetrics) {
  const pageBudget = getPaginationLineBudget(textMetrics);
  const lineCost = estimatePaginatedBlockLines(
    {
      type: "code",
      content: block.content,
      language: block.language,
    },
    textMetrics,
    () => 0
  );

  if (
    lineCost > pageBudget - state.currentLines &&
    state.currentBlocks.length
  ) {
    state.flushPage();
  }

  state.currentBlocks.push({
    type: "code",
    content: block.content,
    language: block.language || "",
    label: block.label || "",
  });
  state.currentLines += lineCost;

  if (state.currentLines >= pageBudget) {
    state.flushPage();
  }
}

function appendAtomicProseBlockToPages(
  block,
  state,
  textMetrics,
  estimateTextLines,
  options = {}
) {
  const pageBudget = getPaginationLineBudget(textMetrics);
  const lineCost = estimatePaginatedBlockLines(
    block,
    textMetrics,
    estimateTextLines,
    options
  );

  if (
    lineCost > pageBudget - state.currentLines &&
    state.currentBlocks.length
  ) {
    state.flushPage();
  }

  state.currentBlocks.push(block);
  state.currentLines += lineCost;

  if (state.currentLines >= pageBudget) {
    state.flushPage();
  }
}

function appendParagraphBlockToPages(
  block,
  state,
  textMetrics,
  estimateTextLines
) {
  const pageBudget = getPaginationLineBudget(textMetrics);
  const { chunks } = splitParagraphBlockIntoPageChunks(
    block,
    textMetrics,
    pageBudget - state.currentLines,
    estimateTextLines
  );

  chunks.forEach((chunk) => {
    if (chunk.flushPage) {
      state.flushPage();
      return;
    }

    state.currentBlocks.push({
      type: "paragraph",
      text: chunk.text,
      continuation: chunk.continuation,
    });
    state.currentLines += chunk.lineCount;

    if (state.currentLines >= pageBudget) {
      state.flushPage();
    }
  });
}

function shouldKeepHeadingWithNextBlock(
  block,
  nextBlock,
  state,
  textMetrics,
  estimateTextLines
) {
  if (block?.type !== "heading" || !isProseBlock(nextBlock)) return false;

  const pageBudget = getPaginationLineBudget(textMetrics);
  const headingCost = estimatePaginatedBlockLines(
    block,
    textMetrics,
    estimateTextLines
  );
  const nextCost = estimatePaginatedBlockLines(
    nextBlock,
    textMetrics,
    estimateTextLines
  );
  const room = pageBudget - state.currentLines;

  return (
    state.currentBlocks.length > 0 &&
    headingCost <= room &&
    headingCost + nextCost > room &&
    headingCost + nextCost <= pageBudget
  );
}

function appendProseBlockToPages(
  block,
  state,
  textMetrics,
  estimateTextLines,
  allBlocks = [],
  blockIndex = -1
) {
  if (!isProseBlock(block)) return;

  const nextBlock = allBlocks[blockIndex + 1];

  if (
    shouldKeepHeadingWithNextBlock(
      block,
      nextBlock,
      state,
      textMetrics,
      estimateTextLines
    )
  ) {
    state.flushPage();
  }

  if (block.type === "paragraph" || block.type === "blockquote") {
    appendParagraphBlockToPages(block, state, textMetrics, estimateTextLines);
    return;
  }

  if (block.type === "table") {
    appendAtomicProseBlockToPages(block, state, textMetrics, estimateTextLines);
    return;
  }

  appendAtomicProseBlockToPages(block, state, textMetrics, estimateTextLines);
}

function estimatePreviewPageLineCount(page, textMetrics, estimateTextLines) {
  return (page.blocks || []).reduce((sum, block) => {
    return (
      sum +
      estimatePaginatedBlockLines(block, textMetrics, estimateTextLines, {
        continuation: Boolean(block.continuation),
      })
    );
  }, 0);
}

function isDiagramOnlyPreviewPage(page) {
  const blocks = page?.blocks || [];
  return blocks.length === 1 && blocks[0]?.type === "diagram";
}

function countPreviewPageWords(page) {
  return (page?.blocks || []).reduce((sum, block) => {
    if (!isProseBlock(block)) return sum;
    return sum + getProseBlockPlainText(block).split(/\s+/).filter(Boolean).length;
  }, 0);
}

function canPackPagesTogether(firstPage, secondPage, textMetrics, estimateTextLines) {
  if (!firstPage || !secondPage) return false;

  const firstLines = estimatePreviewPageLineCount(
    firstPage,
    textMetrics,
    estimateTextLines
  );
  const secondLines = estimatePreviewPageLineCount(
    secondPage,
    textMetrics,
    estimateTextLines
  );
  return (
    firstLines + secondLines <= getPaginationLineBudget(textMetrics)
  );
}

function isLeadingOrphanParagraphBlock(block) {
  if (!block || block.type !== "paragraph") return false;

  const words = String(block.text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return words.length > 0 && words.length < MIN_PARAGRAPH_ORPHAN_WORDS;
}

function shouldPackProseBelowDiagram(diagramLineCost, textMetrics) {
  const pageBudget = getPaginationLineBudget(textMetrics);
  const room = pageBudget - diagramLineCost;

  return (
    diagramLineCost <= Math.floor(pageBudget * 0.36) && room >= 7
  );
}

function packUnderfilledPagesOnce(pages = [], textMetrics, estimateTextLines) {
  const packed = [];
  const fillThreshold = Math.floor(getPaginationLineBudget(textMetrics) * 0.74);

  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    const lineCount = estimatePreviewPageLineCount(
      page,
      textMetrics,
      estimateTextLines
    );
    const nextPage = pages[index + 1];
    const isTinyPage =
      lineCount > 0 && lineCount <= MIN_PARAGRAPH_ORPHAN_LINES;
    const previousPackedPage = packed[packed.length - 1];

    if (
      isLeadingOrphanParagraphBlock(page.blocks?.[0]) &&
      previousPackedPage &&
      !isDiagramOnlyPreviewPage(page) &&
      canPackPagesTogether(previousPackedPage, page, textMetrics, estimateTextLines)
    ) {
      packed[packed.length - 1] = {
        blocks: [
          ...(previousPackedPage.blocks || []),
          ...(page.blocks || []),
        ],
      };
      continue;
    }

    if (
      lineCount > 0 &&
      (lineCount < fillThreshold || isTinyPage) &&
      nextPage &&
      canPackPagesTogether(page, nextPage, textMetrics, estimateTextLines)
    ) {
      pages[index + 1] = {
        blocks: [...(page.blocks || []), ...(nextPage.blocks || [])],
      };
      continue;
    }

    if (isDiagramOnlyPreviewPage(page) && nextPage) {
      const diagramLines = estimatePreviewPageLineCount(
        page,
        textMetrics,
        estimateTextLines
      );
      const room = getPaginationLineBudget(textMetrics) - diagramLines;

      if (
        room >= 2 &&
        canPackPagesTogether(page, nextPage, textMetrics, estimateTextLines)
      ) {
        packed.push({
          blocks: [...(page.blocks || []), ...(nextPage.blocks || [])],
        });
        index += 1;
        continue;
      }
    }

    const previousPage = packed[packed.length - 1];

    if (
      lineCount > 0 &&
      (lineCount < fillThreshold || isTinyPage) &&
      previousPage &&
      !isDiagramOnlyPreviewPage(page) &&
      canPackPagesTogether(previousPage, page, textMetrics, estimateTextLines)
    ) {
      packed[packed.length - 1] = {
        blocks: [...(previousPage.blocks || []), ...(page.blocks || [])],
      };
      continue;
    }

    packed.push(page);
  }

  return packed.length ? packed : pages;
}

function packUnderfilledPages(pages = [], textMetrics, estimateTextLines) {
  let packed = pages;

  for (let pass = 0; pass < 4; pass += 1) {
    const nextPacked = packUnderfilledPagesOnce(
      packed.map((page) => ({
        blocks: [...(page.blocks || [])],
      })),
      textMetrics,
      estimateTextLines
    );

    if (nextPacked.length === packed.length) {
      let unchanged = true;

      for (let index = 0; index < packed.length; index += 1) {
        if (
          (packed[index].blocks || []).length !==
          (nextPacked[index].blocks || []).length
        ) {
          unchanged = false;
          break;
        }
      }

      if (unchanged) break;
    }

    packed = nextPacked;
  }

  return packed;
}

function splitKdpMarkdownIntoPages(
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
  const state = {
    currentBlocks: [],
    currentLines: firstPageReserveLines,
    pages: [],
    flushPage() {
      const blocks = this.currentBlocks.filter((block) => {
        if (block.type === "paragraph" || block.type === "blockquote") {
          return String(block.text || "").trim().length > 0;
        }

        if (block.type === "heading") {
          return String(block.text || "").trim().length > 0;
        }

        if (block.type === "list") {
          return Array.isArray(block.items) && block.items.length > 0;
        }

        return true;
      });

      if (!blocks.length) {
        this.currentBlocks = [];
        this.currentLines = 0;
        return;
      }

      this.pages.push({ blocks });
      this.currentBlocks = [];
      this.currentLines = 0;
    },
  };

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];

    if (block.type === "fence") {
      if (!isDedicatedDiagramFence(block.language, block.content)) {
        appendCodeBlockToPages(block, state, textMetrics);
        continue;
      }

      if (!shouldUseDedicatedDiagramPage(block.language, block.content, textMetrics)) {
        appendInlineDiagramToPages(block, state, textMetrics);
        continue;
      }

      const upcomingProseBlocks = [];
      let nextIndex = index + 1;

      while (nextIndex < blocks.length && isProseBlock(blocks[nextIndex])) {
        upcomingProseBlocks.push(blocks[nextIndex]);
        nextIndex += 1;
      }

      const remainingParagraphs = fillPageBeforeDiagram(
        state,
        upcomingProseBlocks,
        textMetrics,
        estimateTextLines
      );

      state.flushPage();

      const diagramLineCost = estimatePaginatedBlockLines(
        {
          type: "diagram",
          content: block.content,
          language: block.language,
        },
        textMetrics,
        estimateTextLines
      );
      const diagramPageBlocks = [
        {
          type: "diagram",
          content: block.content,
          language: block.language || "",
          label: block.label || "",
        },
      ];
      const { packed: packedProse, leftover: leftoverProse } =
        shouldPackProseBelowDiagram(diagramLineCost, textMetrics)
          ? packProseBlocksIntoRoom(
              remainingParagraphs,
              getPaginationLineBudget(textMetrics) - diagramLineCost,
              textMetrics,
              estimateTextLines
            )
          : { packed: [], leftover: remainingParagraphs };

      state.pages.push({
        blocks: [...diagramPageBlocks, ...packedProse],
      });

      leftoverProse.forEach((proseBlock, proseIndex) => {
        appendProseBlockToPages(
          proseBlock,
          state,
          textMetrics,
          estimateTextLines,
          leftoverProse,
          proseIndex
        );
      });

      index = nextIndex - 1;
      continue;
    }

    appendProseBlockToPages(
      block,
      state,
      textMetrics,
      estimateTextLines,
      blocks,
      index
    );
  }

  state.flushPage();

  const pages = state.pages.length
    ? state.pages
    : [{ blocks: [{ type: "paragraph", text: "" }] }];

  return packUnderfilledPages(pages, textMetrics, estimateTextLines);
}

module.exports = {
  estimateDiagramBlockLines,
  isDedicatedDiagramFence,
  isDiagramLabelParagraph,
  parseKdpMarkdownBlocks,
  shouldUseDedicatedDiagramPage,
  splitKdpMarkdownIntoPages,
  stripKdpInlineMarkdown,
};
