const assert = require("node:assert/strict");
const test = require("node:test");
const {
  API_KEY_PREFIX,
  LAST_USED_UPDATE_INTERVAL_MS,
  createApiKeySecret,
  getApiKeyHashCandidates,
  getApiKeyDisplayParts,
  hashApiKey,
  isValidApiKeySecret,
  markApiKeyUsed,
  normalizeApiKeyName,
  serializeApiKey,
  shouldUpdateLastUsedAt,
} = require("./api-key.service");

test("generates valid API key secrets with the public prefix", () => {
  const secret = createApiKeySecret();

  assert.equal(secret.startsWith(API_KEY_PREFIX), true);
  assert.equal(secret.startsWith("book_sk_"), true);
  assert.equal(isValidApiKeySecret(secret), true);
});

test("accepts book secret keys and rejects old key prefixes", () => {
  const secretBody = "a".repeat(43);

  assert.equal(isValidApiKeySecret(`book_sk_${secretBody}`), true);
  assert.equal(isValidApiKeySecret(`book_${secretBody}`), false);
  assert.equal(isValidApiKeySecret(`imply_sk_${secretBody}`), false);
});

test("hashes API keys without preserving the raw secret", () => {
  const secret = createApiKeySecret();
  const hash = hashApiKey(secret);

  assert.equal(hash.length, 64);
  assert.notEqual(hash, secret);
  assert.equal(hashApiKey(secret), hash);
});

test("hashes API keys with a dedicated secret when provided", () => {
  const secret = createApiKeySecret();

  assert.notEqual(hashApiKey(secret, "secret-one"), hashApiKey(secret, "secret-two"));
});

test("includes legacy hash candidates while migrating configured keys", () => {
  const ENV = require("../configs/env");
  const originalApiSecret = ENV.API_KEY_HASH_SECRET;
  const originalJwtSecret = ENV.JWT_SECRET_KEY;
  const secret = createApiKeySecret();

  ENV.API_KEY_HASH_SECRET = "new-api-key-secret";
  ENV.JWT_SECRET_KEY = "old-jwt-secret";

  try {
    const candidates = getApiKeyHashCandidates(secret);

    assert.deepEqual(candidates, [
      hashApiKey(secret, "new-api-key-secret"),
      hashApiKey(secret, "old-jwt-secret"),
    ]);
  } finally {
    ENV.API_KEY_HASH_SECRET = originalApiSecret;
    ENV.JWT_SECRET_KEY = originalJwtSecret;
  }
});

test("serializes API keys with only safe display fields", () => {
  const secret = createApiKeySecret();
  const display = getApiKeyDisplayParts(secret);
  const createdAt = new Date("2026-01-02T00:00:00.000Z");
  const serialized = serializeApiKey({
    _id: "key_1",
    name: "Zapier",
    keyHash: hashApiKey(secret),
    prefix: display.prefix,
    last4: display.last4,
    lastUsedAt: null,
    revokedAt: null,
    createdAt,
    updatedAt: createdAt,
  });

  assert.equal(serialized.name, "Zapier");
  assert.equal(serialized.maskedKey, `${API_KEY_PREFIX}...${secret.slice(-4)}`);
  assert.equal(Object.hasOwn(serialized, "keyHash"), false);
  assert.equal(Object.hasOwn(serialized, "key"), false);
});

test("normalizes API key names", () => {
  assert.equal(normalizeApiKeyName("  My   App  "), "My App");
  assert.equal(normalizeApiKeyName(""), "API key");
  assert.equal(normalizeApiKeyName("x".repeat(100)).length, 80);
});

test("marks API keys as used without validation", async () => {
  const usedAt = new Date("2026-03-04T05:06:07.000Z");
  const calls = [];
  const apiKey = {
    lastUsedAt: null,
    save(options) {
      calls.push(options);
      return Promise.resolve(this);
    },
  };

  await markApiKeyUsed(apiKey, usedAt);

  assert.equal(apiKey.lastUsedAt, usedAt);
  assert.deepEqual(calls, [{ validateBeforeSave: false }]);
});

test("throttles recent API key last-used writes", async () => {
  const now = new Date("2026-03-04T05:06:07.000Z");
  const recent = new Date(now.getTime() - LAST_USED_UPDATE_INTERVAL_MS + 1000);
  const stale = new Date(now.getTime() - LAST_USED_UPDATE_INTERVAL_MS - 1000);
  const calls = [];
  const apiKey = {
    lastUsedAt: recent,
    save(options) {
      calls.push(options);
      return Promise.resolve(this);
    },
  };

  assert.equal(shouldUpdateLastUsedAt({ lastUsedAt: recent }, now), false);
  assert.equal(shouldUpdateLastUsedAt({ lastUsedAt: stale }, now), true);

  await markApiKeyUsed(apiKey, now);

  assert.equal(apiKey.lastUsedAt, recent);
  assert.equal(calls.length, 0);

  await markApiKeyUsed(apiKey, now, { force: true });

  assert.equal(apiKey.lastUsedAt, now);
  assert.deepEqual(calls, [{ validateBeforeSave: false }]);
});
