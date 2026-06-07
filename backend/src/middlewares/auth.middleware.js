const jwt = require("jsonwebtoken");
const ENV = require("../configs/env");
const {
  getAuthTokenFromRequest,
  getCsrfTokensFromRequest,
  setAuthCookie,
} = require("../utils/auth-cookie");
const User = require("../models/User");

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

async function authenticate(req, res, next) {
  const { source, token } = getAuthTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({ error: "No token provided!" });
  }

  try {
    const decoded = jwt.verify(token, ENV.JWT_SECRET_KEY);
    const user = await User.findById(decoded.id).select("status");

    if (!user) {
      return res.status(401).json({ error: "Invalid or expired token!" });
    }

    if (user.status === "banned") {
      return res.status(403).json({ error: "This account has been banned." });
    }

    req.user = { id: decoded.id };

    if (source === "cookie" && !SAFE_METHODS.has(req.method)) {
      const csrf = getCsrfTokensFromRequest(req);

      if (!csrf.cookie || csrf.cookie !== csrf.header) {
        return res.status(403).json({ error: "Invalid CSRF token." });
      }
    }

    if (source === "authorization" || !getCsrfTokensFromRequest(req).cookie) {
      setAuthCookie(res, token);
    }

    // Let the frontend cache the token in localStorage so it can use Bearer auth
    // (which bypasses CSRF). Safe to expose — it's the same token the client sent.
    if (source === "cookie") {
      res.setHeader("X-Auth-Token", token);
    }

    next(); // token valid, proceed to route
  } catch (error) {
    console.error("Error authenticating user:", error);

    return res.status(401).json({ error: "Invalid or expired token!" });
  }
}

module.exports = { authenticate };
