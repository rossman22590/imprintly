const assert = require("node:assert/strict");
const test = require("node:test");
const {
  getAuthTokenFromRequest,
  getCsrfTokensFromRequest,
} = require("./auth-cookie");

function mockRequest({ authorization = "", cookie = "", csrf = "" } = {}) {
  return {
    get(name) {
      return name.toLowerCase() === "x-csrf-token" ? csrf : "";
    },
    headers: {
      authorization,
      cookie,
    },
  };
}

test("auth token prefers bearer authorization over auth cookie", () => {
  const result = getAuthTokenFromRequest(
    mockRequest({
      authorization: "Bearer bearer-token",
      cookie: "imprintly_auth=cookie-token",
    })
  );

  assert.deepEqual(result, {
    source: "authorization",
    token: "bearer-token",
  });
});

test("auth token falls back to http cookie", () => {
  const result = getAuthTokenFromRequest(
    mockRequest({ cookie: "other=value; imprintly_auth=cookie-token" })
  );

  assert.deepEqual(result, {
    source: "cookie",
    token: "cookie-token",
  });
});

test("csrf tokens read from matching cookie and header", () => {
  const result = getCsrfTokensFromRequest(
    mockRequest({
      cookie: "imprintly_csrf=csrf-token",
      csrf: "csrf-token",
    })
  );

  assert.deepEqual(result, {
    cookie: "csrf-token",
    header: "csrf-token",
  });
});
