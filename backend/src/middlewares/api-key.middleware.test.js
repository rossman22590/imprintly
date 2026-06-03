const assert = require("node:assert/strict");
const test = require("node:test");
const User = require("../models/User");
const apiKeyService = require("../utils/api-key.service");
const {
  authenticateApiKey,
  getBearerApiKey,
} = require("./api-key.middleware");

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

test("extracts bearer API keys from authorization headers", () => {
  assert.equal(getBearerApiKey({ headers: {} }), "");
  assert.equal(
    getBearerApiKey({ headers: { authorization: "Bearer book_sk_token" } }),
    "book_sk_token"
  );
  assert.equal(
    getBearerApiKey({ headers: { authorization: "Basic book_sk_token" } }),
    ""
  );
  assert.equal(
    getBearerApiKey({ headers: { authorization: "Bearer a b" } }),
    ""
  );
});

test("rejects missing API keys", async () => {
  const req = { headers: {} };
  const res = createResponse();
  let nextCalled = false;

  await authenticateApiKey(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, "API key required.");
});

test("rejects invalid or revoked API keys", async () => {
  const original = apiKeyService.authenticateApiKeySecret;
  apiKeyService.authenticateApiKeySecret = async () => null;

  try {
    const req = { headers: { authorization: "Bearer book_sk_bad" } };
    const res = createResponse();
    let nextCalled = false;

    await authenticateApiKey(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, "Invalid API key.");
  } finally {
    apiKeyService.authenticateApiKeySecret = original;
  }
});

test("sets request user and API key context for valid keys", async () => {
  const original = apiKeyService.authenticateApiKeySecret;
  apiKeyService.authenticateApiKeySecret = async () => ({
    _id: { toString: () => "api_key_123" },
    userId: { toString: () => "user_123" },
    name: "Zapier",
  });
  const userFindById = test.mock.method(User, "findById", () => ({
    select: async () => ({ status: "active" }),
  }));

  try {
    const req = { headers: { authorization: "Bearer book_sk_good" } };
    const res = createResponse();
    let nextCalled = false;

    await authenticateApiKey(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.deepEqual(req.user, { id: "user_123" });
    assert.deepEqual(req.apiKey, { id: "api_key_123", name: "Zapier" });
    assert.equal(userFindById.mock.callCount(), 1);
  } finally {
    apiKeyService.authenticateApiKeySecret = original;
  }
});

test("rejects API keys for missing users", async () => {
  const original = apiKeyService.authenticateApiKeySecret;
  apiKeyService.authenticateApiKeySecret = async () => ({
    _id: { toString: () => "api_key_123" },
    userId: { toString: () => "missing_user" },
    name: "Zapier",
  });
  test.mock.method(User, "findById", () => ({
    select: async () => null,
  }));

  try {
    const req = { headers: { authorization: "Bearer book_sk_good" } };
    const res = createResponse();
    let nextCalled = false;

    await authenticateApiKey(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, "Invalid API key.");
  } finally {
    apiKeyService.authenticateApiKeySecret = original;
  }
});

test("rejects API keys for banned users", async () => {
  const original = apiKeyService.authenticateApiKeySecret;
  apiKeyService.authenticateApiKeySecret = async () => ({
    _id: { toString: () => "api_key_123" },
    userId: { toString: () => "banned_user" },
    name: "Zapier",
  });
  test.mock.method(User, "findById", () => ({
    select: async () => ({ status: "banned" }),
  }));

  try {
    const req = { headers: { authorization: "Bearer book_sk_good" } };
    const res = createResponse();
    let nextCalled = false;

    await authenticateApiKey(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error, "This account has been banned.");
  } finally {
    apiKeyService.authenticateApiKeySecret = original;
  }
});
