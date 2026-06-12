const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildCreditHistoryQuery,
  calculateImageCharge,
  calculateTokenCharge,
  calculateAudioCharge,
  CREDIT_CONFIG,
  CREDIT_HISTORY_DAYS,
  getCreditHistorySince,
  getMonthlyResetKey,
  getNextMonthlyResetAt,
} = require("./credits.service");
const {
  DEFAULT_MONTHLY_CREDIT_PRESETS,
  normalizeMonthlyCreditPlanPayload,
} = require("./monthly-credit-plans.service");

function roundUsd(value) {
  return Math.round(Number(value || 0) * 1_000_000) / 1_000_000;
}

test("new users default to 500 starting credits", () => {
  assert.equal(CREDIT_CONFIG.startingCredits, 500);
});

test("one Bookify credit is worth ten cents", () => {
  assert.equal(CREDIT_CONFIG.usdPerCredit, 0.10);
});

test("$50 paid value maps to $25 raw provider budget", () => {
  assert.equal(roundUsd(50 / CREDIT_CONFIG.tokenMarkupMultiplier), 25);
});

test("token charges use provider and model pricing with 50 percent gross margin", () => {
  const charge = calculateTokenCharge(
    {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      modelName: "openai/gpt-oss-120b",
    },
    { provider: "groq" }
  );

  assert.equal(CREDIT_CONFIG.tokenMarkupMultiplier, 2);
  assert.equal(charge.baseUsd, 0.75);
  assert.equal(charge.usdCost, 1.5);
  assert.equal(charge.credits, 15);
  assert.equal(roundUsd(charge.credits * CREDIT_CONFIG.usdPerCredit), charge.usdCost);
});

test("Gemini thinking tokens are billed as output tokens", () => {
  const charge = calculateTokenCharge(
    {
      inputTokens: 1_000_000,
      outputTokens: 500_000,
      thinkingTokens: 500_000,
      modelName: "gemini-3.5-flash",
    },
    { provider: "gemini" }
  );

  assert.equal(charge.visibleOutputTokens, 500_000);
  assert.equal(charge.thinkingTokens, 500_000);
  assert.equal(charge.outputTokens, 1_000_000);
  assert.equal(charge.baseUsd, 10.5);
  assert.equal(charge.usdCost, 21);
  assert.equal(charge.credits, 210);
  assert.equal(roundUsd(charge.credits * CREDIT_CONFIG.usdPerCredit), charge.usdCost);
});

test("default Gemini image charges are based on model and size", () => {
  const charge = calculateImageCharge({
    provider: "gemini",
    model: "gemini-3.1-flash-image-preview",
    imageSize: "1K",
  });

  assert.equal(charge.baseUsd, 0.067);
  assert.equal(charge.usdCost, 0.134);
  assert.equal(charge.credits, 1.34);
  assert.equal(CREDIT_CONFIG.imageCredits, 1.34);
  assert.equal(roundUsd(charge.credits * CREDIT_CONFIG.usdPerCredit), charge.usdCost);
});

test("credit history window defaults to the last 40 days", () => {
  const now = new Date("2026-05-26T12:00:00.000Z");
  const since = getCreditHistorySince(undefined, now);

  assert.equal(CREDIT_HISTORY_DAYS, 40);
  assert.equal(since.toISOString(), "2026-04-16T12:00:00.000Z");
});

test("credit history query returns all transactions inside the 40 day window", () => {
  const now = new Date("2026-05-26T12:00:00.000Z");
  const query = buildCreditHistoryQuery("user-123", { now });

  assert.deepEqual(query, {
    userId: "user-123",
    createdAt: {
      $gte: new Date("2026-04-16T12:00:00.000Z"),
    },
  });
});

test("monthly credit reset keys use UTC calendar months", () => {
  assert.equal(
    getMonthlyResetKey(new Date("2026-05-31T23:59:59.000Z")),
    "2026-05"
  );
  assert.equal(
    getMonthlyResetKey(new Date("2026-06-01T00:00:00.000Z")),
    "2026-06"
  );
});

test("next monthly credit reset is the first of the next UTC month", () => {
  const nextReset = getNextMonthlyResetAt(
    new Date("2026-05-26T12:00:00.000Z")
  );

  assert.equal(nextReset.toISOString(), "2026-06-01T00:00:00.000Z");
});

test("monthly credit plan payload accepts saved premium and ultra amounts", () => {
  assert.deepEqual(
    normalizeMonthlyCreditPlanPayload({
      premium: { amount: "750" },
      ultra: { monthlyCredits: 1500 },
    }),
    {
      premium: 750,
      ultra: 1500,
    }
  );
});

test("monthly credit plan payload keeps defaults for missing plan amounts", () => {
  assert.deepEqual(normalizeMonthlyCreditPlanPayload({}), {
    premium: DEFAULT_MONTHLY_CREDIT_PRESETS.premium,
    ultra: DEFAULT_MONTHLY_CREDIT_PRESETS.ultra,
  });
});

test("monthly credit plan payload rejects non-positive amounts", () => {
  assert.throws(
    () =>
      normalizeMonthlyCreditPlanPayload({
        premium: 0,
        ultra: 1000,
      }),
    /Premium recurring amount must be greater than zero/
  );
});

test("ElevenLabs audiobook generation charges are based on characters and model", () => {
  const multilingualCharge = calculateAudioCharge({
    model: "eleven_multilingual_v2",
    charCount: 1000,
  });
  const flashCharge = calculateAudioCharge({
    model: "eleven_flash_v2_5",
    charCount: 1000,
  });

  assert.equal(multilingualCharge.credits, 1.2);
  assert.equal(flashCharge.credits, 0.6);
});
