const PDFDocument = require("pdfkit");

const TRIM_SIZES = {
  "5x8": [360, 576],
  "5.25x8": [378, 576],
  "5.5x8.5": [396, 612],
  "6x9": [432, 648],
  "7x10": [504, 720],
  "8.5x11": [612, 792],
};

const TOC_DESIGNS = {
  editorial: {
    background: "#fbfaf6",
    accent: "#c9a45c",
    ink: "#102a27",
    muted: "#64748b",
    card: "#ffffff",
    border: "#e2e8f0",
    numberBackground: "#102a27",
    numberInk: "#ffffff",
    titleFont: "Times-Bold",
    titleSize: 34,
    entryFont: "Helvetica-Bold",
    entrySize: 11.5,
    entryMode: "card",
  },
  classic: {
    background: "#fffdf7",
    accent: "#111827",
    ink: "#111827",
    muted: "#525252",
    card: "#fffdf7",
    border: "#111827",
    numberBackground: "#fffdf7",
    numberInk: "#111827",
    titleFont: "Times-Bold",
    titleSize: 33,
    entryFont: "Times-Roman",
    entrySize: 12,
    entryMode: "rule",
  },
  modern: {
    background: "#f8fafc",
    accent: "#2563eb",
    ink: "#0f172a",
    muted: "#64748b",
    card: "#ffffff",
    border: "#cbd5e1",
    numberBackground: "#2563eb",
    numberInk: "#ffffff",
    titleFont: "Helvetica-Bold",
    titleSize: 30,
    entryFont: "Helvetica-Bold",
    entrySize: 11,
    entryMode: "card",
  },
  luxe: {
    background: "#f7f2e8",
    accent: "#8a5a20",
    ink: "#1f1308",
    muted: "#6b5b4b",
    card: "#fffbf2",
    border: "#d7bd87",
    numberBackground: "#8a5a20",
    numberInk: "#fff8e8",
    titleFont: "Times-Bold",
    titleSize: 35,
    entryFont: "Helvetica-Bold",
    entrySize: 11.25,
    entryMode: "card",
  },
  ledger: {
    background: "#f5f7f4",
    accent: "#386641",
    ink: "#17251d",
    muted: "#53665a",
    card: "#ffffff",
    border: "#bac8b8",
    numberBackground: "#386641",
    numberInk: "#ffffff",
    titleFont: "Helvetica-Bold",
    titleSize: 28,
    entryFont: "Helvetica",
    entrySize: 11,
    entryMode: "ledger",
  },
  basic: {
    background: "#ffffff",
    accent: "#000000",
    ink: "#000000",
    muted: "#000000",
    card: "#ffffff",
    border: "#000000",
    numberBackground: "#ffffff",
    numberInk: "#000000",
    titleFont: "Helvetica-Bold",
    titleSize: 24,
    entryFont: "Helvetica",
    entrySize: 11,
    entryMode: "basic",
  },
};

