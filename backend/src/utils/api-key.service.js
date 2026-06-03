const crypto = require("crypto");
const ENV = require("../configs/env");
const ApiKey = require("../models/ApiKey");

const API_KEY_PREFIX = "book_sk_";
const API_KEY_RANDOM_BYTES = 32;
const API_KEY_SECRET_PATTERN = /^book_sk_[A-Za-z0-9_-]{43}$/;
const LAST_USED_UPDATE_INTERVAL_MS = 5 * 60 * 1000;

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

function getPrimaryApiKeyHashSecret() {
  if (ENV.API_KEY_HASH_SECRET) return ENV.API_KEY_HASH_SECRET;

  if (ENV.NODE_ENV === "production") {
    throw new Error("API_KEY_HASH_SECRET is not configured.");
  }

  return ENV.JWT_SECRET_KEY || "imprintly-dev-api-keys";
}

function hashApiKey(secret = "", hashSecret = getPrimaryApiKeyHashSecret()) {
  return crypto
    .createHmac("sha256", hashSecret)
    .update(String(secret))
    .digest("hex");
}

function getApiKeyHashCandidates(secret = "") {
  const primaryHash = hashApiKey(secret);
  const hashes = [primaryHash];

  if (ENV.API_KEY_HASH_SECRET && ENV.JWT_SECRET_KEY) {
    const legacyHash = hashApiKey(secret, ENV.JWT_SECRET_KEY);

    if (legacyHash !== primaryHash) {
      hashes.push(legacyHash);
    }
  }

  return hashes;
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

function shouldUpdateLastUsedAt(apiKey, now = new Date()) {
  if (!apiKey?.lastUsedAt) return true;

  return now.getTime() - new Date(apiKey.lastUsedAt).getTime() >=
    LAST_USED_UPDATE_INTERVAL_MS;
}

async function markApiKeyUsed(apiKey, now = new Date(), options = {}) {
  if (!options.force && !shouldUpdateLastUsedAt(apiKey, now)) {
    return apiKey;
  }

  apiKey.lastUsedAt = now;
  await apiKey.save({ validateBeforeSave: false });

  return apiKey;
}

async function authenticateApiKeySecret(secret = "") {
  if (!isValidApiKeySecret(secret)) return null;

  const hashes = getApiKeyHashCandidates(secret);
  const apiKey = await ApiKey.findOne({
    keyHash: { $in: hashes },
    revokedAt: null,
  }).select("+keyHash");

  if (!apiKey) return null;

  if (apiKey.keyHash !== hashes[0]) {
    apiKey.keyHash = hashes[0];
    await markApiKeyUsed(apiKey, new Date(), { force: true });
  } else {
    await markApiKeyUsed(apiKey);
  }

  return apiKey;
}

module.exports = {
  API_KEY_PREFIX,
  LAST_USED_UPDATE_INTERVAL_MS,
  authenticateApiKeySecret,
  createApiKeySecret,
  createUserApiKey,
  getApiKeyHashCandidates,
  getApiKeyDisplayParts,
  hashApiKey,
  isValidApiKeySecret,
  listUserApiKeys,
  markApiKeyUsed,
  normalizeApiKeyName,
  renameUserApiKey,
  revokeUserApiKey,
  serializeApiKey,
  shouldUpdateLastUsedAt,
};
