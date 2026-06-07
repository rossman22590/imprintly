const PDFDocument = require("pdfkit");
const MarkdownIt = require("markdown-it");

const md = new MarkdownIt({
  html: false,
  linkify: false,
  breaks: false,
});

const PAGE = {
  width: 500,
  background: "#fbfaf6",
  ink: "#1f2937",
  heading: "#102a27",
  muted: "#64748b",
  accent: "#d7bd87",
  card: "#ffffff",
  border: "#e5e7eb",
};

function sanitizeText(value = "") {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, " ")
    .replace(/\*\*/g, "")
    .replace(/__+/g, "")
    .replace(/`+/g, "")
    .replace(/!\[[^\]]*]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/[^\S\n]+/g, " ")
    .trim();
}

function safeTitle(value = "Untitled") {
  return sanitizeText(value) || "Untitled";
}

function getRiskNotes(book) {
  return String(book?.kdp?.assets?.riskNotes || "")
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, "  ")
    .trim();
}

function paintPage(doc) {
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(PAGE.background);
}

function ensureSpace(doc, height) {
  if (doc.y + height <= doc.page.height - doc.page.margins.bottom) return;
  doc.addPage();
  paintPage(doc);
  doc.y = doc.page.margins.top;
}

function markdownToPlainText(value = "") {
  return String(value || "")
    .replace(/!\[([^\]]*)]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/[`*_~>#]/g, "")
    .replace(/[^\S\n]+/g, " ")
    .trim();
}

function getInlineSegments(content = "") {
  const parsed = md.parseInline(content, {})?.[0]?.children || [];
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
    if (token.type === "image") {
      if (token.content) {
        segments.push({ text: token.content, italic: true });
      }
      return;
    }
    if (token.content) {
      segments.push({ text: token.content, ...state });
    }
  });

  return segments.length ? segments : [{ text: content }];
}

function setInlineFont(doc, segment, baseSize = 10.5) {
  if (segment.code) {
    doc.font("Courier").fontSize(baseSize - 1).fillColor("#9f1239");
    return;
  }

  const font = segment.bold
    ? segment.italic
      ? "Helvetica-BoldOblique"
      : "Helvetica-Bold"
    : segment.italic
      ? "Helvetica-Oblique"
      : "Helvetica";

  doc
    .font(font)
    .fontSize(baseSize)
    .fillColor(segment.link ? "#2563eb" : PAGE.ink);
}

function drawInlineText(doc, content, x, y, options = {}) {
  const segments = getInlineSegments(content).filter((segment) => segment.text);

  segments.forEach((segment, index) => {
    const textOptions = {
      width: options.width || PAGE.width,
      lineGap: options.lineGap ?? 4,
      continued: index < segments.length - 1,
    };

    setInlineFont(doc, segment, options.size || 10.5);
    if (index === 0) {
      doc.text(segment.text, x, y, textOptions);
      return;
    }
    doc.text(segment.text, textOptions);
  });
}

function drawParagraph(doc, content, options = {}) {
  const width = options.width || PAGE.width;
  const x = options.x || doc.page.margins.left;
  const plain = markdownToPlainText(content);
  const height = doc
    .font("Helvetica")
    .fontSize(options.size || 10.5)
    .heightOfString(plain || " ", {
      width,
      lineGap: options.lineGap ?? 4,
    });

  ensureSpace(doc, height + 16);
  drawInlineText(doc, content, x, doc.y, {
    width,
    lineGap: options.lineGap ?? 4,
    size: options.size || 10.5,
  });
  doc.moveDown(options.after ?? 0.75);
}

function drawHeading(doc, content, level) {
  const size = level === 1 ? 18 : level === 2 ? 15 : 12.5;
  const clean = markdownToPlainText(content);
  const height = doc
    .font("Helvetica-Bold")
    .fontSize(size)
    .heightOfString(clean, { width: PAGE.width, lineGap: 2 });

  ensureSpace(doc, height + 26);
  doc.moveDown(level === 1 ? 0.8 : 0.45);
  doc
    .fillColor(PAGE.heading)
    .font("Helvetica-Bold")
    .fontSize(size)
    .text(clean, doc.page.margins.left, doc.y, {
      width: PAGE.width,
      lineGap: 2,
    });
  doc.moveDown(level === 1 ? 0.55 : 0.4);
}

function drawListItem(doc, marker, content) {
  const markerX = doc.page.margins.left + 8;
  const textX = doc.page.margins.left + 34;
  const width = PAGE.width - 34;
  const plain = markdownToPlainText(content);
  const height = doc
    .font("Helvetica")
    .fontSize(10.25)
    .heightOfString(plain || " ", {
      width,
      lineGap: 3,
    });

  ensureSpace(doc, height + 12);
  const y = doc.y;

  doc
    .fillColor(PAGE.heading)
    .font("Helvetica-Bold")
    .fontSize(10)
    .text(marker, markerX, y, {
      width: 18,
      align: "right",
      lineBreak: false,
    });
  drawInlineText(doc, content, textX, y, {
    width,
    size: 10.25,
    lineGap: 3,
  });
  doc.moveDown(0.45);
}

