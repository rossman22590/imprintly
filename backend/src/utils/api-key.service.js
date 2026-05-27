const crypto = require("crypto");
const ENV = require("../configs/env");
const ApiKey = require("../models/ApiKey");

const API_KEY_PREFIX = "book_sk_";
const API_KEY_RANDOM_BYTES = 32;
const API_KEY_SECRET_PATTERN = /^book_sk_[A-Za-z0-9_-]{43}$/;

function normalizeApiKeyName(name = "") {
  const normalized = String(name || "").trim().replace(/\s+/g, " ");

  return normalized.slice(0, 80) || "API key";
}

function createApiKeySecret() {
  return `${API_KEY_PREFIX}${crypto
    .randomBytes(API_KEY_RANDOM_BYTES)
    .toString("base64url")}`;
}

function isValidApiKeySecret(secret = "") {
  return API_KEY_SECRET_PATTERN.test(String(secret || ""));
}

function hashApiKey(secret = "") {
  return crypto
    .createHmac("sha256", ENV.JWT_SECRET_KEY || "imprintly-dev-api-keys")
    .update(String(secret))
    .digest("hex");
}

function getApiKeyDisplayParts(secret = "") {
  return {
    prefix: API_KEY_PREFIX,
    last4: String(secret).slice(-4),
  };
}

function serializeApiKey(apiKey) {
  if (!apiKey) return null;

  const value =
    typeof apiKey.toObject === "function"
      ? apiKey.toObject({ depopulate: true })
      : apiKey;

  return {
    id: value._id?.toString?.() || value.id || "",
    name: value.name || "",
    prefix: value.prefix || API_KEY_PREFIX,
    last4: value.last4 || "",
    maskedKey: `${value.prefix || API_KEY_PREFIX}...${value.last4 || ""}`,
    lastUsedAt: value.lastUsedAt || null,
    revokedAt: value.revokedAt || null,
    createdAt: value.createdAt || null,
    updatedAt: value.updatedAt || null,
  };
}

async function listUserApiKeys(userId) {
  const apiKeys = await ApiKey.find({
    userId,
    revokedAt: null,
  }).sort({ createdAt: -1 });

  return apiKeys.map(serializeApiKey);
}

async function createUserApiKey({ userId, name }) {
  const secret = createApiKeySecret();
  const display = getApiKeyDisplayParts(secret);
  const apiKey = await ApiKey.create({
    userId,
    name: normalizeApiKeyName(name),
    keyHash: hashApiKey(secret),
    prefix: display.prefix,
    last4: display.last4,
  });

  return {
    apiKey: serializeApiKey(apiKey),
    key: secret,
  };
}

async function renameUserApiKey({ userId, apiKeyId, name }) {
  const apiKey = await ApiKey.findOneAndUpdate(
    {
      _id: apiKeyId,
      userId,
      revokedAt: null,
    },
    {
      $set: {
        name: normalizeApiKeyName(name),
      },
    },
    {
      new: true,
      runValidators: true,
    }
  );

  return serializeApiKey(apiKey);
}

async function revokeUserApiKey({ userId, apiKeyId }) {
  const apiKey = await ApiKey.findOneAndUpdate(
    {
      _id: apiKeyId,
      userId,
      revokedAt: null,
    },
    {
      $set: {
        revokedAt: new Date(),
      },
    },
    {
      new: true,
    }
  );

  return serializeApiKey(apiKey);
}

async function markApiKeyUsed(apiKey, now = new Date()) {
  apiKey.lastUsedAt = now;
  await apiKey.save({ validateBeforeSave: false });

  return apiKey;
}

async function authenticateApiKeySecret(secret = "") {
  if (!isValidApiKeySecret(secret)) return null;

  const apiKey = await ApiKey.findOne({
    keyHash: hashApiKey(secret),
    revokedAt: null,
  }).select("+keyHash");

  if (!apiKey) return null;

  await markApiKeyUsed(apiKey);

  return apiKey;
}

module.exports = {
  API_KEY_PREFIX,
  authenticateApiKeySecret,
  createApiKeySecret,
  createUserApiKey,
  getApiKeyDisplayParts,
  hashApiKey,
  isValidApiKeySecret,
  listUserApiKeys,
  markApiKeyUsed,
  normalizeApiKeyName,
  renameUserApiKey,
  revokeUserApiKey,
  serializeApiKey,
};
