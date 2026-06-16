const DEFAULT_SHARE_IMAGE = "/images/og-share.png";
const DEFAULT_SITE_NAME = "Bookify";
const DEFAULT_SITE_PUBLISHER = "TSI · AI Tutor Suite";
const DEFAULT_SITE_AUTHOR = "TSI";
const DEFAULT_SITE_DESCRIPTION =
  "From quick notes to fully published novels and audiobooks. Created by TSI as part of the AI Tutor Suite.";
const TWITTER_SITE = "@myaitutor";

export function compactMetaText(value = "", maxLength = 180) {
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

export function absoluteShareUrl(url = "") {
  const value = String(url || "").trim();

  if (!value) return "";

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (typeof window === "undefined") return value;

  return value.startsWith("/")
    ? `${window.location.origin}${value}`
    : `${window.location.origin}/${value}`;
}

function setMetaAttribute(attribute, key, content) {
  if (typeof document === "undefined") return;

  let element = document.head.querySelector(`meta[${attribute}="${key}"]`);

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }

  element.setAttribute("content", content);
}

function setCanonical(href) {
  if (typeof document === "undefined") return;

  let element = document.head.querySelector('link[rel="canonical"]');

  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", "canonical");
    document.head.appendChild(element);
  }

  element.setAttribute("href", href);
}

export function applyShareMeta({
  title,
  description,
  image,
  url,
  author,
  type = "website",
  siteName = DEFAULT_SITE_PUBLISHER,
}) {
  if (typeof document === "undefined") return;

  const pageTitle = compactMetaText(title, 80) || DEFAULT_SITE_NAME;
  const pageDescription =
    compactMetaText(description, 180) || DEFAULT_SITE_DESCRIPTION;
  const pageUrl =
    url || (typeof window !== "undefined" ? window.location.href : "");
  const pageImage = absoluteShareUrl(image || DEFAULT_SHARE_IMAGE);

  document.title = pageTitle;
  setMetaAttribute("name", "title", pageTitle);
  setMetaAttribute("name", "description", pageDescription);
  setMetaAttribute("name", "author", author || DEFAULT_SITE_AUTHOR);
  setMetaAttribute("property", "og:type", type);
  setMetaAttribute("property", "og:url", pageUrl);
  setMetaAttribute("property", "og:title", pageTitle);
  setMetaAttribute("property", "og:description", pageDescription);
  setMetaAttribute("property", "og:image", pageImage);
  setMetaAttribute("property", "og:image:alt", pageTitle);
  setMetaAttribute("property", "og:site_name", siteName);
  setMetaAttribute("property", "twitter:card", "summary_large_image");
  setMetaAttribute("property", "twitter:site", TWITTER_SITE);
  setMetaAttribute("property", "twitter:creator", TWITTER_SITE);
  setMetaAttribute("property", "twitter:url", pageUrl);
  setMetaAttribute("property", "twitter:title", pageTitle);
  setMetaAttribute("property", "twitter:description", pageDescription);
  setMetaAttribute("property", "twitter:image", pageImage);
  setCanonical(pageUrl);
}

export function getOwnerShareImage(owner = {}, fallback = "") {
  return (
    owner.publicShareImageUrl ||
    fallback ||
    owner.shelfPhotoUrl ||
    owner.avatar ||
    DEFAULT_SHARE_IMAGE
  );
}
