const ENV = require("../configs/env");
const CreditTransaction = require("../models/CreditTransaction");
const User = require("../models/User");
const {
  DEFAULT_MONTHLY_CREDIT_PRESETS,
  getMonthlyCreditPlanAmounts,
} = require("./monthly-credit-plans.service");

function numberFromEnv(value, fallback) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 1_000_000) / 1_000_000;
}

function roundCredits(value) {
  const numeric = Number(value || 0);

  if (!Number.isFinite(numeric) || numeric <= 0) return 0;

  return Math.ceil(numeric * 10_000) / 10_000;
}

const DEFAULT_TEXT_MODEL_PRICES = {
  groq: {
    "openai/gpt-oss-120b": { inputUsdPerMillion: 0.15, outputUsdPerMillion: 0.6 },
    "openai/gpt-oss-20b": { inputUsdPerMillion: 0.075, outputUsdPerMillion: 0.3 },
    "meta-llama/llama-4-scout-17b-16e-instruct": {
      inputUsdPerMillion: 0.11,
      outputUsdPerMillion: 0.34,
    },
    "llama-3.3-70b-versatile": {
      inputUsdPerMillion: 0.59,
      outputUsdPerMillion: 0.79,
    },
    default: { inputUsdPerMillion: 0.15, outputUsdPerMillion: 0.6 },
  },
  gemini: {
    "gemini-3.5-flash": { inputUsdPerMillion: 1.5, outputUsdPerMillion: 9 },
    "gemini-3.1-flash-lite": {
      inputUsdPerMillion: 0.25,
      outputUsdPerMillion: 1.5,
    },
    "gemini-3.1-flash-lite-preview": {
      inputUsdPerMillion: 0.25,
      outputUsdPerMillion: 1.5,
    },
    "gemini-3.1-pro-preview": { inputUsdPerMillion: 2, outputUsdPerMillion: 12 },
    "gemini-3.1-pro-preview-customtools": {
      inputUsdPerMillion: 2,
      outputUsdPerMillion: 12,
    },
    "gemini-3-flash-preview": {
      inputUsdPerMillion: 0.5,
      outputUsdPerMillion: 3,
    },
    "gemini-2.5-flash": { inputUsdPerMillion: 0.3, outputUsdPerMillion: 2.5 },
    "gemini-2.5-flash-lite": {
      inputUsdPerMillion: 0.1,
      outputUsdPerMillion: 0.4,
    },
    "gemini-2.5-flash-lite-preview": {
      inputUsdPerMillion: 0.1,
      outputUsdPerMillion: 0.4,
    },
    default: { inputUsdPerMillion: 1.5, outputUsdPerMillion: 9 },
  },
};

const DEFAULT_IMAGE_MODEL_PRICES = {
  gemini: {
    "gemini-3.1-flash-image-preview": {
      inputUsdPerMillion: 0.5,
      imageUsdBySize: {
        "512": 0.045,
        "1K": 0.067,
        "2K": 0.101,
        "4K": 0.151,
      },
    },
    "gemini-3-pro-image-preview": {
      inputUsdPerMillion: 2,
      imageUsdBySize: {
        "512": 0.134,
        "1K": 0.134,
        "2K": 0.134,
        "4K": 0.24,
      },
    },
    "gemini-2.5-flash-image": {
      inputUsdPerMillion: 0.5,
      imageUsdBySize: {
        "512": 0.045,
        "1K": 0.067,
        "2K": 0.101,
        "4K": 0.151,
      },
    },
    default: {
      inputUsdPerMillion: 0.5,
      imageUsdBySize: {
        "512": 0.045,
        "1K": 0.067,
        "2K": 0.101,
        "4K": 0.151,
      },
    },
  },
};

// ElevenLabs text-to-speech is billed per character. Rates below are USD per
// 1,000 characters (Multilingual v2 / Eleven v3 bill 1 credit/char ≈ $0.10/1k;
// Flash/Turbo bill 0.5 credit/char ≈ $0.05/1k on the ElevenLabs API).
const ELEVENLABS_AUDIO_PRICES = {
  eleven_v3: { usdPer1kChars: 0.1 },
  eleven_multilingual_v2: { usdPer1kChars: 0.1 },
  eleven_multilingual_v1: { usdPer1kChars: 0.1 },
  eleven_flash_v2_5: { usdPer1kChars: 0.05 },
  eleven_flash_v2: { usdPer1kChars: 0.05 },
  eleven_turbo_v2_5: { usdPer1kChars: 0.05 },
  eleven_turbo_v2: { usdPer1kChars: 0.05 },
  default: { usdPer1kChars: 0.1 },
};

