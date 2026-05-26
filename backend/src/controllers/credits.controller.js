const {
  getCreditSummary,
  serializeTransaction,
} = require("../utils/credits.service");

async function getCredits(req, res) {
  try {
    const summary = await getCreditSummary(req.user.id, req.query.limit);

    return res.status(200).json({
      message: "Credit summary retrieved.",
      credits: summary.credits,
      transactions: summary.transactions.map(serializeTransaction),
    });
  } catch (error) {
    console.error("Error getting credit summary:", error);

    return res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Internal Server Error!" });
  }
}

module.exports = { getCredits };
