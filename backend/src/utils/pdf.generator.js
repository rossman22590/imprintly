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
  const lines = token.content.replace(/\n$/, "").split("\n");
  const maxLineLength = Math.max(...lines.map((line) => line.length), 1);
  const padding = 10;
  const availableWidth = getContentWidth(doc);
  const isAsciiDiagram =
    lines.length >= 3 &&
    lines.some((line) => /^\s*\+[-+]+\+?\s*$/.test(line)) &&
    lines.some((line) => /^\s*\|/.test(line));
  const maxFontSize = isAsciiDiagram ? 9 : PDF_CONFIG.sizes.code;
  const codeFontSize = isAsciiDiagram
    ? Math.max(
        4.8,
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
  const renderLines = isAsciiDiagram
    ? lines
    : lines.flatMap((line) => {
        if (!line) return [""];

        const chunks = [];
        for (let index = 0; index < line.length; index += maxChars) {
          chunks.push(line.slice(index, index + maxChars));
        }

        return chunks;
      });
  const widestLineWidth = Math.max(
    ...renderLines.map((line) => doc.widthOfString(line || " "))
  );
  const horizontalScale =
    isAsciiDiagram && widestLineWidth > innerWidth
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

module.exports = { generatePdf };
