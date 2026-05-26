const fs = require("fs");
const path = require("path");
const {
  buildImageMarkdown,
  getUploadUrlFromImageUrl,
} = require("./chapter-image-markdown");
const { normalizeImageAssetUrl, resolveUploadFilePath } = require("./upload-paths");
const { uploadImageFileToStorage } = require("./image-storage");

function getMimeTypeFromFilePath(filePath = "") {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".png") return "image/png";
  if (extension === ".gif") return "image/gif";
  if (extension === ".webp") return "image/webp";

  return "image/png";
}

function isLocalUploadAssetUrl(url = "") {
  const normalizedUrl = getUploadUrlFromImageUrl(url);

  return normalizedUrl.startsWith("/uploads/");
}

async function uploadLocalAssetUrl(url = "", cache = new Map()) {
  const uploadUrl = getUploadUrlFromImageUrl(url);

  if (!uploadUrl.startsWith("/uploads/")) {
    return normalizeImageAssetUrl(url);
  }

  if (cache.has(uploadUrl)) {
    return cache.get(uploadUrl);
  }

  const filePath = resolveUploadFilePath(uploadUrl);

  if (!filePath || !fs.existsSync(filePath)) {
    cache.set(uploadUrl, "");
    return "";
  }

  const uploadPromise = uploadImageFileToStorage(
    filePath,
    path.basename(filePath),
    getMimeTypeFromFilePath(filePath)
  );

  cache.set(uploadUrl, uploadPromise);

  const remoteUrl = await uploadPromise;
  cache.set(uploadUrl, remoteUrl);

  return remoteUrl;
}

async function migrateMarkdownImagesToStorage(content = "", cache = new Map()) {
  const source = String(content || "");
  const imageRegex = /!\[([^\]]*)\]\(([^)]*)\)/g;
  const parts = [];
  let changed = false;
  let lastIndex = 0;
  let match;

  while ((match = imageRegex.exec(source)) !== null) {
    const [fullMatch, alt, rawUrl] = match;
    const normalizedUrl = getUploadUrlFromImageUrl(rawUrl);

    parts.push(source.slice(lastIndex, match.index));
    lastIndex = match.index + fullMatch.length;

    if (normalizedUrl.startsWith("/uploads/")) {
      const remoteUrl = await uploadLocalAssetUrl(normalizedUrl, cache);
      changed = true;

      if (remoteUrl) {
        parts.push(buildImageMarkdown({ alt, url: remoteUrl }));
      }

      continue;
    }

    parts.push(fullMatch);
  }

  if (lastIndex === 0) {
    return { content: source, changed: false };
  }

  parts.push(source.slice(lastIndex));

  return {
    content: parts.join("").replace(/\n{3,}/g, "\n\n").trimStart(),
    changed,
  };
}

async function migrateImageAssetsToStorage(images = [], cache = new Map()) {
  if (!Array.isArray(images)) {
    return { images: [], changed: false };
  }

  const migratedImages = [];
  let changed = false;

  for (const image of images) {
    const plainImage =
      image && typeof image.toObject === "function"
        ? image.toObject()
        : { ...(image || {}) };
    const normalizedUrl =
      getUploadUrlFromImageUrl(plainImage.url) ||
      normalizeImageAssetUrl(plainImage.url);

    if (!normalizedUrl) {
      changed = true;
      continue;
    }

    const nextUrl = normalizedUrl.startsWith("/uploads/")
      ? await uploadLocalAssetUrl(normalizedUrl, cache)
      : normalizedUrl;

    if (!nextUrl) {
      changed = true;
      continue;
    }

    if (nextUrl !== plainImage.url) {
      changed = true;
    }

    migratedImages.push({
      ...plainImage,
      url: nextUrl,
    });
  }

  return { images: migratedImages, changed };
}

async function migrateChapterPayloadImagesToStorage(chapter = {}, cache = new Map()) {
  const contentResult = await migrateMarkdownImagesToStorage(
    chapter.content || "",
    cache
  );
  const imagesResult = await migrateImageAssetsToStorage(
    chapter.images || [],
    cache
  );

  return {
    chapter: {
      ...chapter,
      content: contentResult.content,
      images: imagesResult.images,
    },
    changed: contentResult.changed || imagesResult.changed,
  };
}

async function migrateBookImagesToStorage(book, cache = new Map()) {
  let changed = false;

  if (isLocalUploadAssetUrl(book.coverImage)) {
    const remoteCoverUrl = await uploadLocalAssetUrl(book.coverImage, cache);

    book.coverImage = remoteCoverUrl || "";
    changed = true;
  }

  for (const chapter of book.chapters || []) {
    const result = await migrateChapterPayloadImagesToStorage(chapter, cache);

    if (result.changed) {
      chapter.content = result.chapter.content;
      chapter.images = result.chapter.images;
      changed = true;
    }
  }

  return changed;
}

module.exports = {
  migrateBookImagesToStorage,
  migrateChapterPayloadImagesToStorage,
  uploadLocalAssetUrl,
};
