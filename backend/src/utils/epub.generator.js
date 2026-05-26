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
h1, h2, h3 { font-family: Georgia, serif; color: #111827; }
pre, code { font-family: "Courier New", monospace; }
pre { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; color: #0f172a; font-size: 0.86em; line-height: 1.45; overflow-x: auto; padding: 1em; white-space: pre; }
blockquote { border-left: 4px solid #d1d5db; padding-left: 1em; color: #4b5563; }
img { display: block; max-width: 100%; height: auto; margin: 1.25em auto; }
.cover { max-height: 90vh; }`
  );

  const coverMarkup = coverImage
    ? `<p><img class="cover" src="${coverImage.href}" alt="${title} cover"/></p>`
    : "";

  zip.file(
    "OEBPS/title.xhtml",
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${title}</title><link rel="stylesheet" type="text/css" href="styles.css"/></head>
<body><section>${coverMarkup}<h1>${title}</h1><p>by ${author}</p></section></body>
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
    '<item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>',
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
    '<itemref idref="title"/>',
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
        index + 2
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
    <navPoint id="navPoint-title" playOrder="1">
      <navLabel><text>${title}</text></navLabel>
      <content src="title.xhtml"/>
    </navPoint>
    ${navPoints}
  </navMap>
</ncx>`
  );

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

module.exports = { generateEpub };
