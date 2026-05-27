const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildCreditHistoryQuery,
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

test("new users default to 50 starting credits", () => {
  assert.equal(CREDIT_CONFIG.startingCredits, 50);
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