function sanitizePdfText(value = "") {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[*_`>#]/g, "")
    .replace(/[^\S\n]+/g, " ")
    .trim();
}

function normalizeTocDesign(value = "") {
  return TOC_DESIGNS[value] ? value : "basic";
}

function preventLongWordOverflow(value = "") {
  return String(value || "").replace(/(\S{32})(?=\S)/g, "$1 ");
}

function parseTocEntries(book) {
  const savedToc = sanitizePdfText(book?.kdp?.assets?.tableOfContents || "");
  const lines = savedToc
    .split("\n")
    .map((line) =>
      line
        .trim()
        .replace(/^[-+]\s+/, "")
        .replace(/^\d+[\).:-]\s*/, "")
        .replace(/^chapter\s+\d+[\).:-]?\s*/i, "")
        .trim()
    )
    .filter(Boolean)
    .filter((line) => !/^table\s+of\s+contents$/i.test(line));

  if (lines.length) {
    return lines.map((title, index) => ({
      number: index + 1,
      title: preventLongWordOverflow(title),
    }));
  }

  return (book?.chapters || [])
    .map((chapter, index) => ({
      number: index + 1,
      title: preventLongWordOverflow(
        sanitizePdfText(chapter?.title || `Chapter ${index + 1}`)
      ),
    }))
    .filter((entry) => entry.title);
}

function getPageSize(book) {
  const trimSize = book?.kdp?.settings?.trimSize || "6x9";
  return TRIM_SIZES[trimSize] || TRIM_SIZES["6x9"];
}

function paintBackground(doc, design) {
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(design.background);
}

function drawHeader(doc, design, { title, subtitle, author, contentWidth }) {
  if (design.entryMode === "basic") {
    doc
      .fillColor(design.ink)
      .font(design.titleFont)
      .fontSize(design.titleSize)
      .text("Table of Contents", doc.page.margins.left, 64, {
        width: contentWidth,
        align: "left",
      });
    doc
      .moveTo(doc.page.margins.left, doc.y + 10)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y + 10)
      .strokeColor("#000000")
      .lineWidth(0.75)
      .stroke();
    doc.y += 26;
    return;
  }

  if (design.entryMode === "ledger") {
    doc
      .rect(doc.page.margins.left, 50, 5, 84)
      .fill(design.accent);
    doc
      .fillColor(design.ink)
      .font(design.titleFont)
      .fontSize(design.titleSize)
      .text("Table of Contents", doc.page.margins.left + 18, 60, {
        width: contentWidth - 18,
        align: "left",
      });
  } else {
    doc
      .moveTo(doc.page.margins.left, 72)
      .lineTo(doc.page.width - doc.page.margins.right, 72)
      .strokeColor(design.accent)
      .lineWidth(design.entryMode === "rule" ? 0.8 : 1.2)
      .stroke();
    doc
      .fillColor(design.ink)
      .font(design.titleFont)
      .fontSize(design.titleSize)
      .text("Table of Contents", doc.page.margins.left, 96, {
        width: contentWidth,
        align: "center",
      });
  }

  doc
    .fillColor(design.muted)
    .font("Helvetica")
    .fontSize(10)
    .text(title, doc.page.margins.left, doc.y + 8, {
      width: contentWidth,
      align: design.entryMode === "ledger" ? "left" : "center",
    });

  if (subtitle) {
    doc
      .fillColor(design.muted)
      .font("Helvetica")
      .fontSize(8.5)
      .text(subtitle, {
        width: contentWidth,
        align: design.entryMode === "ledger" ? "left" : "center",
      });
  }

  if (author) {
    doc
      .moveDown(0.4)
      .fillColor(design.ink)
      .font("Helvetica-Bold")
      .fontSize(9)
      .text(`by ${author}`, {
        width: contentWidth,
        align: design.entryMode === "ledger" ? "left" : "center",
      });
  }

  doc.moveDown(2);
}

function getEntryTextWidth(design, contentWidth) {
  if (design.entryMode === "basic") return contentWidth - 42;
  if (design.entryMode === "rule") return contentWidth - 44;
  if (design.entryMode === "ledger") return contentWidth - 54;
  return contentWidth - 68;
}

function measureEntryHeight(doc, design, title, contentWidth) {
  const minimumHeight = design.entryMode === "basic" ? 18 : 38;
  const verticalPadding = design.entryMode === "basic" ? 3 : 20;

  doc.font(design.entryFont).fontSize(design.entrySize);

  return Math.max(
    minimumHeight,
    doc.heightOfString(title, {
      width: getEntryTextWidth(design, contentWidth),
      lineGap: 2,
    }) + verticalPadding
  );
}

function drawEntry(doc, design, entry, y, contentWidth) {
  const left = doc.page.margins.left;
  const entryHeight = measureEntryHeight(doc, design, entry.title, contentWidth);

  if (design.entryMode === "basic") {
    doc
      .fillColor("#000000")
      .font("Helvetica")
      .fontSize(10.5)
      .text(`${entry.number}.`, left, y, { width: 28, align: "right" })
      .font("Helvetica")
      .fontSize(11)
      .text(entry.title, left + 42, y, {
        width: contentWidth - 42,
        lineGap: 1,
      });
    return entryHeight;
  }

  if (design.entryMode === "rule") {
    doc
      .moveTo(left, y + entryHeight - 11)
      .lineTo(doc.page.width - doc.page.margins.right, y + entryHeight - 11)
      .strokeColor(design.border)
      .lineWidth(0.5)
      .stroke();
    doc
      .fillColor(design.ink)
      .font("Times-Bold")
      .fontSize(10)
      .text(String(entry.number).padStart(2, "0"), left, y + 8, {
        width: 30,
      })
      .font(design.entryFont)
      .fontSize(design.entrySize)
      .text(entry.title, left + 44, y + 6, {
        width: contentWidth - 44,
        lineGap: 2,
      });
    return entryHeight;
  }

  if (design.entryMode === "ledger") {
    doc
      .rect(left, y + 2, 3, entryHeight - 13)
      .fill(design.accent);
    doc
      .fillColor(design.muted)
      .font("Helvetica-Bold")
      .fontSize(8)
      .text(String(entry.number).padStart(2, "0"), left + 14, y + 7, {
        width: 28,
      })
      .fillColor(design.ink)
      .font(design.entryFont)
      .fontSize(design.entrySize)
      .text(entry.title, left + 54, y + 6, {
        width: contentWidth - 54,
        lineGap: 2,
      });
    return entryHeight;
  }

  doc
    .roundedRect(left, y, contentWidth, entryHeight - 8, 10)
    .fillAndStroke(design.card, design.border);

  doc.circle(left + 22, y + 17, 12).fill(design.numberBackground);
  doc
    .fillColor(design.numberInk)
    .font("Helvetica-Bold")
    .fontSize(8)
    .text(String(entry.number).padStart(2, "0"), left + 10, y + 12, {
      width: 24,
      align: "center",
    });

  doc
    .fillColor(design.ink)
    .font(design.entryFont)
    .fontSize(design.entrySize)
    .text(entry.title, left + 48, y + 10, {
      width: contentWidth - 68,
      lineGap: 2,
    });

  return entryHeight;
}

function drawFooter(doc, design, title, pageNumber, contentWidth) {
  if (design.entryMode === "basic") return;

  const originalBottom = doc.page.margins.bottom;

  doc
    .moveTo(doc.page.margins.left, doc.page.height - 40)
    .lineTo(doc.page.width - doc.page.margins.right, doc.page.height - 40)
    .strokeColor(design.border)
    .lineWidth(0.8)
    .stroke();
  doc.page.margins.bottom = 16;
  doc
    .fillColor(design.muted)
    .font("Helvetica")
    .fontSize(7.5)
    .text(title, doc.page.margins.left, doc.page.height - 31, {
      width: contentWidth / 2,
      align: "left",
      lineBreak: false,
      ellipsis: true,
    })
    .text(`Page ${pageNumber}`, doc.page.margins.left, doc.page.height - 31, {
      width: contentWidth,
      align: "right",
      lineBreak: false,
    });
  doc.page.margins.bottom = originalBottom;
}

function generateKdpTocPdf(book, options = {}) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const pageSize = getPageSize(book);
    const designId = normalizeTocDesign(options.design || book?.kdp?.settings?.tocDesign);
    const design = TOC_DESIGNS[designId];
    const doc = new PDFDocument({
      size: pageSize,
      margins: {
        top: design.entryMode === "basic" ? 58 : 54,
        bottom: 54,
        left: design.entryMode === "basic" ? 54 : 48,
        right: design.entryMode === "basic" ? 54 : 48,
      },
      bufferPages: true,
      autoFirstPage: true,
    });
    const entries = parseTocEntries(book);
    const title = sanitizePdfText(book?.title || "Untitled");
    const subtitle = sanitizePdfText(book?.subtitle || "");
    const author = sanitizePdfText(book?.author || "");
    const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    paintBackground(doc, design);
    drawHeader(doc, design, { title, subtitle, author, contentWidth });

    const startY = doc.y;
    entries.forEach((entry) => {
      const entryHeight = measureEntryHeight(
        doc,
        design,
        entry.title,
        contentWidth
      );

      if (doc.y + entryHeight > doc.page.height - doc.page.margins.bottom) {
        doc.addPage({ size: pageSize });
        paintBackground(doc, design);
        doc.y = doc.page.margins.top;
      }

      doc.y += drawEntry(doc, design, entry, doc.y, contentWidth);
    });

    if (!entries.length) {
      doc
        .fillColor(design.muted)
        .font("Helvetica")
        .fontSize(11)
        .text("No chapters or table of contents entries are available yet.", {
          width: contentWidth,
          align: "center",
        });
    }

    const range = doc.bufferedPageRange();
    for (let index = range.start; index < range.start + range.count; index += 1) {
      doc.switchToPage(index);
      drawFooter(doc, design, title, index + 1 - range.start, contentWidth);
    }

    if (design.entryMode !== "basic") {
      doc.switchToPage(range.start);
      doc
        .moveTo(doc.page.margins.left, startY - 14)
        .lineTo(doc.page.width - doc.page.margins.right, startY - 14)
        .strokeColor(design.accent)
        .lineWidth(0.8)
        .stroke();
    }

    doc.end();
  });
}

module.exports = {
  __private: {
    normalizeTocDesign,
    parseTocEntries,
  },
  generateKdpTocPdf,
};
