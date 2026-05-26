const Book = require("../models/Book");
const User = require("../models/User");

const DEFAULT_SHARE_IMAGE = "/images/hero-image.png";
const DEFAULT_SITE_NAME = "Bookify";

function compactText(value = "", maxLength = 180) {
  const text = String(value || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length <= maxLength) return text;

  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}

function getPublicShareRoute(pathname = "") {
  const parts = String(pathname || "")
    .split("/")
    .filter(Boolean);

  if (parts.length !== 2) return null;

  if (parts[0] === "shelf") {
    return { type: "shelf", token: parts[1] };
  }

  if (parts[0] === "preview") {
    return { type: "preview", token: parts[1] };
  }

  if (parts[1].startsWith("shelf_")) {
    return { type: "shelf", token: parts[1] };
  }

  if (parts[1].startsWith("preview_")) {
    return { type: "preview", token: parts[1] };
  }

  return null;
}

function absoluteUrl(url = "", origin = "") {
  const value = String(url || "").trim();

  if (!value) return "";

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (!origin) return value;

  return value.startsWith("/") ? `${origin}${value}` : `${origin}/${value}`;
}

function buildMeta({
  title,
  description,
  image,
  pageUrl,
  origin,
  author,
  type = "website",
}) {
  return {
    title: compactText(title, 80) || DEFAULT_SITE_NAME,
    description:
      compactText(description, 180) ||
      "Read and share public book previews from Bookify.",
    image: absoluteUrl(image || DEFAULT_SHARE_IMAGE, origin),
    url: pageUrl || origin || "",
    author: compactText(author, 80),
    type,
    siteName: DEFAULT_SITE_NAME,
  };
}

async function getShelfMeta(token, options = {}) {
  const user = await User.findOne({ "bookshelfShare.token": token }).lean();

  if (!user) return null;

  const [bookCount, firstBook] = await Promise.all([
    Book.countDocuments({ userId: user._id }),
    Book.findOne({ userId: user._id })
      .sort({ updatedAt: -1, createdAt: -1 })
      .select("coverImage")
      .lean(),
  ]);
  const title =
    user.publicShareMetaTitle ||
    user.shelfPageName ||
    `${user.name || "Author"}'s Bookshelf`;
  const description =
    user.publicShareMetaDescription ||
    `Browse ${user.name || "this author"}'s shared bookshelf${
      bookCount ? ` with ${bookCount} ${bookCount === 1 ? "book" : "books"}` : ""
    }.`;
  const image =
    user.publicShareImageUrl ||
    user.shelfPhotoUrl ||
    firstBook?.coverImage ||
    user.avatar ||
    DEFAULT_SHARE_IMAGE;

  return buildMeta({
    title,
    description,
    image,
    author: user.name,
    type: "website",
    ...options,
  });
}

async function getPreviewMeta(token, options = {}) {
  const book = await Book.findOne({ "previewShare.token": token })
    .populate({
      path: "userId",
      select:
        "name avatar shelfPageName shelfPhotoUrl publicShareMetaTitle publicShareMetaDescription publicShareImageUrl",
    })
    .lean();

  if (!book) return null;

  const owner = book.userId || {};
  const kdpAssets = book.kdp?.assets || {};
  const chapters = Array.isArray(book.chapters) ? book.chapters : [];
  const firstChapter =
    chapters.find((chapter) => String(chapter?.content || "").trim()) ||
    chapters[0] ||
    {};
  const ownerTitle =
    owner.publicShareMetaTitle ||
    owner.shelfPageName ||
    owner.name ||
    DEFAULT_SITE_NAME;
  const title = book.title ? `${book.title} | ${ownerTitle}` : ownerTitle;
  const description =
    owner.publicShareMetaDescription ||
    kdpAssets.description ||
    kdpAssets.backCoverBlurb ||
    book.subtitle ||
    firstChapter.description ||
    (book.title
      ? `Read the first chapter preview of ${book.title}.`
      : "Read this first chapter preview.");
  const image =
    owner.publicShareImageUrl ||
    book.coverImage ||
    owner.shelfPhotoUrl ||
    owner.avatar ||
    DEFAULT_SHARE_IMAGE;

  return buildMeta({
    title,
    description,
    image,
    author: book.author || owner.name,
    type: "book",
    ...options,
  });
}

async function getPublicShareMetaForPath(pathname = "", options = {}) {
  const route = getPublicShareRoute(pathname);

  if (!route?.token) return null;

  if (route.type === "shelf") {
    return getShelfMeta(route.token, options);
  }

  if (route.type === "preview") {
    return getPreviewMeta(route.token, options);
  }

  return null;
}

function escapeHtml(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeRegExp(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceOrInsertHeadTag(html, pattern, replacement) {
  if (pattern.test(html)) {
    return html.replace(pattern, replacement);
  }

  return html.replace("</head>", `    ${replacement}\n  </head>`);
}

function upsertMetaName(html, name, content) {
  return replaceOrInsertHeadTag(
    html,
    new RegExp(
      `<meta\\s+[^>]*name=["']${escapeRegExp(name)}["'][^>]*>`,
      "i"
    ),
    `<meta name="${escapeHtml(name)}" content="${escapeHtml(content)}" />`
  );
}

function upsertMetaProperty(html, property, content) {
  return replaceOrInsertHeadTag(
    html,
    new RegExp(
      `<meta\\s+[^>]*property=["']${escapeRegExp(property)}["'][^>]*>`,
      "i"
    ),
    `<meta property="${escapeHtml(property)}" content="${escapeHtml(content)}" />`
  );
}

function upsertCanonical(html, href) {
  return replaceOrInsertHeadTag(
    html,
    /<link\s+[^>]*rel=["']canonical["'][^>]*>/i,
    `<link rel="canonical" href="${escapeHtml(href)}" />`
  );
}

function injectPublicShareMeta(html = "", meta = {}) {
  const title = meta.title || DEFAULT_SITE_NAME;
  const description = meta.description || "";
  const image = meta.image || "";
  const url = meta.url || "";

  let nextHtml = html.replace(
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeHtml(title)}</title>`
  );

  nextHtml = upsertMetaName(nextHtml, "title", title);
  nextHtml = upsertMetaName(nextHtml, "description", description);
  nextHtml = upsertMetaName(nextHtml, "author", meta.author || meta.siteName);
  nextHtml = upsertMetaProperty(nextHtml, "og:type", meta.type || "website");
  nextHtml = upsertMetaProperty(nextHtml, "og:url", url);
  nextHtml = upsertMetaProperty(nextHtml, "og:title", title);
  nextHtml = upsertMetaProperty(nextHtml, "og:description", description);
  nextHtml = upsertMetaProperty(nextHtml, "og:image", image);
  nextHtml = upsertMetaProperty(nextHtml, "og:image:alt", title);
  nextHtml = upsertMetaProperty(nextHtml, "og:site_name", meta.siteName);
  nextHtml = upsertMetaProperty(nextHtml, "twitter:card", "summary_large_image");
  nextHtml = upsertMetaProperty(nextHtml, "twitter:url", url);
  nextHtml = upsertMetaProperty(nextHtml, "twitter:title", title);
  nextHtml = upsertMetaProperty(
    nextHtml,
    "twitter:description",
    description
  );
  nextHtml = upsertMetaProperty(nextHtml, "twitter:image", image);
  nextHtml = upsertCanonical(nextHtml, url);

  return nextHtml;
}

module.exports = {
  getPublicShareMetaForPath,
  injectPublicShareMeta,
  getPublicShareRoute,
};
