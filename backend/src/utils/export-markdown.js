const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const {
  buildImageMarkdown,
  getMarkdownImageUrl,
} = require("./chapter-image-markdown");
const { isDiagramLabelParagraph } = require("./kdp-markdown-blocks");
const { resolveUploadFilePath } = require("./upload-paths");
const { normalizeTrustedImageUrl } = require("./image-storage");

const exportImageCacheDir = path.resolve(__dirname, "../../.cache/export-images");
const remoteImageCache = new Map();
const remoteImageMimeTypes = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
]);

function getUploadPathname(src = "") {
  const value = String(src || "").trim();

  if (!value) return "";

  try {
    const parsed = new URL(value);
    return decodeURIComponent(parsed.pathname);
  } catch {
    const withoutQuery = value.split(/[?#]/)[0];

    if (withoutQuery.startsWith("/uploads/")) {
      return decodeURIComponent(withoutQuery);
    }

    if (withoutQuery.startsWith("uploads/")) {
      return `/${decodeURIComponent(withoutQuery)}`;
    }
  }

  return "";
}

function resolveExportImagePath(src = "") {
  const value = String(src || "").trim();

  if (path.isAbsolute(value) && fs.existsSync(value)) {
    return value;
  }

  const remoteUrl = normalizeTrustedImageUrl(value);

  if (remoteUrl) {
    const cachedPath = remoteImageCache.get(remoteUrl);

    return cachedPath && fs.existsSync(cachedPath) ? cachedPath : "";
  }

  const pathname = getUploadPathname(src);

  if (!pathname) return "";

  const filePath = resolveUploadFilePath(pathname);

  if (filePath && fs.existsSync(filePath)) {
    return filePath;
  }

  const legacyAiImagePathname = pathname.replace(
    /\/uploads\/aiimage-/i,
    "/uploads/ai-image-"
  );

  if (legacyAiImagePathname !== pathname) {
    const legacyFilePath = resolveUploadFilePath(legacyAiImagePathname);

    if (legacyFilePath && fs.existsSync(legacyFilePath)) {
      return legacyFilePath;
    }
  }

  return "";
}

function getExtensionFromMimeType(mimeType = "") {
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") return ".jpg";
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/gif") return ".gif";
  if (mimeType === "image/webp") return ".webp";

  return ".png";
}

function getImageMimeType(filePath = "") {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".png") return "image/png";
  if (extension === ".gif") return "image/gif";
  if (extension === ".webp") return "image/webp";

  return "application/octet-stream";
}

async function downloadRemoteExportImage(src = "") {
  const remoteUrl = normalizeTrustedImageUrl(String(src || "").replace(/\s+/g, ""));

  if (!remoteUrl) return "";

  const cachedPath = remoteImageCache.get(remoteUrl);

  if (cachedPath && fs.existsSync(cachedPath)) {
    return cachedPath;
  }

  try {
    const response = await fetch(remoteUrl, {
      headers: {
        accept: "image/*",
      },
    });

    if (!response.ok) {
      console.warn(`Export image download failed ${response.status}: ${remoteUrl}`);
      return "";
    }

    const mimeType = String(response.headers.get("content-type") || "")
      .split(";")[0]
      .trim()
      .toLowerCase();

    if (!remoteImageMimeTypes.has(mimeType)) {
      console.warn(`Export image rejected unsupported type ${mimeType}: ${remoteUrl}`);
      return "";
    }

    const hash = crypto.createHash("sha256").update(remoteUrl).digest("hex");
    const filePath = path.join(
      exportImageCacheDir,
      `${hash}${getExtensionFromMimeType(mimeType)}`
    );
    const buffer = Buffer.from(await response.arrayBuffer());

    fs.mkdirSync(exportImageCacheDir, { recursive: true });
    fs.writeFileSync(filePath, buffer);
    remoteImageCache.set(remoteUrl, filePath);

    return filePath;
  } catch (error) {
    console.warn(`Export image download failed: ${remoteUrl}`, error.message);
    return "";
  }
}

function collectMarkdownImageSources(markdown = "") {
  const sources = [];
  const imageRegex = /!\[[^\]]*\]\(([^)]*)\)/g;
  let match;

  while ((match = imageRegex.exec(repairBrokenImageMarkdown(markdown))) !== null) {
    sources.push(String(match[1] || "").trim());
  }

  return sources;
}

