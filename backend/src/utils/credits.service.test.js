const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildCreditHistoryQuery,
  CREDIT_CONFIG,
  CREDIT_HISTORY_DAYS,
  getCreditHistorySince,
} = require("./credits.service");

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
