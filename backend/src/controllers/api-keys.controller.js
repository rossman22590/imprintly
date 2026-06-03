const {
  createUserApiKey,
  listUserApiKeys,
  renameUserApiKey,
  revokeUserApiKey,
} = require("../utils/api-key.service");

async function listApiKeys(req, res) {
  try {
    const apiKeys = await listUserApiKeys(req.user.id);

    return res.status(200).json({
      message: "API keys retrieved.",
      apiKeys,
    });
  } catch (error) {
    console.error("Error listing API keys:", error);

    return res.status(500).json({ error: "Internal Server Error!" });
  }
}

async function createApiKey(req, res) {
  try {
    const result = await createUserApiKey({
      userId: req.user.id,
      name: req.body?.name,
    });

    return res.status(201).json({
      message: "API key created. Copy it now; it will not be shown again.",
      apiKey: result.apiKey,
      key: result.key,
    });
  } catch (error) {
    console.error("Error creating API key:", error);

    return res
      .status(error.name === "ValidationError" ? 400 : 500)
      .json({ error: error.message || "Internal Server Error!" });
  }
}

async function renameApiKey(req, res) {
  try {
    const apiKey = await renameUserApiKey({
      userId: req.user.id,
      apiKeyId: req.params.apiKeyId,
      name: req.body?.name,
    });

    if (!apiKey) {
      return res.status(404).json({ error: "API key not found." });
    }

    return res.status(200).json({
      message: "API key renamed.",
      apiKey,
    });
  } catch (error) {
    console.error("Error renaming API key:", error);

    if (error.name === "CastError") {
      return res.status(400).json({ error: "Invalid API key ID." });
    }

    return res
      .status(error.name === "ValidationError" ? 400 : 500)
      .json({ error: error.message || "Internal Server Error!" });
  }
}

async function revokeApiKey(req, res) {
  try {
    const apiKey = await revokeUserApiKey({
      userId: req.user.id,
      apiKeyId: req.params.apiKeyId,
    });

    if (!apiKey) {
      return res.status(404).json({ error: "API key not found." });
    }

    return res.status(200).json({
      message: "API key revoked.",
      apiKey,
    });
  } catch (error) {
    console.error("Error revoking API key:", error);

    if (error.name === "CastError") {
      return res.status(400).json({ error: "Invalid API key ID." });
    }

    return res.status(500).json({ error: "Internal Server Error!" });
  }
}

module.exports = {
  createApiKey,
  listApiKeys,
  renameApiKey,
  revokeApiKey,
};