function drawCodeBlock(doc, content = "") {
  const clean = String(content || "").replace(/\n+$/g, "");
  const width = PAGE.width - 28;
  const height = doc
    .font("Courier")
    .fontSize(8.5)
    .heightOfString(clean || " ", {
      width,
      lineGap: 2,
    });

  ensureSpace(doc, height + 30);
  const top = doc.y;

  doc
    .roundedRect(doc.page.margins.left, top, PAGE.width, height + 20, 8)
    .fillAndStroke("#f8fafc", "#cbd5e1");
  doc
    .fillColor("#0f172a")
    .font("Courier")
    .fontSize(8.5)
    .text(clean, doc.page.margins.left + 14, top + 10, {
      width,
      lineGap: 2,
    });
  doc.y = top + height + 30;
}

function drawRule(doc) {
  ensureSpace(doc, 18);
  doc
    .moveTo(doc.page.margins.left, doc.y + 5)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y + 5)
    .strokeColor(PAGE.accent)
    .lineWidth(0.8)
    .stroke();
  doc.moveDown(0.8);
}

function drawMarkdown(doc, markdown) {
  const content = markdown || "No AI risk notes yet. Run the AI risk scan first.";
  const tokens = md.parse(content, {});
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
      doc.moveDown(0.35);
      index += 1;
      continue;
    }

    if (token.type === "ordered_list_open") {
      let listCounter = Number(token.attrGet("start") || 1);
      index += 1;
      while (index < tokens.length && tokens[index].type !== "ordered_list_close") {
        if (tokens[index].type === "list_item_open") {
          const inline = tokens[index + 2];
          if (inline?.type === "inline") {
            drawListItem(doc, `${listCounter}.`, inline.content);
            listCounter += 1;
          }
        }
        index += 1;
      }
      doc.moveDown(0.35);
      index += 1;
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
      .moveTo(doc.page.margins.left, doc.page.height - 40)
      .lineTo(doc.page.width - doc.page.margins.right, doc.page.height - 40)
      .strokeColor("#e5e7eb")
      .lineWidth(0.8)
      .stroke();

    const originalBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 16;
    doc
      .fillColor("#94a3b8")
      .font("Helvetica")
      .fontSize(7.5)
      .text(title, doc.page.margins.left, doc.page.height - 31, {
        width: 250,
        lineBreak: false,
        ellipsis: true,
      })
      .text(`Page ${index + 1 - range.start}`, doc.page.margins.left, doc.page.height - 31, {
        width: 500,
        align: "right",
        lineBreak: false,
      });
    doc.page.margins.bottom = originalBottom;
  }
}

function generateKdpReportPdf(book) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({
      size: "LETTER",
      margins: {
        top: 56,
        bottom: 56,
        left: 56,
        right: 56,
      },
      bufferPages: true,
    });
    const title = safeTitle(book?.title);
    const author = safeTitle(book?.author || "");
    const riskNotes = getRiskNotes(book);

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    paintPage(doc);

    doc
      .fillColor(PAGE.heading)
      .font("Helvetica-Bold")
      .fontSize(28)
      .text("AI Risk Notes", {
        width: PAGE.width,
      });
    doc
      .fillColor("#475569")
      .font("Helvetica")
      .fontSize(12)
      .text("KDP content policy review", { width: PAGE.width });
    doc
      .fillColor("#64748b")
      .font("Helvetica")
      .fontSize(9.5)
      .text("Missing pages, risky content, copyright flags.", {
        width: PAGE.width,
      });

    doc.moveDown(1.2);
    doc
      .roundedRect(doc.page.margins.left, doc.y, PAGE.width, 74, 12)
      .fillAndStroke(PAGE.card, PAGE.border);
    doc
      .fillColor("#64748b")
      .font("Helvetica-Bold")
      .fontSize(7.5)
      .text("BOOK", doc.page.margins.left + 16, doc.y + 15, {
        width: 220,
      });
    doc
      .fillColor("#0f172a")
      .font("Helvetica-Bold")
      .fontSize(12)
      .text(title, doc.page.margins.left + 16, doc.y + 29, {
        width: 220,
        ellipsis: true,
      });
    doc
      .fillColor("#64748b")
      .font("Helvetica-Bold")
      .fontSize(7.5)
      .text("AUTHOR", doc.page.margins.left + 270, doc.y - 29, {
        width: 200,
      });
    doc
      .fillColor("#0f172a")
      .font("Helvetica-Bold")
      .fontSize(12)
      .text(author || "Not set", doc.page.margins.left + 270, doc.y + 14, {
        width: 200,
        ellipsis: true,
      });
    doc.y = 206;

    doc
      .fillColor("#102a27")
      .font("Helvetica-Bold")
      .fontSize(13)
      .text("AI Scan Results", doc.page.margins.left, doc.y);
    doc
      .moveTo(doc.page.margins.left, doc.y + 6)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y + 6)
      .strokeColor(PAGE.accent)
      .lineWidth(0.8)
      .stroke();
    doc.moveDown(1.2);

    drawMarkdown(doc, riskNotes);
    drawFooter(doc, title);
    doc.end();
  });
}

module.exports = {
  __private: {
    getRiskNotes,
    markdownToPlainText,
  },
  generateKdpReportPdf,
};