function collectExportImageSources(book = {}) {
  const sources = [];

  if (book.coverImage) {
    sources.push(book.coverImage);
  }

  (book.chapters || []).forEach((chapter) => {
    (chapter.images || []).forEach((image) => {
      if (image?.url) {
        sources.push(image.url);
      }
    });
    sources.push(...collectMarkdownImageSources(chapter.content || ""));
  });

  return Array.from(new Set(sources.filter(Boolean)));
}

async function prepareExportImages(book = {}) {
  await Promise.all(
    collectExportImageSources(book).map((src) => downloadRemoteExportImage(src))
  );
}

function repairBrokenImageMarkdown(markdown = "") {
  return String(markdown || "").replace(
    /!\[([^\]]*)\]\(\s*([^)]+?)\s*\)/gs,
    (match, alt, src) => {
      const compactSrc = String(src || "").replace(/\s+/g, "");

      if (/^(https?:\/\/|\/?uploads\/)/i.test(compactSrc)) {
        return `![${alt}](${compactSrc})`;
      }

      return match;
    }
  );
}

function isFenceLine(line = "") {
  return /^\s*(```|~~~)/.test(line);
}

function isAsciiDiagramLine(line = "") {
  const trimmed = line.trim();

  if (!trimmed) return false;
  if (/[\u2500-\u257F\u25B2-\u25C4\u2190-\u21FF]/.test(trimmed)) return true;
  if (/^\[[^\]]{2,}\]/.test(trimmed)) return true;
  if (!/^[+|<>^v/\\-]/.test(trimmed)) return false;

  const diagramChars = (trimmed.match(/[+\-|]/g) || []).length;

  return diagramChars >= 2 || /^[<>^v/\\|\-+\s]+$/.test(trimmed);
}

function isAsciiDiagramBlock(lines = []) {
  if (lines.length < 3) return false;

  if (lines.some((line) => /[\u2500-\u257F\u25B2-\u25C4\u2190-\u21FF]/.test(line))) {
    return true;
  }

  const bracketNodeRows = lines.filter((line) =>
    (line.match(/\[[^\]]{2,}\]/g) || []).length > 0
  ).length;
  const connectorRows = lines.filter((line) => {
    const trimmed = line.trim();

    return /^[<>^v/\\|\-+\s]+$/.test(trimmed) && /[<>^v/\\|\-+]/.test(trimmed);
  }).length;

  if (bracketNodeRows >= 1 && connectorRows >= 1) return true;

  const separatorCount = lines.filter((line) => /^\s*\+[-+]+\+?\s*$/.test(line))
    .length;
  const contentCount = lines.filter((line) => /^\s*\|/.test(line)).length;

  return separatorCount >= 2 && contentCount >= 1;
}

function dedupeDiagramLines(lines = []) {
  const output = [];

  lines.forEach((line) => {
    const current = String(line || "").trim();
    const previous = String(output[output.length - 1] || "").trim();

    if (current && current === previous) return;

    output.push(line);
  });

  return output;
}

function wrapAsciiDiagramBlocks(markdown = "") {
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
  const output = [];
  let block = [];
  let inFence = false;

  const flushBlock = () => {
    if (block.length === 0) return;

    if (isAsciiDiagramBlock(block)) {
      if (output.length > 0 && output[output.length - 1] !== "") {
        output.push("");
      }

      output.push("```text", ...dedupeDiagramLines(block), "```");
    } else {
      output.push(...block);
    }

    block = [];
  };

  lines.forEach((line) => {
    if (isFenceLine(line)) {
      flushBlock();
      output.push(line);
      inFence = !inFence;
      return;
    }

    if (!inFence && isAsciiDiagramLine(line)) {
      block.push(line);
      return;
    }

    flushBlock();
    output.push(line);
  });

  flushBlock();

  return output.join("\n");
}

function rewriteMarkdownImageUrls(markdown = "", { req = null } = {}) {
  return repairBrokenImageMarkdown(markdown).replace(
    /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
    (_, alt, src) => `![${alt}](${getMarkdownImageUrl(src, req)})`
  );
}

function contentContainsImageUrl(markdown = "", imageUrl = "") {
  const repairedMarkdown = repairBrokenImageMarkdown(markdown);
  const targetPathname = getUploadPathname(imageUrl);
  const target = String(imageUrl || "").trim();
  const imageRegex = /!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let match;

  while ((match = imageRegex.exec(repairedMarkdown)) !== null) {
    const src = match[1];
    const srcPathname = getUploadPathname(src);

    if (targetPathname && srcPathname && targetPathname === srcPathname) {
      return true;
    }

    if (target && src === target) {
      return true;
    }
  }

  return false;
}

function getUniqueChapterImages(chapter = {}) {
  const seen = new Set();

  return (chapter.images || []).filter((image) => {
    if (!image?.url) return false;

    const key = getUploadPathname(image.url) || image.url;

    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

function insertImageMarkdownAtChapterTop(content = "", imageMarkdown = "") {
  const trimmedContent = String(content || "").trimStart();

  if (!trimmedContent) {
    return `${imageMarkdown}\n`;
  }

  const headingMatch = trimmedContent.match(/^(#{1,6}\s+[^\n]+)\n+/);

  if (headingMatch) {
    const heading = headingMatch[1];
    const body = trimmedContent.slice(headingMatch[0].length).trimStart();

    return body
      ? `${heading}\n\n${imageMarkdown}\n\n${body}`
      : `${heading}\n\n${imageMarkdown}\n`;
  }

  return `${imageMarkdown}\n\n${trimmedContent}`;
}

function injectDiagramLabelsIntoMarkdown(markdown = "") {
  const source = String(markdown || "").replace(/\r\n/g, "\n");

  return source.replace(
    /(^|\n\n)([^\n]+)\n\n```([^\n`]*)\n/g,
    (match, prefix, maybeLabel, language) => {
      const label = String(maybeLabel || "").trim();

      if (!isDiagramLabelParagraph(label)) return match;
      if (/^@label\s+/i.test(label)) return match;

      return `${prefix}\`\`\`${language}\n@label ${label}\n`;
    }
  );
}

function getChapterMarkdownForExport(
  chapter = {},
  { absoluteImageUrls = false, req = null } = {}
) {
  let content = repairBrokenImageMarkdown(chapter.content || "");

  const missingImageMarkdown = getUniqueChapterImages(chapter)
    .filter((image) => !contentContainsImageUrl(content, image.url))
    .map((image) =>
      buildImageMarkdown({
        alt: image.alt || `${chapter.title || "Chapter"} illustration`,
        url: image.url,
        req,
      })
    )
    .join("\n\n");

  if (missingImageMarkdown) {
    content = insertImageMarkdownAtChapterTop(content, missingImageMarkdown);
  }

  content = wrapAsciiDiagramBlocks(content);
  content = injectDiagramLabelsIntoMarkdown(content);

  return absoluteImageUrls ? rewriteMarkdownImageUrls(content, { req }) : content;
}

function normalizeMarkdownForExport(markdown = "", options = {}) {
  const normalized = wrapAsciiDiagramBlocks(repairBrokenImageMarkdown(markdown));

  return options.absoluteImageUrls
    ? rewriteMarkdownImageUrls(normalized, options)
    : normalized;
}

function collectInlineImages(token = {}) {
  const images = [];

  function visit(currentToken = {}) {
    if (currentToken.type === "image") {
      images.push({
        src: currentToken.attrGet?.("src") || "",
        alt: currentToken.content || currentToken.attrGet?.("alt") || "Image",
      });
      return;
    }

    (currentToken.children || []).forEach(visit);
  }

  visit(token);

  return images;
}

function inlineTextWithoutImages(token = {}) {
  function visit(currentToken = {}) {
    if (currentToken.type === "image") return "";
    if (currentToken.type === "softbreak" || currentToken.type === "hardbreak") {
      return "\n";
    }
    if (currentToken.children?.length) {
      return currentToken.children.map(visit).join("");
    }

    return currentToken.content || "";
  }

  return (token.children || []).map(visit).join("");
}

module.exports = {
  collectInlineImages,
  getChapterMarkdownForExport,
  getUniqueChapterImages,
  getImageMimeType,
  getUploadPathname,
  inlineTextWithoutImages,
  normalizeMarkdownForExport,
  prepareExportImages,
  repairBrokenImageMarkdown,
  dedupeDiagramLines,
  resolveExportImagePath,
  rewriteMarkdownImageUrls,
};
