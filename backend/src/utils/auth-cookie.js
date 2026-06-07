const crypto = require("crypto");
const ENV = require("../configs/env");

const AUTH_COOKIE_NAME = "imprintly_auth";
const CSRF_COOKIE_NAME = "imprintly_csrf";
const CSRF_HEADER_NAME = "x-csrf-token";
const AUTH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function getAuthCookieOptions() {
  const isProduction = ENV.NODE_ENV === "production";

  return {
    httpOnly: true,
    maxAge: AUTH_COOKIE_MAX_AGE_MS,
    path: "/",
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
  };
}

function getCsrfCookieOptions() {
  const { httpOnly, ...options } = getAuthCookieOptions();

  return options;
}

function getClearAuthCookieOptions() {
  const { maxAge, ...options } = getAuthCookieOptions();

  return options;
}

function parseCookieHeader(header = "") {
  return String(header || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separatorIndex = part.indexOf("=");

      if (separatorIndex < 0) return cookies;

      const key = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();

      if (!key) return cookies;

      try {
        cookies[key] = decodeURIComponent(value);
      } catch {
        cookies[key] = value;
      }

      return cookies;
    }, {});
}

function getAuthTokenFromRequest(req) {
  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith("Bearer ")) {
    return {
      source: "authorization",
      token: authHeader.split(" ").at(1),
    };
  }

  const cookies = parseCookieHeader(req.headers.cookie);
  const token = cookies[AUTH_COOKIE_NAME];

  return token ? { source: "cookie", token } : { source: "", token: "" };
}

function getCsrfTokensFromRequest(req) {
  const cookies = parseCookieHeader(req.headers.cookie);

  return {
    cookie: cookies[CSRF_COOKIE_NAME] || "",
    header: String(req.get(CSRF_HEADER_NAME) || ""),
  };
}

function setAuthCookie(res, token) {
  const csrfToken = crypto.randomBytes(32).toString("hex");

  res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
  res.cookie(CSRF_COOKIE_NAME, csrfToken, getCsrfCookieOptions());
}

function clearAuthCookie(res) {
  res.clearCookie(AUTH_COOKIE_NAME, getClearAuthCookieOptions());
  res.clearCookie(CSRF_COOKIE_NAME, getClearAuthCookieOptions());
}

module.exports = {
  clearAuthCookie,
  getAuthTokenFromRequest,
  getCsrfTokensFromRequest,
  setAuthCookie,
};
