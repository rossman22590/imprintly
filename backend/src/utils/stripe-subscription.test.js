const assert = require("node:assert/strict");
const test = require("node:test");

// Inline functions matching our credits.service.js implementation for testing calculations
function roundCredits(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.ceil(numeric * 10_000) / 10_000;
}

function deductCredits(user, chargeAmount) {
  const currentBalance = roundCredits(user.credits.balance);
  if (currentBalance < chargeAmount) {
    throw new Error("INSUFFICIENT_CREDITS");
  }

  let recurringBal = roundCredits(user.credits.recurringBalance || 0);
  let oneTimeBal = roundCredits(user.credits.oneTimeBalance || 0);

  if (recurringBal >= chargeAmount) {
    recurringBal = roundCredits(recurringBal - chargeAmount);
  } else {
    const remainder = roundCredits(chargeAmount - recurringBal);
    recurringBal = 0;
    oneTimeBal = roundCredits(oneTimeBal - remainder);
  }

  user.credits.recurringBalance = recurringBal;
  user.credits.oneTimeBalance = oneTimeBal;
  user.credits.balance = roundCredits(recurringBal + oneTimeBal);
  user.credits.lifetimeSpent = roundCredits((user.credits.lifetimeSpent || 0) + chargeAmount);
  return user;
}

function processRollover(user, allowance) {
  const currentRecurring = roundCredits(user.credits.recurringBalance || 0);
  const currentOneTime = roundCredits(user.credits.oneTimeBalance || 0);
  const currentBalance = roundCredits(user.credits.balance);

  const nextRecurring = allowance;
  const nextBalance = roundCredits(nextRecurring + currentOneTime);
  const delta = roundCredits(nextBalance - currentBalance);

  user.credits.recurringBalance = nextRecurring;
  user.credits.balance = nextBalance;
  return { user, delta };
}

function calculatePlanChange(user, oldAllowance, newAllowance, remainingFraction = 1) {
  const rawDiff = newAllowance - oldAllowance;
  const creditDiff = roundCredits(Math.abs(rawDiff) * remainingFraction);

  if (rawDiff > 0 && creditDiff > 0) {
    user.credits.recurringBalance = roundCredits((user.credits.recurringBalance || 0) + creditDiff);
    user.credits.balance = roundCredits(user.credits.recurringBalance + user.credits.oneTimeBalance);
    user.credits.lifetimeGranted = roundCredits((user.credits.lifetimeGranted || 0) + creditDiff);
    return { user, creditDiff, direction: "add" };
  }

  if (rawDiff < 0 && creditDiff > 0) {
    const totalBalance = roundCredits(user.credits.balance);
    if (totalBalance < creditDiff) {
      throw new Error("INSUFFICIENT_PRORATED_CREDITS");
    }

    const recurringDeduction = Math.min(roundCredits(user.credits.recurringBalance || 0), creditDiff);
    const oneTimeDeduction = roundCredits(creditDiff - recurringDeduction);

    user.credits.recurringBalance = roundCredits(user.credits.recurringBalance - recurringDeduction);
    user.credits.oneTimeBalance = roundCredits(user.credits.oneTimeBalance - oneTimeDeduction);
    user.credits.balance = roundCredits(user.credits.recurringBalance + user.credits.oneTimeBalance);
    return { user, creditDiff, direction: "remove" };
  }

  return { user, creditDiff: 0, direction: "none" };
}

// ---------------- TEST CASES ----------------

test("deductCredits splits deduction: depletes recurring balance first", () => {
  const mockUser = {
    credits: {
      balance: 600,
      recurringBalance: 200,
      oneTimeBalance: 400,
      lifetimeSpent: 0,
    }
  };

  // Charge 150 (less than recurring)
  const updatedUser = deductCredits(mockUser, 150);
  assert.equal(updatedUser.credits.recurringBalance, 50);
  assert.equal(updatedUser.credits.oneTimeBalance, 400);
  assert.equal(updatedUser.credits.balance, 450);
  assert.equal(updatedUser.credits.lifetimeSpent, 150);
});

