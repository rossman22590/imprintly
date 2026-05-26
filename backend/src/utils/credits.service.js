const ENV = require("../configs/env");
const CreditTransaction = require("../models/CreditTransaction");
const User = require("../models/User");

function numberFromEnv(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const CREDIT_CONFIG = {
  startingCredits: numberFromEnv(ENV.STARTING_CREDITS, 500),
  usdPerCredit: numberFromEnv(ENV.USD_PER_CREDIT, 0.001),
  imageCredits: numberFromEnv(ENV.AI_IMAGE_CREDITS, 10),
  tokenMarkupMultiplier: numberFromEnv(ENV.AI_TOKEN_MARKUP_MULTIPLIER, 1.3),
  inputUsdPerMillion: numberFromEnv(ENV.GEMINI_INPUT_USD_PER_MILLION, 1),
  outputUsdPerMillion: numberFromEnv(ENV.GEMINI_OUTPUT_USD_PER_MILLION, 1),
  fallbackUsdPerMillion: numberFromEnv(ENV.GEMINI_FALLBACK_USD_PER_MILLION, 1),
};

function roundMoney(value) {
  return Math.round(Number(value || 0) * 1_000_000) / 1_000_000;
}

function roundCredits(value) {
  const numeric = Number(value || 0);

  if (!Number.isFinite(numeric) || numeric <= 0) return 0;

  return Math.ceil(numeric * 10_000) / 10_000;
}

function serializeCredits(user) {
  const credits = user?.credits || {};

  return {
    balance: roundCredits(credits.balance),
    lifetimeGranted: roundCredits(credits.lifetimeGranted),
    lifetimeSpent: roundCredits(credits.lifetimeSpent),
    startingCredits: CREDIT_CONFIG.startingCredits,
    usdPerCredit: CREDIT_CONFIG.usdPerCredit,
    imageCredits: CREDIT_CONFIG.imageCredits,
    tokenMarkupMultiplier: CREDIT_CONFIG.tokenMarkupMultiplier,
    inputUsdPerMillion: CREDIT_CONFIG.inputUsdPerMillion,
    outputUsdPerMillion: CREDIT_CONFIG.outputUsdPerMillion,
  };
}

function serializeTransaction(transaction) {
  if (!transaction) return null;

  const value =
    typeof transaction.toObject === "function"
      ? transaction.toObject()
      : transaction;

  return {
    id: value._id?.toString?.() || value.id || "",
    type: value.type,
    amount: roundCredits(value.amount),
    balanceAfter: roundCredits(value.balanceAfter),
    reason: value.reason,
    description: value.description,
    provider: value.provider,
    model: value.model,
    usage: value.usage,
    usdCost: roundMoney(value.usdCost),
    creditRateUsd: value.creditRateUsd,
    markupMultiplier: value.markupMultiplier,
    metadata: value.metadata,
    createdAt: value.createdAt,
  };
}

function serializeBilling(result) {
  if (!result) return null;

  return {
    charge: result.charge || null,
    credits: result.credits || null,
    transaction: serializeTransaction(result.transaction),
  };
}

function buildInsufficientCreditsError(balance, required) {
  const error = new Error(
    `Not enough credits. Required ${roundCredits(required)} credits, available ${roundCredits(balance)}.`
  );
  error.statusCode = 402;
  error.code = "INSUFFICIENT_CREDITS";
  error.requiredCredits = roundCredits(required);
  error.balance = roundCredits(balance);
  return error;
}

async function ensureUserCredits(userId) {
  const user = await User.findById(userId);

  if (!user) {
    const error = new Error("User not found.");
    error.statusCode = 404;
    throw error;
  }

  const credits = user.credits || {};

  if (credits.ledgerInitialized) {
    return user;
  }

  const startingBalance =
    Number.isFinite(Number(credits.balance)) && Number(credits.balance) > 0
      ? Number(credits.balance)
      : CREDIT_CONFIG.startingCredits;

  user.credits = {
    balance: roundCredits(startingBalance),
    lifetimeGranted: roundCredits(startingBalance),
    lifetimeSpent: roundCredits(credits.lifetimeSpent || 0),
    ledgerInitialized: true,
    initializedAt: credits.initializedAt || new Date(),
  };

  await user.save({ validateBeforeSave: false });

  await CreditTransaction.create({
    userId,
    type: "grant",
    amount: roundCredits(startingBalance),
    balanceAfter: roundCredits(startingBalance),
    reason: "starting_credits",
    description: "Starting Bookify credits",
    creditRateUsd: CREDIT_CONFIG.usdPerCredit,
    markupMultiplier: 1,
  });

  return user;
}

async function getCreditSummary(userId, limit = 20) {
  const user = await ensureUserCredits(userId);
  const transactions = await CreditTransaction.find({ userId })
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(Number(limit) || 20, 1), 100))
    .lean();

  return {
    credits: serializeCredits(user),
    transactions,
  };
}

