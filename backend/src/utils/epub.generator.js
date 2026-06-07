const JSZip = require("jszip");
const MarkdownIt = require("markdown-it");
const fs = require("fs");
const path = require("path");
const {
  getChapterMarkdownForExport,
  getImageMimeType,
  prepareExportImages,
  resolveExportImagePath,
} = require("./export-markdown");
const { __private: diagramTools } = require("./pdf.generator");

function parseExportDiagram(content = "", language = "") {
  const normalizedLanguage = String(language || "").trim().toLowerCase();
  const lines = String(content || "").replace(/\n$/, "").split("\n");

  if (
    normalizedLanguage &&
    !["text", "txt", "plain", "diagram", "flow", "reader-diagram"].includes(
      normalizedLanguage
    ) &&
    !diagramTools.isDiagramCodeBlock(lines)
  ) {
    return null;
  }

  const table = diagramTools.parseAsciiTableDiagram(lines);

  if (table) return { type: "table", ...table };

  const systemComparison = diagramTools.parseSystemComparisonDiagram(lines);

  if (systemComparison) {
    return { type: "flow", ...systemComparison };
  }

  const nestedArchitecture = diagramTools.parseNestedArchitectureDiagram(lines);

  if (nestedArchitecture) {
    return {
      type: "flow",
      title: nestedArchitecture.title || "Architecture",
      nodes: nestedArchitecture.layers,
    };
  }

  const boxedList = diagramTools.parseBoxedListDiagram(lines);

  if (boxedList) return { type: "boxed-list", ...boxedList };

  const process = diagramTools.parseProcessDiagram(lines);

  if (process) return { type: "flow", ...process };

  const stack = diagramTools.parseStackDiagram(lines);

  if (stack) {
    return {
      type: "flow",
      title: stack.title || "Diagram",
      nodes: stack.layers,
    };
  }

  const flow =
    diagramTools.parseFlowDiagram(lines) ||
    diagramTools.parseBranchDiagram(lines) ||
    diagramTools.parseComparisonDiagram(lines) ||
    diagramTools.parseLinearFlowDiagram(lines);

  if (flow) return { type: "flow", ...flow };

  return diagramTools.isDiagramCodeBlock(lines)
    ? {
        type: "pre",
        lines: lines.map(diagramTools.normalizeCodeTextForPdf),
      }
    : null;
}

function renderDiagramHtml(diagram) {
  if (!diagram) return "";

  if (diagram.type === "table") {
    return `<figure class="bookify-diagram"><figcaption>Structured Table</figcaption><table class="bookify-table"><thead><tr>${diagram.header
      .map((cell) => `<th>${escapeXml(cell)}</th>`)
      .join("")}</tr></thead><tbody>${diagram.rows
      .map(
        (row) =>
          `<tr>${row.map((cell) => `<td>${escapeXml(cell)}</td>`).join("")}</tr>`
      )
      .join("")}</tbody></table></figure>`;
  }

  if (diagram.type === "flow") {
    return `<figure class="bookify-diagram"><figcaption>${escapeXml(
      diagram.title || "Diagram"
    )}</figcaption><div class="bookify-flow">${(diagram.nodes || [])
      .map(
        (node, index) =>
          `<div class="bookify-node"><strong>${escapeXml(
            node.label
          )}</strong>${node.detail ? `<p>${escapeXml(node.detail)}</p>` : ""}</div>${
            index < diagram.nodes.length - 1
              ? '<div class="bookify-arrow">↓</div>'
              : ""
          }`
      )
      .join("")}</div></figure>`;
  }

  if (diagram.type === "boxed-list") {
    return `<figure class="bookify-diagram bookify-callout"><figcaption>${escapeXml(
      diagram.title || "Key Points"
    )}</figcaption><ol class="bookify-list">${(diagram.items || [])
      .map((item) => {
        const match = String(item).match(/^\d+[).]\s*(.*)$/);
        return `<li>${escapeXml(match ? match[1] : item)}</li>`;
      })
      .join("")}</ol></figure>`;
  }

  if (diagram.type === "pre") {
    return `<figure class="bookify-diagram"><figcaption>Diagram</figcaption><pre>${escapeXml(
      diagram.lines.join("\n")
    )}</pre></figure>`;
  }

  return "";
}

function createMarkdownRenderer(imageRegistry) {
  const renderer = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true,
    xhtmlOut: true,
  });

  renderer.renderer.rules.image = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const src = token.attrGet("src");
    const imageAsset = imageRegistry.add(src);

    if (imageAsset) {
      token.attrSet("src", imageAsset.href);
    }

    token.attrSet("alt", token.content || token.attrGet("alt") || "Image");

    return self.renderToken(tokens, idx, options);
  };

  const renderCodeLike = (tokens, idx) => {
    const token = tokens[idx];
    const language = String(token.info || "").trim().split(/\s+/)[0] || "";
    const diagram = parseExportDiagram(token.content, language);

    if (diagram) return renderDiagramHtml(diagram);

    return `<pre><code>${escapeXml(token.content)}</code></pre>`;
  };

  renderer.renderer.rules.fence = renderCodeLike;
  renderer.renderer.rules.code_block = renderCodeLike;

  return renderer;
}

