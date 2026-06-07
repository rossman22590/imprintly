const CreditPlanSettings = require("../models/CreditPlanSettings");
const User = require("../models/User");

const PLAN_SETTINGS_KEY = "monthly-credit-plans";
const PLAN_IDS = ["premium", "ultra"];
const PLAN_LABELS = {
  premium: "Premium",
  ultra: "Ultra",
};
const DEFAULT_MONTHLY_CREDIT_PRESETS = Object.freeze({
  premium: 500,
  ultra: 1000,
});

function roundPlanCredits(value) {
  const numeric = Number(value || 0);

  if (!Number.isFinite(numeric) || numeric <= 0) return 0;

  return Math.ceil(numeric * 10_000) / 10_000;
}

function normalizeMonthlyCreditPlanAmount(value, planId) {
  const numeric = Number(value);
  const label = PLAN_LABELS[planId] || "Plan";

  if (!Number.isFinite(numeric) || numeric <= 0) {
    const error = new Error(`${label} recurring amount must be greater than zero.`);
    error.statusCode = 400;
    throw error;
  }

  return roundPlanCredits(numeric);
}

function getPayloadValue(source, planId) {
  const value = source?.[planId];

  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value.amount ?? value.monthlyCredits;
  }

  return value;
}

function normalizeMonthlyCreditPlanPayload(input = {}, fallback = {}) {
  const source =
    input?.plans && !Array.isArray(input.plans) ? input.plans : input;
  const amounts = {};

  PLAN_IDS.forEach((planId) => {
    const value =
      getPayloadValue(source, planId) ??
      fallback[planId] ??
      DEFAULT_MONTHLY_CREDIT_PRESETS[planId];

    amounts[planId] = normalizeMonthlyCreditPlanAmount(value, planId);
  });

  return amounts;
}

function getPlanAmountsFromSettings(settings) {
  return PLAN_IDS.reduce((amounts, planId) => {
    const storedAmount = settings?.plans?.[planId]?.monthlyCredits;
    const amount = roundPlanCredits(storedAmount);

    amounts[planId] = amount || DEFAULT_MONTHLY_CREDIT_PRESETS[planId];
    return amounts;
  }, {});
}

function serializeMonthlyCreditPlanSettings(settings) {
  const amounts = getPlanAmountsFromSettings(settings);

  return {
    plans: PLAN_IDS.map((planId) => ({
      id: planId,
      label: PLAN_LABELS[planId],
      amount: amounts[planId],
    })),
    updatedAt: settings?.updatedAt || null,
  };
}

async function findOrCreateMonthlyCreditPlanSettings() {
  return CreditPlanSettings.findOneAndUpdate(
    { key: PLAN_SETTINGS_KEY },
    {
      $setOnInsert: {
        key: PLAN_SETTINGS_KEY,
        plans: {
          premium: {
            monthlyCredits: DEFAULT_MONTHLY_CREDIT_PRESETS.premium,
          },
          ultra: {
            monthlyCredits: DEFAULT_MONTHLY_CREDIT_PRESETS.ultra,
          },
        },
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );
}

async function getMonthlyCreditPlanSettings() {
  const settings = await findOrCreateMonthlyCreditPlanSettings();

  return serializeMonthlyCreditPlanSettings(settings);
}

async function getMonthlyCreditPlanAmounts() {
  const settings = await findOrCreateMonthlyCreditPlanSettings();

  return getPlanAmountsFromSettings(settings);
}

async function updateMonthlyCreditPlanSettings(input = {}) {
  const currentSettings = await findOrCreateMonthlyCreditPlanSettings();
  const currentAmounts = getPlanAmountsFromSettings(currentSettings);
  const amounts = normalizeMonthlyCreditPlanPayload(input, currentAmounts);
  const updatedSettings = await CreditPlanSettings.findOneAndUpdate(
    { key: PLAN_SETTINGS_KEY },
    {
      $set: {
        "plans.premium.monthlyCredits": amounts.premium,
        "plans.ultra.monthlyCredits": amounts.ultra,
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );

  await Promise.all(
    PLAN_IDS.map((planId) =>
      User.updateMany(
        { "credits.monthlyPreset": planId },
        {
          $set: {
            "credits.monthlyAllowance": amounts[planId],
          },
        }
      )
    )
  );

  return serializeMonthlyCreditPlanSettings(updatedSettings);
}

module.exports = {
  DEFAULT_MONTHLY_CREDIT_PRESETS,
  getMonthlyCreditPlanAmounts,
  getMonthlyCreditPlanSettings,
  normalizeMonthlyCreditPlanPayload,
  updateMonthlyCreditPlanSettings,
};
