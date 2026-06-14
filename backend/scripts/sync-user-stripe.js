const mongoose = require("mongoose");
const stripe = require("stripe");
const User = require("../src/models/User");
const CreditTransaction = require("../src/models/CreditTransaction");
const ENV = require("../src/configs/env");

async function main() {
  const email = "afarhadi@mytsi.org";
  const expectedBalanceBeforeNarration = 336.0379;
  const narrationCost = 14.1444;
  const targetBalance = expectedBalanceBeforeNarration - narrationCost; // 321.8935

  const stripeKey = process.env.STRIPE_SECRET_KEY || ENV.STRIPE_SECRET_KEY;
  console.log("Using Stripe Key prefix:", stripeKey ? stripeKey.substring(0, 7) + "..." : "none");
  console.log("Connecting to database...");
  await mongoose.connect(process.env.DB_URI || ENV.DB_URI);
  
  const user = await User.findOne({ email });
  if (!user) {
    console.error("User not found!");
    await mongoose.disconnect();
    return;
  }

  console.log("\nFound User:", user.email);
  console.log("Database State:");
  console.log("  stripeCustomerId:", user.stripeCustomerId || "none");
  console.log("  stripeSubscriptionId:", user.stripeSubscriptionId || "none");
  console.log("  subscriptionStatus:", user.subscriptionStatus || "none");
  console.log("  subscriptionTier:", user.subscriptionTier || "none");
  console.log("  credits.balance:", user.credits.balance);
  console.log("  credits.recurringBalance:", user.credits.recurringBalance);
  console.log("  credits.oneTimeBalance:", user.credits.oneTimeBalance);

  if (!user.stripeCustomerId) {
    console.error("User does not have a stripeCustomerId!");
    await mongoose.disconnect();
    return;
  }

  const stripeClient = stripe(stripeKey);
  console.log("\nFetching customer subscriptions from Stripe for customer:", user.stripeCustomerId);
  
  let activeSub = null;
  try {
    const customer = await stripeClient.customers.retrieve(user.stripeCustomerId, {
      expand: ["subscriptions"],
    });

    const subs = customer.subscriptions?.data || [];
    console.log(`Found ${subs.length} subscription(s) on Stripe.`);
    for (const sub of subs) {
      console.log(`- Subscription ID: ${sub.id}`);
      console.log(`  Status: ${sub.status}`);
      console.log(`  Current Period End: ${new Date(sub.current_period_end * 1000).toISOString()}`);
      if (sub.status === "active" || sub.status === "trialing") {
        activeSub = sub;
      }
    }
  } catch (err) {
    console.error("Stripe Error:", err.message);
    if (stripeKey.startsWith("sk_test_")) {
      console.log("\n[WARNING] You are using a TEST MODE stripe key, but this customer exists in LIVE MODE on Stripe.");
      console.log("To run this successfully, please run the script with your live Stripe secret key:");
      console.log("  $env:STRIPE_SECRET_KEY='sk_live_...' ; node scripts/sync-user-stripe.js --execute");
    }
  }

  const isExecute = process.argv.includes("--execute");

  if (!activeSub) {
    console.log("\nNo active subscription found on Stripe (or unable to retrieve due to test/live mode key mismatch).");
    if (!isExecute) {
      console.log("If you know the subscription ID, you can run this script with --execute --sub-id sub_xxx to force sync.");
    }
  }

  let subIdToUse = activeSub ? activeSub.id : null;
  const forcedSubIdIndex = process.argv.indexOf("--sub-id");
  if (forcedSubIdIndex !== -1 && process.argv[forcedSubIdIndex + 1]) {
    subIdToUse = process.argv[forcedSubIdIndex + 1];
    console.log("\nForcing subscription ID from command line arguments:", subIdToUse);
  }

  if (isExecute) {
    if (!subIdToUse) {
      console.log("\n[ERROR] Cannot execute update without a subscription ID. Please fetch active subscription or supply one via --sub-id.");
      await mongoose.disconnect();
      return;
    }

    console.log("\nExecuting database update...");
    const oldBalance = user.credits.balance;
    const oldRecurring = user.credits.recurringBalance;
    const oldOneTime = user.credits.oneTimeBalance;
    
    // We want the total balance to be targetBalance (321.8935).
    // Let's keep oneTimeBalance as it is (35.8556) and set the rest as recurringBalance.
    const newOneTime = oldOneTime;
    const newRecurring = Math.max(0, parseFloat((targetBalance - newOneTime).toFixed(4)));
    const newBalance = parseFloat((newRecurring + newOneTime).toFixed(4));
    const delta = parseFloat((newBalance - oldBalance).toFixed(4));

    user.stripeSubscriptionId = subIdToUse;
    user.subscriptionStatus = "active";
    user.subscriptionTier = "premium";
    user.credits.monthlyAllowance = 500;
    user.credits.monthlyPreset = "premium";
    user.credits.recurringBalance = newRecurring;
    user.credits.oneTimeBalance = newOneTime;
    user.credits.balance = newBalance;

    if (delta > 0) {
      user.credits.lifetimeGranted = parseFloat((user.credits.lifetimeGranted + delta).toFixed(4));
    }

    await user.save();
    console.log("User document updated successfully!");

    // Log transaction
    await CreditTransaction.create({
      userId: user._id,
      type: "adjustment",
      amount: Math.abs(delta),
      balanceAfter: newBalance,
      reason: "subscription_restored",
      description: `Stripe subscription restored and credits synchronized. Expected balance: ${targetBalance}.`,
      creditRateUsd: ENV.BOOKIFY_USD_PER_CREDIT || 0.01,
      markupMultiplier: 1,
      metadata: {
        action: "restore",
        direction: delta >= 0 ? "add" : "remove",
        previousBalance: oldBalance,
        previousRecurring: oldRecurring,
        previousOneTime: oldOneTime,
        newBalance,
        newRecurring,
        newOneTime,
        subscriptionId: subIdToUse,
      }
    });
    console.log("Transaction recorded in CreditTransaction ledger.");
  } else {
    console.log("\nDry-run complete. To execute this update in the database, run with the --execute flag:");
    console.log("  node scripts/sync-user-stripe.js --execute");
  }

  await mongoose.disconnect();
}

main().catch(console.error);
