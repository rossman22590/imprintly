const crypto = require("crypto");
const ENV = require("../configs/env");
const { getGeminiClient, normalizeGeminiStats } = require("./gemini.generator");
const { uploadImageBufferToStorage } = require("./image-storage");

const DEFAULT_IMAGE_MODEL = "gemini-3.1-flash-image-preview";
const IMAGE_MODELS = new Set([
  "gemini-3.1-flash-image-preview",
  "gemini-3-pro-image-preview",
  "gemini-2.5-flash-image",
]);
const ASPECT_RATIOS = new Set([
  "1:1",
  "1:4",
  "1:8",
  "2:3",
  "3:2",
  "3:4",
  "4:1",
  "4:3",
  "4:5",
  "5:4",
  "8:1",
  "9:16",
  "16:9",
  "21:9",
]);
const IMAGE_SIZES = new Set(["512", "1K", "2K", "4K"]);
const EXTENSIONS_BY_MIME = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function normalizeImageModel(model = "") {
  const selected = String(model || ENV.GEMINI_IMAGE_MODEL || DEFAULT_IMAGE_MODEL)
    .trim()
    .toLowerCase();

  return IMAGE_MODELS.has(selected) ? selected : DEFAULT_IMAGE_MODEL;
}

function normalizeAspectRatio(value = "", fallback = "1:1") {
  const selected = String(value || fallback).trim();

  return ASPECT_RATIOS.has(selected) ? selected : fallback;
}

function normalizeImageSize(value = "") {
  const selected = String(value || ENV.GEMINI_IMAGE_SIZE || "1K").trim();

  return IMAGE_SIZES.has(selected) ? selected : "1K";
}

function extractResponseParts(response) {
  return response?.candidates?.[0]?.content?.parts || response?.parts || [];
}

function getInlineData(part) {
  return part?.inlineData || part?.inline_data || null;
}

function getTextResponse(parts) {
  return parts
    .filter((part) => !part.thought && part.text)
    .map((part) => part.text.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

async function storeGeneratedImage({ data, mimeType }) {
  const extension = EXTENSIONS_BY_MIME[mimeType] || "png";
  const filename = `ai-image-${Date.now()}-${crypto.randomUUID()}.${extension}`;

  return uploadImageBufferToStorage({
    buffer: Buffer.from(data, "base64"),
    fileName: filename,
    mimeType,
  });
}

async function generateGeminiImage({
  prompt,
  model,
  aspectRatio = "1:1",
  imageSize,
}) {
  const selectedModel = normalizeImageModel(model);
  const selectedAspectRatio = normalizeAspectRatio(aspectRatio);
  const selectedImageSize = normalizeImageSize(imageSize);
  const imageConfig = {
    aspectRatio: selectedAspectRatio,
  };

  if (selectedModel !== "gemini-2.5-flash-image") {
    imageConfig.imageSize = selectedImageSize;
  }

  const response = await getGeminiClient().models.generateContent({
    model: selectedModel,
    contents: prompt,
    config: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig,
    },
  });
  const parts = extractResponseParts(response);
  const imagePart = parts.find(
    (part) => !part.thought && getInlineData(part)?.data
  );
  const text = getTextResponse(parts);

  if (!imagePart) {
    const error = new Error(
      text
        ? `Gemini did not return an image. Response: ${text.slice(0, 300)}`
        : "Gemini did not return an image."
    );
    error.statusCode = 502;
    throw error;
  }

  const inlineData = getInlineData(imagePart);
  const mimeType = inlineData.mimeType || inlineData.mime_type || "image/png";
  const url = await storeGeneratedImage({
    data: inlineData.data,
    mimeType,
  });

  return {
    url,
    mimeType,
    model: selectedModel,
    prompt,
    text,
    aspectRatio: selectedAspectRatio,
    imageSize:
      selectedModel === "gemini-2.5-flash-image" ? "" : selectedImageSize,
    synthIdWatermark: true,
    stats: normalizeGeminiStats(response, selectedModel),
  };
}

module.exports = {
  generateGeminiImage,
  normalizeAspectRatio,
  normalizeImageModel,
  normalizeImageSize,
};