async function assertHasCredits(userId, amount) {
  const user = await ensureUserCredits(userId);
  const required = roundCredits(amount);
  const balance = roundCredits(user.credits?.balance);

  if (balance + 0.000001 < required) {
    throw buildInsufficientCreditsError(balance, required);
  }

  return user;
}

async function debitCredits({
  userId,
  amount,
  reason,
  description,
  provider,
  model,
  usage,
  usdCost = 0,
  markupMultiplier = CREDIT_CONFIG.tokenMarkupMultiplier,
  metadata = {},
}) {
  const chargeAmount = roundCredits(amount);

  if (chargeAmount <= 0) {
    const user = await ensureUserCredits(userId);
    return {
      credits: serializeCredits(user),
      transaction: null,
    };
  }

  await ensureUserCredits(userId);

  const updatedUser = await User.findOneAndUpdate(
    {
      _id: userId,
      "credits.balance": { $gte: chargeAmount },
    },
    {
      $inc: {
        "credits.balance": -chargeAmount,
        "credits.lifetimeSpent": chargeAmount,
      },
    },
    { new: true }
  );

  if (!updatedUser) {
    const user = await User.findById(userId);
    throw buildInsufficientCreditsError(user?.credits?.balance || 0, chargeAmount);
  }

  const transaction = await CreditTransaction.create({
    userId,
    type: "debit",
    amount: chargeAmount,
    balanceAfter: roundCredits(updatedUser.credits.balance),
    reason,
    description,
    provider,
    model,
    usage,
    usdCost: roundMoney(usdCost),
    creditRateUsd: CREDIT_CONFIG.usdPerCredit,
    markupMultiplier,
    metadata,
  });

  return {
    credits: serializeCredits(updatedUser),
    transaction,
  };
}

function calculateTokenCharge(usage = {}) {
  const inputTokens = Number(
    usage.inputTokens || usage.promptTokens || usage.prompt_tokens || 0
  );
  const outputTokens = Number(
    usage.outputTokens ||
      usage.completionTokens ||
      usage.completion_tokens ||
      0
  );
  const totalTokens = Number(
    usage.totalTokens ||
      usage.total_tokens ||
      Math.max(0, inputTokens) + Math.max(0, outputTokens)
  );

  let baseUsd = 0;

  if (inputTokens > 0 || outputTokens > 0) {
    baseUsd =
      (Math.max(0, inputTokens) * CREDIT_CONFIG.inputUsdPerMillion +
        Math.max(0, outputTokens) * CREDIT_CONFIG.outputUsdPerMillion) /
      1_000_000;
  } else if (totalTokens > 0) {
    baseUsd =
      (Math.max(0, totalTokens) * CREDIT_CONFIG.fallbackUsdPerMillion) /
      1_000_000;
  }

  const markedUpUsd = baseUsd * CREDIT_CONFIG.tokenMarkupMultiplier;
  const credits = roundCredits(markedUpUsd / CREDIT_CONFIG.usdPerCredit);

  return {
    inputTokens: Math.max(0, inputTokens),
    outputTokens: Math.max(0, outputTokens),
    totalTokens: Math.max(0, totalTokens),
    baseUsd: roundMoney(baseUsd),
    usdCost: roundMoney(markedUpUsd),
    credits,
  };
}

async function chargeTokenUsage({
  userId,
  usage,
  reason = "ai_tokens",
  description = "AI token usage",
  provider = "",
  model = "",
  metadata = {},
}) {
  const charge = calculateTokenCharge(usage);

  if (charge.credits <= 0) {
    const user = await ensureUserCredits(userId);
    return {
      charge,
      credits: serializeCredits(user),
      transaction: null,
    };
  }

  const result = await debitCredits({
    userId,
    amount: charge.credits,
    reason,
    description,
    provider,
    model,
    usage: {
      ...usage,
      billedInputTokens: charge.inputTokens,
      billedOutputTokens: charge.outputTokens,
      billedTotalTokens: charge.totalTokens,
    },
    usdCost: charge.usdCost,
    markupMultiplier: CREDIT_CONFIG.tokenMarkupMultiplier,
    metadata: {
      ...metadata,
      baseUsd: charge.baseUsd,
    },
  });

  return {
    ...result,
    charge,
  };
}

async function chargeImageUsage({
  userId,
  reason = "ai_image",
  description = "AI image generation",
  provider = "gemini",
  model = "",
  usage = null,
  metadata = {},
}) {
  await assertHasCredits(userId, CREDIT_CONFIG.imageCredits);

  return debitCredits({
    userId,
    amount: CREDIT_CONFIG.imageCredits,
    reason,
    description,
    provider,
    model,
    usage,
    usdCost: 0,
    markupMultiplier: 1,
    metadata,
  });
}

module.exports = {
  CREDIT_CONFIG,
  assertHasCredits,
  calculateTokenCharge,
  chargeImageUsage,
  chargeTokenUsage,
  ensureUserCredits,
  getCreditSummary,
  serializeBilling,
  serializeCredits,
  serializeTransaction,
};
