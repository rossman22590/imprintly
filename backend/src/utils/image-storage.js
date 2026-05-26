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

async function uploadImageBufferToStorage({
  buffer,
  fileName = "",
  mimeType = "image/png",
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
    error.statusCode = 502;
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
};
