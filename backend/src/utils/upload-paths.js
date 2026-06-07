const fs = require("fs");
const path = require("path");
const { normalizeTrustedImageUrl } = require("./image-storage");

const uploadsDirPath = path.resolve(__dirname, "../../uploads");
const uploadUrlPrefix = "/uploads/";
const allowedImageMimeTypes = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
]);

function normalizeUploadUrl(value = "") {
  if (typeof value !== "string") return "";

  const normalized = value.replace(/\\/g, "/").trim();

  if (!normalized.startsWith(uploadUrlPrefix)) {
    return "";
  }

  if (normalized.includes("..") || normalized.includes("\0")) {
    return "";
  }

  const basename = path.posix.basename(normalized);

  return basename ? `${uploadUrlPrefix}${basename}` : "";
}

function normalizeImageAssetUrl(value = "") {
  return normalizeUploadUrl(value) || normalizeTrustedImageUrl(value);
}

function resolveUploadFilePath(uploadUrl = "") {
  const safeUrl = normalizeUploadUrl(uploadUrl);

  if (!safeUrl) return "";

  const resolvedPath = path.resolve(
    uploadsDirPath,
    safeUrl.slice(uploadUrlPrefix.length)
  );

  if (!resolvedPath.startsWith(`${uploadsDirPath}${path.sep}`)) {
    return "";
  }

  return resolvedPath;
}

function deleteUploadFile(uploadUrl = "") {
  const filePath = resolveUploadFilePath(uploadUrl);

  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

function hasAllowedImageSignature(filePath, mimetype = "") {
  if (!allowedImageMimeTypes.has(mimetype)) {
    return false;
  }

  const buffer = fs.readFileSync(filePath);

  if (mimetype === "image/jpeg" || mimetype === "image/jpg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8;
  }

  if (mimetype === "image/png") {
    return (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }

  if (mimetype === "image/gif") {
    const signature = buffer.subarray(0, 6).toString("ascii");
    return signature === "GIF87a" || signature === "GIF89a";
  }

  if (mimetype === "image/webp") {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }

  return false;
}

function assertUploadedImageFile(file) {
  if (!file || !file.path || !hasAllowedImageSignature(file.path, file.mimetype)) {
    if (file?.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    const error = new Error("Uploaded file is not a valid image.");
    error.statusCode = 400;
    throw error;
  }
}

module.exports = {
  assertUploadedImageFile,
  deleteUploadFile,
  normalizeImageAssetUrl,
  normalizeUploadUrl,
  resolveUploadFilePath,
  uploadsDirPath,
};