function normalizeProviderKey(provider = "") {
  const selected = String(provider || "").trim().toLowerCase();

  return selected || "groq";
}

function normalizeModelKey(model = "") {
  return String(model || "")
    .trim()
    .replace(/^models\//i, "")
    .toLowerCase();
}

function normalizeImageSizeKey(imageSize = "") {
  const selected = String(imageSize || ENV.GEMINI_IMAGE_SIZE || "1K")
    .trim()
    .toUpperCase();

  return selected === "512" || selected === "1K" || selected === "2K" || selected === "4K"
    ? selected
    : "1K";
}

function getTextModelPricing({ provider = "", model = "" } = {}) {
  const providerKey = normalizeProviderKey(provider);
  const modelKey = normalizeModelKey(model);
  const providerPrices =
    DEFAULT_TEXT_MODEL_PRICES[providerKey] || DEFAULT_TEXT_MODEL_PRICES.groq;

  return {
    provider: providerKey,
    model: modelKey || "default",
    ...(providerPrices[modelKey] || providerPrices.default),
  };
}

function getImageModelPricing({ provider = "gemini", model = "" } = {}) {
  const providerKey = normalizeProviderKey(provider);
  const modelKey = normalizeModelKey(model || ENV.GEMINI_IMAGE_MODEL);
  const providerPrices =
    DEFAULT_IMAGE_MODEL_PRICES[providerKey] || DEFAULT_IMAGE_MODEL_PRICES.gemini;

  return {
    provider: providerKey,
    model: modelKey || "default",
    ...(providerPrices[modelKey] || providerPrices.default),
  };
}

const bookifyUsdPerCredit = numberFromEnv(ENV.BOOKIFY_USD_PER_CREDIT, 0.01);
const tokenMarkupMultiplier = numberFromEnv(ENV.AI_TOKEN_MARKUP_MULTIPLIER, 2);
const audioMarkupMultiplier = numberFromEnv(ENV.ELEVENLABS_MARKUP_MULTIPLIER, 1.2);
const defaultImagePricing = getImageModelPricing({
  provider: "gemini",
  model: ENV.GEMINI_IMAGE_MODEL,
});
const defaultImageSize = normalizeImageSizeKey(ENV.GEMINI_IMAGE_SIZE);
const defaultImageBaseUsd =
  defaultImagePricing.imageUsdBySize[defaultImageSize] ||
  defaultImagePricing.imageUsdBySize["1K"];
const defaultImageCredits = roundCredits(
  (defaultImageBaseUsd * tokenMarkupMultiplier) / bookifyUsdPerCredit
);

const CREDIT_CONFIG = {
  startingCredits: numberFromEnv(ENV.STARTING_CREDITS, 500),
  usdPerCredit: bookifyUsdPerCredit,
  imageCredits: defaultImageCredits,
  tokenMarkupMultiplier,
  audioMarkupMultiplier,
};

function getAudioModelPricing(model = "") {
  const modelKey = normalizeModelKey(model || ENV.ELEVENLABS_DEFAULT_MODEL);

  return {
    model: modelKey || "default",
    ...(ELEVENLABS_AUDIO_PRICES[modelKey] || ELEVENLABS_AUDIO_PRICES.default),
  };
}

const CREDIT_HISTORY_DAYS = 40;
const MONTHLY_CREDIT_PRESETS = DEFAULT_MONTHLY_CREDIT_PRESETS;

function serializeCredits(user) {
  const credits = user?.credits || {};

  return {
    balance: roundCredits(credits.balance),
    lifetimeGranted: roundCredits(credits.lifetimeGranted),
    lifetimeSpent: roundCredits(credits.lifetimeSpent),
    monthlyAllowance: roundCredits(credits.monthlyAllowance),
    monthlyPreset: credits.monthlyPreset || "",
    monthlyResetDay: credits.monthlyResetDay || 1,
    monthlyResetAt: credits.monthlyResetAt || null,
    nextMonthlyResetAt: getNextMonthlyResetAt().toISOString(),
    startingCredits: CREDIT_CONFIG.startingCredits,
    usdPerCredit: CREDIT_CONFIG.usdPerCredit,
    imageCredits: CREDIT_CONFIG.imageCredits,
    tokenMarkupMultiplier: CREDIT_CONFIG.tokenMarkupMultiplier,
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

function getMonthlyResetKey(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

function getNextMonthlyResetAt(date = new Date()) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0, 0)
  );
}

function getCreditHistorySince(days = CREDIT_HISTORY_DAYS, now = new Date()) {
  const numericDays = Math.max(
    Number.parseInt(days, 10) || CREDIT_HISTORY_DAYS,
    1
  );
  const since = new Date(now);

  since.setDate(since.getDate() - numericDays);

  return since;
}

function buildCreditHistoryQuery(userId, options = {}) {
  return {
    userId,
    createdAt: {
      $gte: getCreditHistorySince(options.days, options.now),
    },
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
    return resetMonthlyCreditsIfDue(user);
  }

  const startingBalance =
    Number.isFinite(Number(credits.balance)) && Number(credits.balance) > 0
      ? Number(credits.balance)
      : CREDIT_CONFIG.startingCredits;

  user.credits = {
    balance: roundCredits(startingBalance),
    lifetimeGranted: roundCredits(startingBalance),
    lifetimeSpent: roundCredits(credits.lifetimeSpent || 0),
    monthlyAllowance: roundCredits(credits.monthlyAllowance || 0),
    monthlyPreset: credits.monthlyPreset || "",
    monthlyResetDay: credits.monthlyResetDay || 1,
    monthlyResetKey: credits.monthlyResetKey || getMonthlyResetKey(),
    monthlyResetAt: credits.monthlyResetAt || null,
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

  return resetMonthlyCreditsIfDue(user);
}

async function resetMonthlyCreditsIfDue(user, now = new Date()) {
  const allowance = roundCredits(user?.credits?.monthlyAllowance || 0);
  const currentResetKey = getMonthlyResetKey(now);

  if (!user || allowance <= 0) return user;

  if (user.credits?.monthlyResetKey === currentResetKey) {
    return user;
  }

  const currentBalance = roundCredits(user.credits?.balance);
  const nextBalance = allowance;
  const delta = roundCredits(nextBalance - currentBalance);
  const update = {
    $set: {
      "credits.balance": nextBalance,
      "credits.monthlyResetKey": currentResetKey,
      "credits.monthlyResetAt": now,
      "credits.monthlyResetDay": 1,
    },
  };

  if (delta > 0) {
    update.$inc = {
      "credits.lifetimeGranted": delta,
    };
  }

  const updatedUser = await User.findByIdAndUpdate(user._id, update, {
    new: true,
  });
  const transactionAmount = roundCredits(Math.abs(nextBalance - currentBalance));

  await CreditTransaction.create({
    userId: user._id,
    type: "adjustment",
    amount: transactionAmount,
    balanceAfter: nextBalance,
    reason: "monthly_credit_reset",
    description: `Monthly credit balance reset to ${nextBalance} credits.`,
    creditRateUsd: CREDIT_CONFIG.usdPerCredit,
    markupMultiplier: 1,
    metadata: {
      action: "monthly_reset",
      direction:
        nextBalance < currentBalance
          ? "remove"
          : nextBalance > currentBalance
            ? "add"
            : "none",
      previousBalance: currentBalance,
      monthlyAllowance: allowance,
      resetKey: currentResetKey,
    },
  });

  return updatedUser;
}

async function getCreditSummary(userId, options = {}) {
  const user = await ensureUserCredits(userId);
  const includeTransactions = options.includeTransactions !== false;
  const transactions = includeTransactions
    ? await CreditTransaction.find(buildCreditHistoryQuery(userId))
        .sort({ createdAt: -1 })
        .lean()
    : [];

  return {
    credits: serializeCredits(user),
    transactions,
    historyDays: CREDIT_HISTORY_DAYS,
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

function getBillableUsageTokens(usage = {}) {
  const inputTokens = Number(
    usage.inputTokens || usage.promptTokens || usage.prompt_tokens || 0
  );
  const visibleOutputTokens = Number(
    usage.outputTokens ||
      usage.completionTokens ||
      usage.completion_tokens ||
      usage.candidatesTokenCount ||
      0
  );
  const thinkingTokens = Number(
    usage.thinkingTokens ||
      usage.thoughtsTokenCount ||
      usage.thoughts_token_count ||
      0
  );
  const outputTokens = Number(
    usage.billableOutputTokens ||
      usage.billedOutputTokens ||
      Math.max(0, visibleOutputTokens) + Math.max(0, thinkingTokens) ||
      0
  );
  const totalTokens = Number(
    usage.totalTokens ||
      usage.total_tokens ||
      Math.max(0, inputTokens) + Math.max(0, outputTokens)
  );

  return {
    inputTokens: Math.max(0, inputTokens),
    outputTokens: Math.max(0, outputTokens),
    visibleOutputTokens: Math.max(0, visibleOutputTokens),
    thinkingTokens: Math.max(0, thinkingTokens),
    totalTokens: Math.max(0, totalTokens),
  };
}

function calculateTokenCharge(usage = {}, options = {}) {
  const {
    inputTokens,
    outputTokens,
    visibleOutputTokens,
    thinkingTokens,
    totalTokens,
  } = getBillableUsageTokens(usage);
  const pricing = getTextModelPricing({
    provider: options.provider,
    model: options.model || usage.modelName || usage.model,
  });
  let baseUsd = 0;

  if (inputTokens > 0 || outputTokens > 0) {
    baseUsd =
      (inputTokens * pricing.inputUsdPerMillion +
        outputTokens * pricing.outputUsdPerMillion) /
      1_000_000;
  } else if (totalTokens > 0) {
    const fallbackPrice = pricing.outputUsdPerMillion || 1;

    baseUsd = (totalTokens * fallbackPrice) / 1_000_000;
  }

  const markedUpUsd = baseUsd * CREDIT_CONFIG.tokenMarkupMultiplier;
  const credits = roundCredits(markedUpUsd / CREDIT_CONFIG.usdPerCredit);

  return {
    inputTokens,
    outputTokens,
    visibleOutputTokens,
    thinkingTokens,
    totalTokens,
    baseUsd: roundMoney(baseUsd),
    usdCost: roundMoney(markedUpUsd),
    credits,
    pricing,
    markupMultiplier: CREDIT_CONFIG.tokenMarkupMultiplier,
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
  const charge = calculateTokenCharge(usage, { provider, model });

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
      visibleOutputTokens: charge.visibleOutputTokens,
      thinkingTokens: charge.thinkingTokens,
      billedTotalTokens: charge.totalTokens,
    },
    usdCost: charge.usdCost,
    markupMultiplier: CREDIT_CONFIG.tokenMarkupMultiplier,
    metadata: {
      ...metadata,
      baseUsd: charge.baseUsd,
      pricing: charge.pricing,
    },
  });

  return {
    ...result,
    charge,
  };
}

function calculateImageCharge({
  provider = "gemini",
  model = "",
  usage = {},
  imageSize = "",
} = {}) {
  const { inputTokens } = getBillableUsageTokens(usage || {});
  const pricing = getImageModelPricing({ provider, model });
  const size = normalizeImageSizeKey(imageSize);
  const imageBaseUsd =
    pricing.imageUsdBySize[size] || pricing.imageUsdBySize["1K"] || 0;
  const inputBaseUsd = (inputTokens * pricing.inputUsdPerMillion) / 1_000_000;
  const baseUsd = inputBaseUsd + imageBaseUsd;
  const markedUpUsd = baseUsd * CREDIT_CONFIG.tokenMarkupMultiplier;
  const credits = roundCredits(markedUpUsd / CREDIT_CONFIG.usdPerCredit);

  return {
    inputTokens,
    imageSize: size,
    imageBaseUsd: roundMoney(imageBaseUsd),
    inputBaseUsd: roundMoney(inputBaseUsd),
    baseUsd: roundMoney(baseUsd),
    usdCost: roundMoney(markedUpUsd),
    credits,
    pricing: {
      provider: pricing.provider,
      model: pricing.model,
      inputUsdPerMillion: pricing.inputUsdPerMillion,
      imageUsd: imageBaseUsd,
    },
    markupMultiplier: CREDIT_CONFIG.tokenMarkupMultiplier,
  };
}

function getImageCreditEstimate(options = {}) {
  return calculateImageCharge(options).credits || CREDIT_CONFIG.imageCredits;
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
  const charge = calculateImageCharge({
    provider,
    model,
    usage,
    imageSize: metadata.imageSize,
  });

  await assertHasCredits(userId, charge.credits);

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
      billedImageSize: charge.imageSize,
    },
    usdCost: charge.usdCost,
    markupMultiplier: CREDIT_CONFIG.tokenMarkupMultiplier,
    metadata: {
      ...metadata,
      baseUsd: charge.baseUsd,
      imageBaseUsd: charge.imageBaseUsd,
      inputBaseUsd: charge.inputBaseUsd,
      pricing: charge.pricing,
    },
  });

  return {
    ...result,
    charge,
  };
}