function escapeXml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function chapterFileName(index) {
  return `chapter-${String(index + 1).padStart(3, "0")}.xhtml`;
}

function chapterAnchorTitle(chapter, index) {
  return escapeXml(chapter.title || `Chapter ${index + 1}`);
}

function createEpubImageRegistry(zip) {
  const imagesByPath = new Map();
  let counter = 1;

  return {
    add(src = "", preferredId = "") {
      const filePath = resolveExportImagePath(src);

      if (!filePath) return null;

      if (imagesByPath.has(filePath)) {
        return imagesByPath.get(filePath);
      }

      const extension = path.extname(filePath).toLowerCase() || ".png";
      const basename = `image-${String(counter).padStart(3, "0")}${extension}`;
      const image = {
        id: preferredId || `image-${counter}`,
        href: `images/${basename}`,
        mediaType: getImageMimeType(filePath),
      };

      counter += 1;
      zip.file(`OEBPS/${image.href}`, fs.readFileSync(filePath));
      imagesByPath.set(filePath, image);

      return image;
    },
    items() {
      return Array.from(imagesByPath.values());
    },
  };
}

async function generateEpub(book) {
  await prepareExportImages(book);

  const zip = new JSZip();
  const chapters = book.chapters || [];
  const bookId = book._id?.toString() || `book-${Date.now()}`;
  const title = escapeXml(book.title || "Untitled Book");
  const subtitle = escapeXml(book.subtitle || "");
  const author = escapeXml(book.author || "Unknown Author");
  const imageRegistry = createEpubImageRegistry(zip);
  const coverImage = book.coverImage
    ? imageRegistry.add(book.coverImage, "cover-image")
    : null;
  const markdownRenderer = createMarkdownRenderer(imageRegistry);

  zip.file("mimetype", "application/epub+zip", {
    compression: "STORE",
  });

  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
  );

  zip.file(
    "OEBPS/styles.css",
    `body { font-family: Georgia, serif; line-height: 1.6; margin: 5%; color: #111827; }
body.cover-body { margin: 0; padding: 0; }
h1, h2, h3 { font-family: Georgia, serif; color: #111827; }
pre, code { font-family: "Courier New", monospace; }
pre { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; color: #0f172a; font-size: 0.86em; line-height: 1.45; overflow-x: auto; padding: 1em; white-space: pre; }
blockquote { border-left: 4px solid #d1d5db; padding-left: 1em; color: #4b5563; }
img { display: block; max-width: 100%; height: auto; margin: 1.25em auto; }
.cover-page { align-items: center; display: flex; justify-content: center; margin: 0; min-height: 100vh; padding: 0; page-break-after: always; text-align: center; }
.cover-full { display: block; height: 100vh; margin: 0 auto; max-height: 100vh; max-width: 100%; object-fit: contain; width: 100%; }
.title-page { align-items: center; display: flex; flex-direction: column; justify-content: center; min-height: 70vh; page-break-after: always; text-align: center; }
.title-page h1 { font-size: 2em; line-height: 1.15; margin-bottom: 0.45em; }
.subtitle { color: #4b5563; font-size: 1.15em; margin: 0 0 1.4em; }
.author { color: #374151; font-size: 1em; letter-spacing: 0.08em; text-transform: uppercase; }
.toc-page { page-break-after: always; }
.toc-page h1 { text-align: center; }
.toc-list { list-style: none; margin: 2em 0 0; padding: 0; }
.toc-list li { border-bottom: 1px solid #e5e7eb; margin: 0; padding: 0.55em 0; }
.toc-list a { color: #111827; text-decoration: none; }
.bookify-diagram { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; margin: 1.4em 0; padding: 1em; }
.bookify-diagram figcaption { color: #312e81; font-weight: bold; margin-bottom: 0.8em; text-align: center; }
.bookify-node { background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; margin: 0.5em 0; padding: 0.8em; text-align: center; }
.bookify-node p { color: #475569; margin: 0.35em 0 0; }
.bookify-arrow { color: #7c3aed; font-weight: bold; text-align: center; }
.bookify-list { margin: 0; padding-left: 1.4em; }
.bookify-list li { background: #fff; border: 1px solid #dbeafe; border-radius: 8px; margin: 0.55em 0; padding: 0.65em 0.8em; }
.bookify-table { border-collapse: collapse; width: 100%; }
.bookify-table th, .bookify-table td { border: 1px solid #cbd5e1; padding: 0.5em; text-align: left; }
.bookify-table th { background: #111827; color: #fff; }`
  );

  const coverMarkup = coverImage
    ? `<img class="cover-full" src="${escapeXml(
        coverImage.href
      )}" alt="${title} cover"/>`
    : `<h1>${title}</h1>`;

  if (coverImage) {
    zip.file(
      "OEBPS/cover.xhtml",
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${title} Cover</title><link rel="stylesheet" type="text/css" href="styles.css"/></head>
<body class="cover-body"><section class="cover-page">${coverMarkup}</section></body>
</html>`
    );
  }

  zip.file(
    "OEBPS/title.xhtml",
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${title}</title><link rel="stylesheet" type="text/css" href="styles.css"/></head>
<body><section class="title-page"><h1>${title}</h1>${
      subtitle ? `<p class="subtitle">${subtitle}</p>` : ""
    }<p class="author">by ${author}</p></section></body>
</html>`
  );

  zip.file(
    "OEBPS/toc.xhtml",
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Table of Contents</title><link rel="stylesheet" type="text/css" href="styles.css"/></head>
<body><section class="toc-page"><h1>Table of Contents</h1><ol class="toc-list">${chapters
      .map(
        (chapter, index) =>
          `<li><a href="${chapterFileName(index)}">${chapterAnchorTitle(
            chapter,
            index
          )}</a></li>`
      )
      .join("")}</ol></section></body>
</html>`
  );

  const renderedChapters = chapters.map((chapter, index) => ({
    title: escapeXml(chapter.title || `Chapter ${index + 1}`),
    content: markdownRenderer.render(getChapterMarkdownForExport(chapter)),
  }));

  chapters.forEach((chapter, index) => {
    const renderedChapter = renderedChapters[index];

    zip.file(
      `OEBPS/${chapterFileName(index)}`,
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${renderedChapter.title}</title><link rel="stylesheet" type="text/css" href="styles.css"/></head>
<body><section><h1>${renderedChapter.title}</h1>${renderedChapter.content}</section></body>
</html>`
    );
  });

  const manifestItems = [
    '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>',
    '<item id="styles" href="styles.css" media-type="text/css"/>',
    ...(coverImage
      ? [
          '<item id="cover-page" href="cover.xhtml" media-type="application/xhtml+xml"/>',
        ]
      : []),
    '<item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>',
    '<item id="toc-page" href="toc.xhtml" media-type="application/xhtml+xml"/>',
    ...chapters.map(
      (_, index) =>
        `<item id="chapter-${index + 1}" href="${chapterFileName(
          index
        )}" media-type="application/xhtml+xml"/>`
    ),
    ...imageRegistry
      .items()
      .map(
        (image) =>
          `<item id="${escapeXml(image.id)}" href="${escapeXml(
            image.href
          )}" media-type="${escapeXml(image.mediaType)}"/>`
      ),
  ].join("\n    ");

  const spineItems = [
    ...(coverImage ? ['<itemref idref="cover-page"/>'] : []),
    '<itemref idref="title"/>',
    '<itemref idref="toc-page"/>',
    ...chapters.map((_, index) => `<itemref idref="chapter-${index + 1}"/>`),
  ].join("\n    ");

  zip.file(
    "OEBPS/content.opf",
    `<?xml version="1.0" encoding="UTF-8"?>
<package version="2.0" unique-identifier="bookid" xmlns="http://www.idpf.org/2007/opf">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${title}</dc:title>
    <dc:creator>${author}</dc:creator>
    <dc:language>en</dc:language>
    <dc:identifier id="bookid">${escapeXml(bookId)}</dc:identifier>
    ${coverImage ? '<meta name="cover" content="cover-image"/>' : ""}
  </metadata>
  <manifest>
    ${manifestItems}
  </manifest>
  <spine toc="ncx">
    ${spineItems}
  </spine>
</package>`
  );

  const navPoints = chapters
    .map(
      (chapter, index) => `<navPoint id="navPoint-${index + 1}" playOrder="${
        index + (coverImage ? 4 : 3)
      }">
      <navLabel><text>${escapeXml(
        chapter.title || `Chapter ${index + 1}`
      )}</text></navLabel>
      <content src="${chapterFileName(index)}"/>
    </navPoint>`
    )
    .join("\n    ");

  zip.file(
    "OEBPS/toc.ncx",
    `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="${escapeXml(bookId)}"/></head>
  <docTitle><text>${title}</text></docTitle>
  <navMap>
    ${
      coverImage
        ? `<navPoint id="navPoint-cover" playOrder="1">
      <navLabel><text>Cover</text></navLabel>
      <content src="cover.xhtml"/>
    </navPoint>`
        : ""
    }
    <navPoint id="navPoint-title" playOrder="${coverImage ? 2 : 1}">
      <navLabel><text>${title}</text></navLabel>
      <content src="title.xhtml"/>
    </navPoint>
    <navPoint id="navPoint-toc" playOrder="${coverImage ? 3 : 2}">
      <navLabel><text>Table of Contents</text></navLabel>
      <content src="toc.xhtml"/>
    </navPoint>
    ${navPoints}
  </navMap>
</ncx>`
  );

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

module.exports = { generateEpub };
