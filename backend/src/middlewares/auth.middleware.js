const jwt = require("jsonwebtoken");
const ENV = require("../configs/env");
const User = require("../models/User");

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided!" });
  }

  const token = authHeader.split(" ").at(1);

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
    next(); // token valid, proceed to route
  } catch (error) {
    console.error("Error authenticating user:", error);

    return res.status(401).json({ error: "Invalid or expired token!" });
  }
}

module.exports = { authenticate };
