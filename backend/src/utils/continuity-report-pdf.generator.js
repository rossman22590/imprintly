const PDFDocument = require("pdfkit");
const MarkdownIt = require("markdown-it");

const md = new MarkdownIt({
  html: false,
  linkify: false,
  breaks: false,
});

const PAGE = {
  ink: "#111827",
  muted: "#64748b",
  soft: "#f8fafc",
  border: "#dbe4f0",
  header: "#0f172a",
  accent: "#7c3aed",
  tableHeader: "#ede9fe",
};

function cleanText(value = "") {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, " ")
    .trim();
}

function markdownToPlainText(value = "") {
  return String(value || "")
    .replace(/!\[([^\]]*)]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/[`*_~>#]/g, "")
    .replace(/[^\S\n]+/g, " ")
    .trim();
}

function safeTitle(value = "Untitled") {
  return markdownToPlainText(value) || "Untitled";
}

function paintPage(doc) {
  doc.rect(0, 0, doc.page.width, doc.page.height).fill("#ffffff");
}

function contentWidth(doc) {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function ensureSpace(doc, height) {
  if (doc.y + height <= doc.page.height - doc.page.margins.bottom) return;
  doc.addPage();
  paintPage(doc);
  doc.y = doc.page.margins.top;
}

function getInlineSegments(content = "") {
  const parsed = md.parseInline(String(content || ""), {})?.[0]?.children || [];
  const segments = [];
  const state = {
    bold: false,
    italic: false,
    link: "",
  };

  parsed.forEach((token) => {
    if (token.type === "strong_open") {
      state.bold = true;
      return;
    }
    if (token.type === "strong_close") {
      state.bold = false;
      return;
    }
    if (token.type === "em_open") {
      state.italic = true;
      return;
    }
    if (token.type === "em_close") {
      state.italic = false;
      return;
    }
    if (token.type === "link_open") {
      state.link = token.attrGet("href") || "";
      return;
    }
    if (token.type === "link_close") {
      state.link = "";
      return;
    }
    if (token.type === "softbreak" || token.type === "hardbreak") {
      segments.push({ text: "\n", ...state });
      return;
    }
    if (token.type === "code_inline") {
      segments.push({ text: token.content, code: true });
      return;
    }
    if (token.content) {
      segments.push({ text: token.content, ...state });
    }
  });

  return segments.length ? segments : [{ text: content }];
}

function setInlineFont(doc, segment, size = 10.5) {
  if (segment.code) {
    doc.font("Courier").fontSize(size - 1).fillColor("#be123c");
    return;
  }

  const font = segment.bold
    ? segment.italic
      ? "Helvetica-BoldOblique"
      : "Helvetica-Bold"
    : segment.italic
      ? "Helvetica-Oblique"
      : "Helvetica";

  doc.font(font).fontSize(size).fillColor(segment.link ? "#2563eb" : PAGE.ink);
}

function drawInlineText(doc, content, x, y, options = {}) {
  const segments = getInlineSegments(content).filter((segment) => segment.text);

  segments.forEach((segment, index) => {
    setInlineFont(doc, segment, options.size || 10.5);
    const textOptions = {
      width: options.width || contentWidth(doc),
      lineGap: options.lineGap ?? 3,
      continued: index < segments.length - 1,
    };

    if (index === 0) {
      doc.text(segment.text, x, y, textOptions);
      return;
    }

    doc.text(segment.text, textOptions);
  });
}

function drawHeading(doc, content, level = 2) {
  const width = contentWidth(doc);
  const text = markdownToPlainText(content);
  const size = level === 1 ? 22 : level === 2 ? 16 : 12.5;
  const height = doc
    .font("Helvetica-Bold")
    .fontSize(size)
    .heightOfString(text || " ", { width, lineGap: 2 });

  ensureSpace(doc, height + 24);
  doc.moveDown(level === 1 ? 0.7 : 0.35);
  doc.fillColor(PAGE.header).font("Helvetica-Bold").fontSize(size).text(text, {
    width,
    lineGap: 2,
  });
  doc.moveDown(level === 1 ? 0.5 : 0.35);
}

function drawParagraph(doc, content) {
  const width = contentWidth(doc);
  const text = markdownToPlainText(content);
  const height = doc
    .font("Helvetica")
    .fontSize(10.5)
    .heightOfString(text || " ", { width, lineGap: 4 });

  ensureSpace(doc, height + 14);
  drawInlineText(doc, content, doc.page.margins.left, doc.y, {
    width,
    size: 10.5,
    lineGap: 4,
  });
  doc.moveDown(0.7);
}

function drawListItem(doc, marker, content) {
  const width = contentWidth(doc) - 34;
  const markerX = doc.page.margins.left + 6;
  const textX = doc.page.margins.left + 32;
  const text = markdownToPlainText(content);
  const height = doc
    .font("Helvetica")
    .fontSize(10.25)
    .heightOfString(text || " ", { width, lineGap: 3 });

  ensureSpace(doc, height + 12);
  const y = doc.y;

  doc
    .fillColor(PAGE.accent)
    .font("Helvetica-Bold")
    .fontSize(9.5)
    .text(marker, markerX, y, { width: 18, align: "right", lineBreak: false });
  drawInlineText(doc, content, textX, y, { width, size: 10.25, lineGap: 3 });
  doc.moveDown(0.45);
}

function drawCodeBlock(doc, content = "") {
  const clean = String(content || "").replace(/\n+$/g, "");
  const width = contentWidth(doc) - 28;
  const height = doc
    .font("Courier")
    .fontSize(8)
    .heightOfString(clean || " ", { width, lineGap: 2 });

  ensureSpace(doc, height + 30);
  const top = doc.y;

  doc
    .roundedRect(doc.page.margins.left, top, contentWidth(doc), height + 20, 9)
    .fillAndStroke(PAGE.soft, PAGE.border);
  doc
    .fillColor(PAGE.ink)
    .font("Courier")
    .fontSize(8)
    .text(clean, doc.page.margins.left + 14, top + 10, {
      width,
      lineGap: 2,
    });
  doc.y = top + height + 30;
}

function collectTableRows(tokens, startIndex) {
  const rows = [];
  let index = startIndex + 1;

  while (index < tokens.length && tokens[index].type !== "table_close") {
    if (tokens[index].type !== "tr_open") {
      index += 1;
      continue;
    }

    const row = [];
    index += 1;

    while (index < tokens.length && tokens[index].type !== "tr_close") {
      if (tokens[index].type === "th_open" || tokens[index].type === "td_open") {
        const inline = tokens[index + 1];
        row.push(inline?.type === "inline" ? inline.content : "");
        index += 3;
        continue;
      }

      index += 1;
    }

    if (row.length) rows.push(row);
    index += 1;
  }

  return {
    rows,
    nextIndex: index + 1,
  };
}

function getColumnWidths(rows, tableWidth) {
  const columnCount = Math.max(...rows.map((row) => row.length), 1);
  if (columnCount === 5) {
    const weights = [0.13, 0.25, 0.18, 0.25, 0.19];
    return weights.map((weight) => Math.floor(tableWidth * weight));
  }

  return Array.from({ length: columnCount }, () =>
    Math.floor(tableWidth / columnCount)
  );
}

function getRowHeight(doc, row, columnWidths, fontSize) {
  return Math.max(
    28,
    ...row.map((cell, index) =>
      doc
        .font("Helvetica")
        .fontSize(fontSize)
        .heightOfString(markdownToPlainText(cell) || " ", {
          width: columnWidths[index] - 14,
          lineGap: 2,
        })
    )
  );
}

function drawTable(doc, rows = []) {
  if (!rows.length) return;

  const tableWidth = contentWidth(doc);
  const columnWidths = getColumnWidths(rows, tableWidth);
  const fontSize = columnWidths.length >= 5 ? 7.2 : 8.5;
  const x = doc.page.margins.left;

  ensureSpace(doc, 46);
  doc.moveDown(0.25);

  rows.forEach((row, rowIndex) => {
    const rowHeight = getRowHeight(doc, row, columnWidths, fontSize) + 18;
    ensureSpace(doc, rowHeight + 4);
    const y = doc.y;
    let cellX = x;

    row.forEach((cell, cellIndex) => {
      const width = columnWidths[cellIndex];
      const fill = rowIndex === 0 ? PAGE.tableHeader : rowIndex % 2 ? "#ffffff" : PAGE.soft;

      doc.rect(cellX, y, width, rowHeight).fillAndStroke(fill, PAGE.border);
      doc
        .fillColor(rowIndex === 0 ? "#3b0764" : PAGE.ink)
        .font(rowIndex === 0 ? "Helvetica-Bold" : "Helvetica")
        .fontSize(fontSize)
        .text(markdownToPlainText(cell), cellX + 7, y + 8, {
          width: width - 14,
          lineGap: 2,
        });

      cellX += width;
    });

    doc.y = y + rowHeight;
  });

  doc.moveDown(0.9);
}

function drawRule(doc) {
  ensureSpace(doc, 18);
  doc
    .moveTo(doc.page.margins.left, doc.y + 5)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y + 5)
    .strokeColor(PAGE.border)
    .lineWidth(0.8)
    .stroke();
  doc.moveDown(0.8);
}

function drawMarkdown(doc, markdown = "") {
  const tokens = md.parse(markdown || "No continuity report generated yet.", {});
  let index = 0;

  while (index < tokens.length) {
    const token = tokens[index];

    if (token.type === "heading_open") {
      const inline = tokens[index + 1];
      if (inline?.type === "inline") {
        drawHeading(doc, inline.content, Number(token.tag.replace("h", "")));
        index += 3;
        continue;
      }
    }

    if (token.type === "paragraph_open") {
      const inline = tokens[index + 1];
      if (inline?.type === "inline") {
        drawParagraph(doc, inline.content);
        index += 3;
        continue;
      }
    }

    if (token.type === "bullet_list_open") {
      index += 1;
      while (index < tokens.length && tokens[index].type !== "bullet_list_close") {
        if (tokens[index].type === "list_item_open") {
          const inline = tokens[index + 2];
          if (inline?.type === "inline") drawListItem(doc, "-", inline.content);
        }
        index += 1;
      }
      doc.moveDown(0.25);
      index += 1;
      continue;
    }

    if (token.type === "ordered_list_open") {
      let counter = Number(token.attrGet("start") || 1);
      index += 1;
      while (index < tokens.length && tokens[index].type !== "ordered_list_close") {
        if (tokens[index].type === "list_item_open") {
          const inline = tokens[index + 2];
          if (inline?.type === "inline") {
            drawListItem(doc, `${counter}.`, inline.content);
            counter += 1;
          }
        }
        index += 1;
      }
      doc.moveDown(0.25);
      index += 1;
      continue;
    }

    if (token.type === "table_open") {
      const table = collectTableRows(tokens, index);
      drawTable(doc, table.rows);
      index = table.nextIndex;
      continue;
    }

    if (token.type === "fence" || token.type === "code_block") {
      drawCodeBlock(doc, token.content);
      index += 1;
      continue;
    }

    if (token.type === "hr") {
      drawRule(doc);
      index += 1;
      continue;
    }

    index += 1;
  }
}

function drawFooter(doc, title) {
  const range = doc.bufferedPageRange();

  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    doc
      .moveTo(doc.page.margins.left, doc.page.height - 36)
      .lineTo(doc.page.width - doc.page.margins.right, doc.page.height - 36)
      .strokeColor("#e5e7eb")
      .lineWidth(0.8)
      .stroke();

    doc
      .fillColor("#94a3b8")
      .font("Helvetica")
      .fontSize(7.5)
      .text(title, doc.page.margins.left, doc.page.height - 27, {
        width: 350,
        lineBreak: false,
        ellipsis: true,
      })
      .text(`Page ${index + 1 - range.start}`, doc.page.margins.left, doc.page.height - 27, {
        width: contentWidth(doc),
        align: "right",
        lineBreak: false,
      });
  }
}

function generateContinuityReportPdf(book, reportMarkdown = "") {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({
      size: "LETTER",
      layout: "landscape",
      margins: {
        top: 46,
        bottom: 48,
        left: 48,
        right: 48,
      },
      bufferPages: true,
    });
    const title = safeTitle(book?.title);
    const author = safeTitle(book?.author || "");
    const report = cleanText(reportMarkdown);

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    paintPage(doc);

    doc
      .fillColor(PAGE.header)
      .font("Helvetica-Bold")
      .fontSize(25)
      .text("Continuity Report", { width: contentWidth(doc) });
    doc
      .fillColor(PAGE.muted)
      .font("Helvetica")
      .fontSize(10)
      .text(`${title}${author ? ` by ${author}` : ""}`, {
        width: contentWidth(doc),
      });

    doc.moveDown(0.9);
    doc
      .roundedRect(doc.page.margins.left, doc.y, contentWidth(doc), 46, 12)
      .fillAndStroke("#faf5ff", "#ddd6fe");
    doc
      .fillColor("#581c87")
      .font("Helvetica-Bold")
      .fontSize(8)
      .text("BOOK BIBLE CHECK", doc.page.margins.left + 16, doc.y + 12, {
        width: 180,
      });
    doc
      .fillColor(PAGE.ink)
      .font("Helvetica")
      .fontSize(9.5)
      .text(
        "Contradictions, timeline gaps, style drift, unresolved threads, and recommended fixes.",
        doc.page.margins.left + 16,
        doc.y + 24,
        { width: contentWidth(doc) - 32 }
      );
    doc.y += 58;

    drawMarkdown(doc, report);
    drawFooter(doc, title);
    doc.end();
  });
}

module.exports = {
  __private: {
    collectTableRows,
    markdownToPlainText,
  },
  generateContinuityReportPdf,
};
