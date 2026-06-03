const fs = require("fs");
const ENV = require("../configs/env");
const {
  normalizeImageAssetUrl,
  normalizeUploadUrl,
  resolveUploadFilePath,
} = require("./upload-paths");

function getApiBaseUrl(req = null) {
  if (ENV.PUBLIC_API_URL) {
    return ENV.PUBLIC_API_URL.replace(/\/$/, "");
  }

  if (req?.get) {
    return `${req.protocol}://${req.get("host")}`;
  }

  return ENV.NODE_ENV === "development" ? `http://localhost:${ENV.PORT}` : "";
}

function escapeMarkdownAlt(text = "") {
  return String(text)
    .replace(/[\r\n]+/g, " ")
    .replace(/[\[\]]/g, "")
    .trim();
}

function getMarkdownImageUrl(url = "", req = null) {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  if (url.startsWith("/uploads/")) {
    return `${getApiBaseUrl(req)}${url}`;
  }

  return url;
}

function isGeneratedUploadUrl(url = "") {
  return /(?:^|\/)uploads\/ai-image-/i.test(String(url));
}

function getRawImageUrlPath(url = "") {
  const value = String(url || "").replace(/\s+/g, "").trim();

  if (!value) return "";

  try {
    return new URL(value).pathname;
  } catch {
    return value.split(/[?#]/)[0];
  }
}

function normalizeLegacyGeneratedUploadUrl(uploadUrl = "") {
  return String(uploadUrl || "").replace(
    /^\/uploads\/aiimage-/i,
    "/uploads/ai-image-"
  );
}

function getUploadUrlFromImageUrl(url = "") {
  const compactUrl = String(url || "").replace(/\s+/g, "").trim();
  const normalizedAssetUrl = normalizeImageAssetUrl(compactUrl);

  if (normalizedAssetUrl) {
    return normalizedAssetUrl;
  }

  const rawPath = getRawImageUrlPath(url);
  const uploadIndex = rawPath.indexOf("/uploads/");

  if (uploadIndex === -1) {
    return "";
  }

  return normalizeLegacyGeneratedUploadUrl(
    normalizeUploadUrl(rawPath.slice(uploadIndex))
  );
}

function getImageUrlPath(url = "") {
  return getUploadUrlFromImageUrl(url) || getRawImageUrlPath(url);
}

function uploadImageExists(url = "") {
  const uploadUrl = getUploadUrlFromImageUrl(url);

  if (!uploadUrl) {
    return true;
  }

  if (/^https:\/\//i.test(uploadUrl)) {
    return true;
  }

  const filePath = resolveUploadFilePath(uploadUrl);

  return Boolean(filePath && fs.existsSync(filePath));
}

function contentHasImageUrl(content = "", url = "") {
  const targetPath = getImageUrlPath(url);
  const imageRegex = /!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let match;

  while ((match = imageRegex.exec(String(content || ""))) !== null) {
    const currentPath = getImageUrlPath(match[1]);

    if (targetPath && currentPath === targetPath) {
      return true;
    }
  }

  return false;
}

function rebuildUploadImageMarkdown(match = "", alt = "", rawUrl = "") {
  const uploadUrl = getUploadUrlFromImageUrl(rawUrl);

  if (!uploadUrl) {
    return match;
  }

  if (!uploadImageExists(uploadUrl)) {
    return "";
  }

  if (/^https:\/\//i.test(uploadUrl)) {
    return buildImageMarkdown({ alt, url: uploadUrl });
  }

  const normalizedRawUrl = String(rawUrl || "").replace(/\s+/g, "").trim();
  const rawPath = getRawImageUrlPath(rawUrl);

  if (rawPath === uploadUrl) {
    return match;
  }

  try {
    const url = new URL(normalizedRawUrl);
    url.pathname = uploadUrl;
    url.search = "";
    url.hash = "";
    return buildImageMarkdown({ alt, url: url.toString() });
  } catch {
    return buildImageMarkdown({ alt, url: uploadUrl });
  }
}

function removeMissingUploadImageMarkdown(content = "") {
  return String(content || "")
    .replace(/!\[([^\]]*)\]\(([^)]*)\)/g, rebuildUploadImageMarkdown)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimStart();
}

function normalizeChapterImages(images = [], { requireExisting = false } = {}) {
  if (!Array.isArray(images)) return [];

  const seen = new Set();

  return images
    .map((image) => {
      const plainImage =
        image && typeof image.toObject === "function"
          ? image.toObject()
          : { ...(image || {}) };
      const url = getUploadUrlFromImageUrl(plainImage.url);

      if (!url || seen.has(url)) {
        return null;
      }

      if (requireExisting && !uploadImageExists(url)) {
        return null;
      }

      seen.add(url);

      return {
        ...plainImage,
        url,
      };
    })
    .filter(Boolean);
}

