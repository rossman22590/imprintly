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

function stripGeneratedImageMarkdown(content = "") {
  const removeLeadingGeneratedImages = (value = "") => {
    let nextValue = String(value || "").trimStart();
    const generatedImageLine =
      /^!\[[^\]]*\]\((?:https?:\/\/[^)\s]+)?\/uploads\/ai-image-[^)]+\)\s*(?:\n+|$)/i;

    while (generatedImageLine.test(nextValue)) {
      nextValue = nextValue.replace(generatedImageLine, "").trimStart();
    }

    return nextValue;
  };

  const normalizedContent = String(content || "").replace(/\n{3,}/g, "\n\n");
  const trimmedContent = normalizedContent.trimStart();
  const headingMatch = trimmedContent.match(/^(#{1,6}\s+[^\n]+)\n+/);

  if (headingMatch) {
    const heading = headingMatch[1];
    const body = removeLeadingGeneratedImages(
      trimmedContent.slice(headingMatch[0].length)
    );

    return body ? `${heading}\n\n${body}` : heading;
  }

  return removeLeadingGeneratedImages(trimmedContent).trimEnd();
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
  getImageUrlPath,
  getMarkdownImageUrl,
  getUploadUrlFromImageUrl,
  insertImageUnderTitle,
  isGeneratedUploadUrl,
  normalizeChapterImages,
  removeMissingUploadImageMarkdown,
  stripGeneratedImageMarkdown,
  uploadImageExists,
};
