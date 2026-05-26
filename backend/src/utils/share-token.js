const crypto = require("crypto");

function generateShareToken(prefix = "share") {
  const randomPart = crypto.randomBytes(16).toString("base64url");

  return `${prefix}_${randomPart}`;
}

module.exports = {
  generateShareToken,
};
