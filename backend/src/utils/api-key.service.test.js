const assert = require("node:assert/strict");
const test = require("node:test");
const {
  API_KEY_PREFIX,
  createApiKeySecret,
  getApiKeyDisplayParts,
  hashApiKey,
  isValidApiKeySecret,
  markApiKeyUsed,
  normalizeApiKeyName,
  serializeApiKey,
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