test("deductCredits splits deduction: uses one-time balance for remainder", () => {
  const mockUser = {
    credits: {
      balance: 450,
      recurringBalance: 50,
      oneTimeBalance: 400,
      lifetimeSpent: 150,
    }
  };

  // Charge 100 (depletes recurring and takes 50 from oneTime)
  const updatedUser = deductCredits(mockUser, 100);
  assert.equal(updatedUser.credits.recurringBalance, 0);
  assert.equal(updatedUser.credits.oneTimeBalance, 350);
  assert.equal(updatedUser.credits.balance, 350);
  assert.equal(updatedUser.credits.lifetimeSpent, 250);
});

test("deductCredits throws error if balance is insufficient", () => {
  const mockUser = {
    credits: {
      balance: 100,
      recurringBalance: 0,
      oneTimeBalance: 100,
      lifetimeSpent: 0,
    }
  };

  assert.throws(() => deductCredits(mockUser, 150), /INSUFFICIENT_CREDITS/);
});

test("processRollover resets recurring credits without rolling over leftover recurring balance", () => {
  const mockUser = {
    credits: {
      balance: 550,
      recurringBalance: 200, // Leftover recurring credits
      oneTimeBalance: 350,   // One-time credits (should be kept)
    }
  };

  const allowance = 500; // Reset allowance
  const { user: updatedUser, delta } = processRollover(mockUser, allowance);

  assert.equal(updatedUser.credits.recurringBalance, 500);
  assert.equal(updatedUser.credits.oneTimeBalance, 350);
  assert.equal(updatedUser.credits.balance, 850);
  assert.equal(delta, 300); // 850 - 550 = 300
});

test("calculatePlanChange adds prorated credits immediately on upgrade", () => {
  const mockUser = {
    credits: {
      balance: 450,
      recurringBalance: 100,
      oneTimeBalance: 350,
      lifetimeGranted: 450,
    }
  };

  const { user: updatedUser, creditDiff, direction } = calculatePlanChange(mockUser, 100, 500, 0.5);

  assert.equal(direction, "add");
  assert.equal(creditDiff, 200);
  assert.equal(updatedUser.credits.recurringBalance, 300);
  assert.equal(updatedUser.credits.oneTimeBalance, 350);
  assert.equal(updatedUser.credits.balance, 650);
  assert.equal(updatedUser.credits.lifetimeGranted, 650);
});

test("calculatePlanChange removes prorated credits immediately on downgrade", () => {
  const mockUser = {
    credits: {
      balance: 850,
      recurringBalance: 500,
      oneTimeBalance: 350,
      lifetimeGranted: 850,
    }
  };

  const { user: updatedUser, creditDiff, direction } = calculatePlanChange(mockUser, 500, 100, 0.5);

  assert.equal(direction, "remove");
  assert.equal(creditDiff, 200);
  assert.equal(updatedUser.credits.recurringBalance, 300);
  assert.equal(updatedUser.credits.oneTimeBalance, 350);
  assert.equal(updatedUser.credits.balance, 650);
});

test("calculatePlanChange uses one-time credits only if recurring credits were already spent", () => {
  const mockUser = {
    credits: {
      balance: 150,
      recurringBalance: 50,
      oneTimeBalance: 100,
      lifetimeGranted: 850,
    }
  };

  const { user: updatedUser, creditDiff, direction } = calculatePlanChange(mockUser, 500, 100, 0.25);

  assert.equal(direction, "remove");
  assert.equal(creditDiff, 100);
  assert.equal(updatedUser.credits.recurringBalance, 0);
  assert.equal(updatedUser.credits.oneTimeBalance, 50);
  assert.equal(updatedUser.credits.balance, 50);
});

test("calculatePlanChange rejects downgrade if prorated credits cannot be clawed back", () => {
  const mockUser = {
    credits: {
      balance: 50,
      recurringBalance: 0,
      oneTimeBalance: 50,
      lifetimeGranted: 850,
    }
  };

  assert.throws(() => calculatePlanChange(mockUser, 500, 100, 0.5), /INSUFFICIENT_PRORATED_CREDITS/);
});
