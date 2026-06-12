const test = require("node:test");
const assert = require("node:assert/strict");
const {
  calculateAudioCharge,
  getAudioCreditEstimate,
} = require("./credits.service");

// Defaults: $0.10 per credit, 20% audiobook markup.
//   Eleven v3 / Multilingual v2: $0.10 / 1000 chars -> 0.10 * 1.2 / 0.10 = 1.2 credits / 1k
//   Flash / Turbo:               $0.05 / 1000 chars -> 0.05 * 1.2 / 0.10 = 0.6 credits / 1k

test("eleven v3 costs 1.2 credits per 1,000 characters", () => {
  const charge = calculateAudioCharge({
    model: "eleven_v3",
    charCount: 1000,
  });

  assert.equal(charge.credits, 1.2);
  assert.equal(charge.markupMultiplier, 1.2);
});

test("multilingual v2 costs 1.2 credits per 1,000 characters", () => {
  const charge = calculateAudioCharge({
    model: "eleven_multilingual_v2",
    charCount: 1000,
  });

  assert.equal(charge.credits, 1.2);
});

test("flash/turbo cost 0.6 credits per 1,000 characters", () => {
  assert.equal(
    calculateAudioCharge({ model: "eleven_flash_v2_5", charCount: 1000 }).credits,
    0.6
  );
  assert.equal(
    calculateAudioCharge({ model: "eleven_turbo_v2_5", charCount: 1000 }).credits,
    0.6
  );
});

test("unknown model falls back to the default ($0.10/1k) rate", () => {
  assert.equal(
    calculateAudioCharge({ model: "made_up_model", charCount: 1000 }).credits,
    1.2
  );
});

test("charge scales linearly with character count", () => {
  const charge = calculateAudioCharge({
    model: "eleven_v3",
    charCount: 50000,
  });

  assert.equal(charge.credits, 60);
});

test("zero characters costs zero credits", () => {
  assert.equal(
    calculateAudioCharge({ model: "eleven_v3", charCount: 0 }).credits,
    0
  );
});

test("getAudioCreditEstimate matches calculateAudioCharge.credits", () => {
  assert.equal(
    getAudioCreditEstimate({ model: "eleven_flash_v2_5", charCount: 2000 }),
    1.2
  );
});