function filterChapterImagesToContent(
  content = "",
  images = [],
  { requireExisting = false } = {}
) {
  return normalizeChapterImages(images, { requireExisting }).filter((image) =>
    contentHasImageUrl(content, image.url)
  );
}

function stripGeneratedImageMarkdown(content = "") {
  const generatedImageLine =
    /^[ \t]*!\[[^\]]*\]\((?:https?:\/\/[^)\s]+)?\/uploads\/ai-image-[^)]+\)[ \t]*(?:\r?\n|$)/gim;

  return String(content || "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(generatedImageLine, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildImageMarkdown({ alt = "", url = "", req = null }) {
  return `![${escapeMarkdownAlt(alt)}](${getMarkdownImageUrl(url, req)})`;
}

function insertImageUnderTitle(content = "", imageMarkdown = "") {
  const cleanedContent = stripGeneratedImageMarkdown(content);
  const trimmedContent = cleanedContent.trimStart();

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

function insertImagesThroughoutChapter(content = "", imageMarkdowns = []) {
  const images = (Array.isArray(imageMarkdowns) ? imageMarkdowns : [imageMarkdowns])
    .map((imageMarkdown) => String(imageMarkdown || "").trim())
    .filter(Boolean);

  if (images.length === 0) return content || "";
  if (images.length === 1) return insertImageUnderTitle(content, images[0]);

  const cleanedContent = stripGeneratedImageMarkdown(content);
  const trimmedContent = cleanedContent.trimStart();

  if (!trimmedContent) {
    return `${images.join("\n\n")}\n`;
  }

  const headingMatch = trimmedContent.match(/^(#{1,6}\s+[^\n]+)\n+/);
  const heading = headingMatch ? headingMatch[1] : "";
  const body = headingMatch
    ? trimmedContent.slice(headingMatch[0].length).trimStart()
    : trimmedContent;
  const blocks = body ? body.split(/\n{2,}/).filter((block) => block.trim()) : [];

  if (blocks.length === 0) {
    return heading
      ? `${heading}\n\n${images.join("\n\n")}\n`
      : `${images.join("\n\n")}\n`;
  }

  const outputBlocks = [];
  const insertAfterIndexes = images.map((_, imageIndex) => {
    if (imageIndex === 0) return -1;

    return Math.min(
      blocks.length - 1,
      Math.max(0, Math.ceil((blocks.length * imageIndex) / images.length) - 1)
    );
  });
  const imagesByBlockIndex = new Map();

  insertAfterIndexes.forEach((blockIndex, imageIndex) => {
    if (!imagesByBlockIndex.has(blockIndex)) {
      imagesByBlockIndex.set(blockIndex, []);
    }

    imagesByBlockIndex.get(blockIndex).push(images[imageIndex]);
  });

  if (heading) {
    outputBlocks.push(heading);
  }

  outputBlocks.push(...(imagesByBlockIndex.get(-1) || []));

  blocks.forEach((block, blockIndex) => {
    outputBlocks.push(block);
    outputBlocks.push(...(imagesByBlockIndex.get(blockIndex) || []));
  });

  return `${outputBlocks.filter(Boolean).join("\n\n")}\n`;
}

function insertImageUnderTitleWithoutStripping(content = "", imageMarkdown = "") {
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

function ensureChapterImageInContent(chapter = {}, req = null) {
  const seen = new Set();
  const missingImageMarkdown = normalizeChapterImages(chapter.images)
    .filter((image) => {
      if (!image?.url) return false;

      const key = getImageUrlPath(image.url) || image.url;

      if (seen.has(key) || contentHasImageUrl(chapter.content, image.url)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .map((image) =>
      buildImageMarkdown({
        alt: image.alt || `${chapter.title || "Chapter"} illustration`,
        url: image.url,
        req,
      })
    )
    .join("\n\n");

  if (!missingImageMarkdown) {
    return chapter.content || "";
  }

  return insertImageUnderTitleWithoutStripping(
    chapter.content || "",
    missingImageMarkdown
  );
}

module.exports = {
  buildImageMarkdown,
  contentHasImageUrl,
  escapeMarkdownAlt,
  ensureChapterImageInContent,
  filterChapterImagesToContent,
  getImageUrlPath,
  getMarkdownImageUrl,
  getUploadUrlFromImageUrl,
  insertImageUnderTitle,
  insertImagesThroughoutChapter,
  isGeneratedUploadUrl,
  normalizeChapterImages,
  removeMissingUploadImageMarkdown,
  stripGeneratedImageMarkdown,
  uploadImageExists,
};
