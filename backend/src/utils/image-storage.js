const fs = require("fs");
const path = require("path");
const ENV = require("../configs/env");

function getTrustedImageHosts() {
  return new Set(
    String(ENV.TRUSTED_IMAGE_HOSTS || "")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean)
  );
}

function isTrustedImageUrl(value = "") {
  if (typeof value !== "string") return false;

  try {
    const parsed = new URL(value.trim());

    return (
      parsed.protocol === "https:" &&
      getTrustedImageHosts().has(parsed.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}

function normalizeTrustedImageUrl(value = "") {
  if (!isTrustedImageUrl(value)) return "";

  const parsed = new URL(String(value).trim());
  parsed.hash = "";

  return parsed.toString();
}

function getExtensionFromMime(mimeType = "") {
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/gif") return "gif";

  return "png";
}

function sleep(ms = 0) {
  if (!ms) return Promise.resolve();

  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetryUploadError(error = {}) {
  const statusCode = Number(error.statusCode || 0);

  return (
    !statusCode ||
    statusCode === 408 ||
    statusCode === 429 ||
    (statusCode >= 500 && statusCode <= 599)
  );
}

async function uploadImageBufferToStorage({
  buffer,
  fileName = "",
  mimeType = "image/png",
  maxAttempts = 3,
  retryDelayMs = 700,
}) {
  if (!ENV.IMAGE_UPLOAD_API_URL) {
    const error = new Error("Image upload API is not configured.");
    error.statusCode = 500;
    throw error;
  }

  const safeFileName =
    path
      .basename(fileName || "")
      .replace(/[^\w.\-]/g, "-")
      .slice(0, 180) ||
    `image-${Date.now()}.${getExtensionFromMime(mimeType)}`;
  const base64 = Buffer.isBuffer(buffer)
    ? buffer.toString("base64")
    : Buffer.from(buffer).toString("base64");

  let lastError = null;
  const attempts = Math.max(1, Number(maxAttempts) || 1);

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(ENV.IMAGE_UPLOAD_API_URL, {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          base64: `data:${mimeType};base64,${base64}`,
          fileName: safeFileName,
          fileType: mimeType,
        }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        const error = new Error(
          `Image upload failed with ${response.status}: ${text.slice(0, 300)}`
        );
        error.statusCode = response.status;
        throw error;
      }

      const payload = await response.json();
      const publicURL = normalizeTrustedImageUrl(payload.publicURL || "");

      if (!publicURL) {
        const error = new Error("Image upload API did not return a trusted URL.");
        error.statusCode = 502;
        throw error;
      }

      return publicURL;
    } catch (error) {
      lastError = error;

      if (attempt >= attempts || !shouldRetryUploadError(error)) {
        break;
      }

      await sleep(retryDelayMs * attempt);
    }
  }

  const finalError = new Error(
    `${lastError?.message || "Image upload failed."} Retried ${attempts} time${
      attempts === 1 ? "" : "s"
    }.`
  );
  finalError.statusCode = lastError?.statusCode === 400 ? 400 : 502;
  throw finalError;
}

function assertImportableImageUrl(value = "") {
  const rawUrl = String(value || "").trim();

  if (!rawUrl) {
    const error = new Error("Image URL is required.");
    error.statusCode = 400;
    throw error;
  }

  let parsed;

  try {
    parsed = new URL(rawUrl);
  } catch {
    const error = new Error("Image URL is invalid.");
    error.statusCode = 400;
    throw error;
  }

  if (parsed.protocol !== "https:") {
    const error = new Error("Image URL must use HTTPS.");
    error.statusCode = 400;
    throw error;
  }

  const hostname = parsed.hostname.toLowerCase();

  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".local")
  ) {
    const error = new Error("Local image URLs cannot be imported.");
    error.statusCode = 400;
    throw error;
  }

  return parsed.toString();
}

async function uploadImageUrlToStorage(url = "", fileName = "") {
  const sourceUrl = assertImportableImageUrl(url);
  const trustedUrl = normalizeTrustedImageUrl(sourceUrl);

  if (trustedUrl) {
    return trustedUrl;
  }

  const response = await fetch(sourceUrl, {
    headers: {
      accept: "image/*",
      "user-agent": "Bookify/1.0",
    },
  });

  if (!response.ok) {
    const error = new Error(`Image URL could not be fetched (${response.status}).`);
    error.statusCode = 400;
    throw error;
  }

  const mimeType = String(response.headers.get("content-type") || "")
    .split(";")[0]
    .trim()
    .toLowerCase();

  if (!["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"].includes(mimeType)) {
    const error = new Error("URL must point directly to a JPEG, PNG, WebP, or GIF image.");
    error.statusCode = 400;
    throw error;
  }

  const contentLength = Number(response.headers.get("content-length") || 0);
  const maxBytes = 8 * 1024 * 1024;

  if (contentLength > maxBytes) {
    const error = new Error("Reference image must be 8MB or smaller.");
    error.statusCode = 400;
    throw error;
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  if (buffer.length > maxBytes) {
    const error = new Error("Reference image must be 8MB or smaller.");
    error.statusCode = 400;
    throw error;
  }

  return uploadImageBufferToStorage({
    buffer,
    fileName: fileName || `reference-${Date.now()}.${getExtensionFromMime(mimeType)}`,
    mimeType,
  });
}

async function uploadImageFileToStorage(filePath, fileName, mimeType) {
  return uploadImageBufferToStorage({
    buffer: await fs.promises.readFile(filePath),
    fileName,
    mimeType,
  });
}

module.exports = {
  isTrustedImageUrl,
  normalizeTrustedImageUrl,
  uploadImageBufferToStorage,
  uploadImageFileToStorage,
  uploadImageUrlToStorage,
  shouldRetryUploadError,
};
