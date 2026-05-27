const apiKeyService = require("../utils/api-key.service");

function getBearerApiKey(req) {
  const authHeader = String(req.headers.authorization || "").trim();

  if (!authHeader) return "";

  const [scheme, token, extra] = authHeader.split(/\s+/);

  if (extra || scheme?.toLowerCase() !== "bearer") return "";

  return token || "";
}

async function authenticateApiKey(req, res, next) {
  const token = getBearerApiKey(req);

  if (!token) {
    return res.status(401).json({ error: "API key required." });
  }

  try {
    const apiKey = await apiKeyService.authenticateApiKeySecret(token);

    if (!apiKey) {
      return res.status(401).json({ error: "Invalid API key." });
    }

    req.user = { id: apiKey.userId.toString() };
    req.apiKey = {
      id: apiKey._id.toString(),
      name: apiKey.name,
    };

    return next();
  } catch (error) {
    console.error("Error authenticating API key:", error);

    return res.status(500).json({ error: "Internal Server Error!" });
  }
}

module.exports = {
  authenticateApiKey,
  getBearerApiKey,
};