function calculateAudioCharge({ model = "", charCount = 0 } = {}) {
  const pricing = getAudioModelPricing(model);
  const chars = Math.max(0, Math.round(Number(charCount) || 0));
  const baseUsd = (chars / 1000) * pricing.usdPer1kChars;
  const markedUpUsd = baseUsd * CREDIT_CONFIG.audioMarkupMultiplier;
  const credits = roundCredits(markedUpUsd / CREDIT_CONFIG.usdPerCredit);

  return {
    charCount: chars,
    baseUsd: roundMoney(baseUsd),
    usdCost: roundMoney(markedUpUsd),
    credits,
    pricing: {
      model: pricing.model,
      usdPer1kChars: pricing.usdPer1kChars,
    },
    markupMultiplier: CREDIT_CONFIG.audioMarkupMultiplier,
  };
}

function getAudioCreditEstimate(options = {}) {
  return calculateAudioCharge(options).credits;
}

async function chargeAudioUsage({
  userId,
  reason = "audiobook_generation",
  description = "Audiobook narration",
  model = "",
  charCount = 0,
  metadata = {},
}) {
  const charge = calculateAudioCharge({ model, charCount });

  if (charge.credits <= 0) {
    const user = await ensureUserCredits(userId);
    return {
      charge,
      credits: serializeCredits(user),
      transaction: null,
    };
  }

  await assertHasCredits(userId, charge.credits);

  const result = await debitCredits({
    userId,
    amount: charge.credits,
    reason,
    description,
    provider: "elevenlabs",
    model: charge.pricing.model,
    usage: { characterCount: charge.charCount },
    usdCost: charge.usdCost,
    markupMultiplier: CREDIT_CONFIG.audioMarkupMultiplier,
    metadata: {
      ...metadata,
      baseUsd: charge.baseUsd,
      pricing: charge.pricing,
    },
  });

  return {
    ...result,
    charge,
  };
}

