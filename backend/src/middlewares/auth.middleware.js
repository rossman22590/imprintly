const jwt = require("jsonwebtoken");
const ENV = require("../configs/env");
const {
  getAuthTokenFromRequest,
  getCsrfTokensFromRequest,
  setAuthCookie,
} = require("../utils/auth-cookie");

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

async function authenticate(req, res, next) {
  const { source, token } = getAuthTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({ error: "No token provided!" });
  }

  try {
    const decoded = jwt.verify(token, ENV.JWT_SECRET_KEY);
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

    next(); // token valid, proceed to route
  } catch (error) {
    console.error("Error authenticating user:", error);

    return res.status(401).json({ error: "Invalid or expired token!" });
  }
}

module.exports = { authenticate };
