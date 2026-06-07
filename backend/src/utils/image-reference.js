const fs = require("fs");
const {
  getImageMimeType,
  prepareExportImages,
  resolveExportImagePath,
} = require("./export-markdown");
const { getVisualReferenceUrlsForChapter } = require("./visual-bible");

function getChapterPrimaryImageUrl(chapter = {}) {
  const images = Array.isArray(chapter.images) ? chapter.images : [];
  const generatedImage =
    images.find((image) => image?.source === "gemini" && image?.url) ||
    images.find((image) => image?.url);

  return generatedImage?.url || "";
}

function getPriorChapterImageUrls(book = {}, chapterIndex = 0) {
  const chapters = Array.isArray(book.chapters) ? book.chapters : [];
  const priorUrls = chapters
    .slice(0, Math.max(0, chapterIndex))
    .map(getChapterPrimaryImageUrl)
    .filter(Boolean);

  if (!priorUrls.length) return [];

  const firstUrl = priorUrls[0];
  const latestUrl = priorUrls[priorUrls.length - 1];

  return Array.from(new Set([firstUrl, latestUrl]));
}

function getContinuityImageUrls(imageUrls = []) {
  const urls = Array.isArray(imageUrls) ? imageUrls.filter(Boolean) : [];

  if (!urls.length) return [];

  const firstUrl = urls[0];
  const latestUrl = urls[urls.length - 1];

  return Array.from(new Set([firstUrl, latestUrl]));
}

function getChapterReferenceImageUrls(book = {}, chapterIndex = 0, options = {}) {
  const chapters = Array.isArray(book.chapters) ? book.chapters : [];
  const chapter = chapters[chapterIndex] || {};
  const visualUrls = getVisualReferenceUrlsForChapter(
    book.visualBible,
    chapter,
    options
  );
  const generatedContinuityUrls = getContinuityImageUrls(
    options.generatedImageUrls
  );
  const hasGeneratedContinuityInput = Array.isArray(options.generatedImageUrls);
  const priorUrls =
    book.visualBible?.matchBookStyle === false
      ? []
      : hasGeneratedContinuityInput
        ? generatedContinuityUrls
        : getPriorChapterImageUrls(book, chapterIndex);

  if (options.visualBibleFirstFallback && visualUrls.length) {
    return Array.from(new Set(visualUrls)).slice(0, 10);
  }

  return Array.from(new Set([...visualUrls, ...priorUrls])).slice(0, 10);
}

function getCoverReferenceImageUrls(book = {}) {
  const visualBible = book.visualBible || {};

  if (visualBible.enabled === false) return [];

  const characters = Array.isArray(visualBible.characters)
    ? visualBible.characters
    : [];
  const styleReferences = Array.isArray(visualBible.styleReferences)
    ? visualBible.styleReferences
    : [];
  const worldReferences = Array.isArray(visualBible.worldReferences)
    ? visualBible.worldReferences
    : [];

  return Array.from(
    new Set(
      [...characters, ...styleReferences, ...worldReferences]
        .map((reference) => reference?.imageUrl)
        .filter(Boolean)
    )
  ).slice(0, 10);
}

async function getImageReferenceFromUrl(url = "") {
  const sourceUrl = String(url || "").trim();

  if (!sourceUrl) return null;

  await prepareExportImages({
    coverImage: sourceUrl,
    chapters: [],
  });

  const filePath = resolveExportImagePath(sourceUrl);

  if (!filePath || !fs.existsSync(filePath)) return null;

  const mimeType = getImageMimeType(filePath);

  if (!/^image\//i.test(mimeType)) return null;

  return {
    data: fs.readFileSync(filePath).toString("base64"),
    mimeType,
    sourceUrl,
  };
}

async function getChapterImageReferences(book = {}, chapterIndex = 0, options = {}) {
  const urls = getChapterReferenceImageUrls(book, chapterIndex, options);
  const references = [];

  for (const url of urls) {
    const reference = await getImageReferenceFromUrl(url);

    if (reference) {
      references.push(reference);
    }
  }

  return references;
}

async function getCoverImageReferences(book = {}) {
  const urls = getCoverReferenceImageUrls(book);
  const references = [];

  for (const url of urls) {
    const reference = await getImageReferenceFromUrl(url);

    if (reference) {
      references.push(reference);
    }
  }

  return references;
}

module.exports = {
  getChapterReferenceImageUrls,
  getChapterImageReferences,
  getContinuityImageUrls,
  getCoverImageReferences,
  getCoverReferenceImageUrls,
  getImageReferenceFromUrl,
  getPriorChapterImageUrls,
};