async function adjustUserCredits({
  userId,
  action,
  amount,
  adminUserId,
  note = "",
}) {
  const numericAmount = roundCredits(amount);

  if (!["add", "remove", "set"].includes(action)) {
    const error = new Error("Unsupported credit adjustment action.");
    error.statusCode = 400;
    throw error;
  }

  if (!Number.isFinite(numericAmount) || numericAmount < 0) {
    const error = new Error("Credit amount must be a positive number.");
    error.statusCode = 400;
    throw error;
  }

  const user = await ensureUserCredits(userId);
  const currentBalance = roundCredits(user.credits?.balance);
  let delta = 0;
  let reason = "";
  let description = "";

  if (action === "add") {
    if (numericAmount <= 0) {
      const error = new Error("Add amount must be greater than zero.");
      error.statusCode = 400;
      throw error;
    }

    delta = numericAmount;
    reason = "admin_credit_add";
    description = `Admin added ${numericAmount} credits.`;
  }

  if (action === "remove") {
    if (numericAmount <= 0) {
      const error = new Error("Remove amount must be greater than zero.");
      error.statusCode = 400;
      throw error;
    }

    delta = -numericAmount;
    reason = "admin_credit_remove";
    description = `Admin removed ${numericAmount} credits.`;
  }

  if (action === "set") {
    delta = numericAmount - currentBalance;
    reason = "admin_credit_set";
    description = `Admin set balance to ${numericAmount} credits.`;
  }

  const nextBalance = roundCredits(currentBalance + delta);

  if (nextBalance < 0) {
    throw buildInsufficientCreditsError(currentBalance, Math.abs(delta));
  }

  const update = {
    $set: {
      "credits.balance": nextBalance,
    },
  };

  if (delta > 0) {
    update.$inc = {
      "credits.lifetimeGranted": roundCredits(delta),
    };
  }

  const updatedUser = await User.findByIdAndUpdate(userId, update, {
    new: true,
  });

  const transaction = await CreditTransaction.create({
    userId,
    type: "adjustment",
    amount: roundCredits(Math.abs(delta)),
    balanceAfter: nextBalance,
    reason,
    description: note ? `${description} ${note}` : description,
    creditRateUsd: CREDIT_CONFIG.usdPerCredit,
    markupMultiplier: 1,
    metadata: {
      action,
      direction: delta < 0 ? "remove" : delta > 0 ? "add" : "none",
      previousBalance: currentBalance,
      requestedAmount: numericAmount,
      adminUserId,
      note,
    },
  });

  return {
    user: updatedUser,
    credits: serializeCredits(updatedUser),
    transaction,
  };
}

async function setMonthlyCreditAllowance({
  userId,
  amount,
  preset = "",
  adminUserId,
  note = "",
}) {
  const rawAmount = Number(amount);
  const numericAmount = roundCredits(rawAmount);
  const normalizedPreset = ["premium", "ultra", "custom", ""].includes(preset)
    ? preset
    : "custom";

  if (!Number.isFinite(rawAmount) || rawAmount < 0) {
    const error = new Error("Monthly credit amount must be zero or greater.");
    error.statusCode = 400;
    throw error;
  }

  if (
    normalizedPreset &&
    normalizedPreset !== "custom" &&
    (await getMonthlyCreditPlanAmounts())[normalizedPreset] !== numericAmount
  ) {
    const error = new Error("Monthly credit preset amount does not match.");
    error.statusCode = 400;
    throw error;
  }

  const user = await ensureUserCredits(userId);
  const currentBalance = roundCredits(user.credits?.balance);
  const nextPreset = numericAmount > 0 ? normalizedPreset || "custom" : "";
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    {
      $set: {
        "credits.monthlyAllowance": numericAmount,
        "credits.monthlyPreset": nextPreset,
        "credits.monthlyResetDay": 1,
        "credits.monthlyResetKey": getMonthlyResetKey(),
      },
    },
    { new: true }
  );
  const transaction = await CreditTransaction.create({
    userId,
    type: "adjustment",
    amount: 0,
    balanceAfter: currentBalance,
    reason: "admin_monthly_credit_allowance",
    description:
      numericAmount > 0
        ? `Admin set monthly credit reset to ${numericAmount} credits.`
        : "Admin disabled monthly credit reset.",
    creditRateUsd: CREDIT_CONFIG.usdPerCredit,
    markupMultiplier: 1,
    metadata: {
      action: "set_monthly_allowance",
      direction: "none",
      monthlyAllowance: numericAmount,
      preset: nextPreset,
      adminUserId,
      note,
    },
  });

  return {
    user: updatedUser,
    credits: serializeCredits(updatedUser),
    transaction,
  };
}

module.exports = {
  CREDIT_HISTORY_DAYS,
  CREDIT_CONFIG,
  MONTHLY_CREDIT_PRESETS,
  adjustUserCredits,
  assertHasCredits,
  buildCreditHistoryQuery,
  calculateAudioCharge,
  calculateImageCharge,
  calculateTokenCharge,
  chargeAudioUsage,
  chargeImageUsage,
  chargeTokenUsage,
  ensureUserCredits,
  getAudioCreditEstimate,
  getCreditHistorySince,
  getImageCreditEstimate,
  getMonthlyResetKey,
  getNextMonthlyResetAt,
  getTextModelPricing,
  getCreditSummary,
  serializeBilling,
  serializeCredits,
  serializeTransaction,
  setMonthlyCreditAllowance,
  roundCredits,
};
