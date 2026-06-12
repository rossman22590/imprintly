const ENV = require("../configs/env");
const User = require("../models/User");
const CreditTransaction = require("../models/CreditTransaction");
const { ensureUserCredits, getMonthlyResetKey, roundCredits, serializeCredits } = require("../utils/credits.service");
const { serializeProfileUser } = require("./profile.controller");
const stripe = require("stripe")(ENV.STRIPE_SECRET_KEY);

const PLAN_CREDITS = {
  starter: 100,
  premium: 500,
  ultra: 1000,
};

const PLAN_PRICES = {
  starter: 500,  // $5.00 in cents
  premium: 2500, // $25.00 in cents
  ultra: 5000,   // $50.00 in cents
};

const PLAN_ORDER = ["starter", "premium", "ultra"];
const CREDIT_UNIT_PRICE = 10; // $0.10 per credit in cents

function getPlanIndex(tier = "") {
  return PLAN_ORDER.indexOf(tier);
}

function isPlanAbove(tier, baseTier) {
  return getPlanIndex(tier) > getPlanIndex(baseTier);
}

function isPlanBelow(tier, baseTier) {
  return getPlanIndex(tier) < getPlanIndex(baseTier);
}

function getSubscriptionOverrideTier(user) {
  if (user?.subscriptionOverrideTier && PLAN_CREDITS[user.subscriptionOverrideTier]) {
    return user.subscriptionOverrideTier;
  }

  if (
    !user?.stripeSubscriptionId &&
    user?.subscriptionTier &&
    user?.subscriptionStatus &&
    user.subscriptionStatus !== "canceled" &&
    PLAN_CREDITS[user.subscriptionTier]
  ) {
    return user.subscriptionTier;
  }

  return "";
}

function getRemainingPeriodFraction(subscription, now = new Date()) {
  const periodStart = Number(subscription?.current_period_start || 0);
  const periodEnd = Number(subscription?.current_period_end || 0);
  const nowSeconds = Math.floor(now.getTime() / 1000);

  if (!periodStart || !periodEnd || periodEnd <= periodStart) {
    return 1;
  }

  const remainingSeconds = Math.max(0, periodEnd - nowSeconds);
  const periodSeconds = periodEnd - periodStart;

  return Math.min(1, Math.max(0, remainingSeconds / periodSeconds));
}

function calculateProratedCreditAdjustment(oldAllowance, newAllowance, remainingFraction) {
  const delta = Number(newAllowance || 0) - Number(oldAllowance || 0);
  const amount = roundCredits(Math.abs(delta) * remainingFraction);

  return {
    direction: delta > 0 ? "add" : delta < 0 ? "remove" : "none",
    amount,
    signedAmount: delta > 0 ? amount : delta < 0 ? -amount : 0,
  };
}

function applyCreditAdjustmentToUser(user, adjustment) {
  const amount = roundCredits(adjustment?.amount || 0);
  const direction = adjustment?.direction || "none";

  if (amount <= 0 || direction === "none") {
    return {
      applied: 0,
      previousBalance: roundCredits(user.credits.balance),
      previousRecurring: roundCredits(user.credits.recurringBalance),
      previousOneTime: roundCredits(user.credits.oneTimeBalance),
    };
  }

  const previousRecurring = roundCredits(user.credits.recurringBalance || 0);
  const previousOneTime = roundCredits(user.credits.oneTimeBalance || 0);
  const previousBalance = roundCredits(previousRecurring + previousOneTime);

  if (direction === "add") {
    user.credits.recurringBalance = roundCredits(previousRecurring + amount);
    user.credits.balance = roundCredits(user.credits.recurringBalance + previousOneTime);
    user.credits.lifetimeGranted = roundCredits((user.credits.lifetimeGranted || 0) + amount);

    return {
      applied: amount,
      previousBalance,
      previousRecurring,
      previousOneTime,
    };
  }

  if (previousBalance + 0.000001 < amount) {
    const error = new Error("Not enough credits to apply this prorated downgrade.");
    error.statusCode = 409;
    error.code = "INSUFFICIENT_PRORATED_CREDITS";
    error.requiredCredits = amount;
    error.balance = previousBalance;
    throw error;
  }

  const recurringDeduction = Math.min(previousRecurring, amount);
  const oneTimeDeduction = roundCredits(amount - recurringDeduction);

  user.credits.recurringBalance = roundCredits(previousRecurring - recurringDeduction);
  user.credits.oneTimeBalance = roundCredits(previousOneTime - oneTimeDeduction);
  user.credits.balance = roundCredits(user.credits.recurringBalance + user.credits.oneTimeBalance);

  return {
    applied: -amount,
    previousBalance,
    previousRecurring,
    previousOneTime,
  };
}

function invoiceHasProrationLines(invoice) {
  const lines = invoice?.lines?.data || [];

  return lines.some((line) => {
    const details = line?.parent?.subscription_item_details;

    return Boolean(line?.proration || details?.proration);
  });
}

function isSubscriptionRenewalInvoice(invoice) {
  if (!invoice?.subscription) return false;
  if (invoiceHasProrationLines(invoice)) return false;

  return ["subscription_create", "subscription_cycle"].includes(invoice.billing_reason);
}

function getTierFromPriceAmount(unitAmount) {
  const amount = Number(unitAmount || 0);
  const entry = Object.entries(PLAN_PRICES).find(([, price]) => price === amount);

  return entry?.[0] || "";
}

function getSubscriptionTier(stripeSub, fallbackTier = "") {
  const metadataTier = stripeSub?.metadata?.tier;
  const metadataOverrideTier = stripeSub?.metadata?.overrideTier;

  if (metadataOverrideTier && metadataTier && PLAN_CREDITS[metadataTier]) {
    return metadataTier;
  }

  const priceTier = getTierFromPriceAmount(stripeSub?.items?.data?.[0]?.price?.unit_amount);

  if (priceTier) return priceTier;

  if (metadataTier && PLAN_CREDITS[metadataTier]) return metadataTier;

  return fallbackTier && PLAN_CREDITS[fallbackTier] ? fallbackTier : "";
}

function getStripeSubscriptionOverrideTier(stripeSub, user) {
  const metadataOverrideTier = stripeSub?.metadata?.overrideTier;

  if (metadataOverrideTier && PLAN_CREDITS[metadataOverrideTier]) {
    return metadataOverrideTier;
  }

  return getSubscriptionOverrideTier(user);
}

async function createSubscriptionPriceData(tier, allowance, unitAmount, options = {}) {
  const planLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
  const name = options.overrideTier
    ? `Bookify ${planLabel} Upgrade`
    : `Bookify ${planLabel} Subscription`;
  const description = options.overrideTier
    ? `${allowance} additional recurring credits per month above ${options.overrideTier}`
    : `${allowance} recurring credits per month`;

  const product = await stripe.products.create({
    name,
    description,
    metadata: {
      tier,
      credits: String(allowance),
      ...(options.overrideTier ? { overrideTier: options.overrideTier } : {}),
    },
  });

  return {
    currency: "usd",
    recurring: { interval: "month" },
    product: product.id,
    unit_amount: unitAmount,
  };
}

async function findUserForPaidSubscription(stripeSub) {
  if (stripeSub?.id) {
    const bySubscription = await User.findOne({ stripeSubscriptionId: stripeSub.id });
    if (bySubscription) return bySubscription;
  }

  const metadataUserId = stripeSub?.metadata?.userId;
  if (metadataUserId) {
    const byMetadata = await User.findById(metadataUserId);
    if (byMetadata) return byMetadata;
  }

  if (stripeSub?.customer) {
    return User.findOne({ stripeCustomerId: stripeSub.customer });
  }

  return null;
}

async function applyPaidSubscriptionInvoice(invoice) {
  if (!invoice.subscription) return;

  const stripeSub = await stripe.subscriptions.retrieve(invoice.subscription);
  const user = await findUserForPaidSubscription(stripeSub);
  if (!user) return;

  await ensureUserCredits(user._id);

  const tier = getSubscriptionTier(stripeSub, user.subscriptionTier);
  const overrideTier = getStripeSubscriptionOverrideTier(stripeSub, user);
  const allowance = PLAN_CREDITS[tier] || 0;
  const wasAlreadySubscribed = Boolean(
    user.stripeSubscriptionId === stripeSub.id &&
    user.subscriptionTier &&
    user.subscriptionStatus &&
    user.subscriptionStatus !== "incomplete"
  );

  user.stripeCustomerId = stripeSub.customer || user.stripeCustomerId;
  user.stripeSubscriptionId = stripeSub.id;
  user.subscriptionStatus = stripeSub.status;
  user.subscriptionTier = tier || "";
  user.subscriptionOverrideTier = overrideTier || user.subscriptionOverrideTier || "";
  user.subscriptionCancelAtPeriodEnd = stripeSub.cancel_at_period_end;
  user.subscriptionCurrentPeriodEnd = stripeSub.current_period_end
    ? new Date(stripeSub.current_period_end * 1000)
    : null;
  user.credits.monthlyAllowance = allowance;
  user.credits.monthlyPreset = tier || "";
  user.credits.monthlyResetKey = getMonthlyResetKey();
  user.credits.monthlyResetAt = new Date();

  if (!isSubscriptionRenewalInvoice(invoice)) {
    await user.save();
    return;
  }

  const transactionExists = await CreditTransaction.exists({
    userId: user._id,
    "metadata.invoiceId": invoice.id,
  });

  if (transactionExists || stripeSub.cancel_at_period_end || allowance <= 0) {
    await user.save();
    return;
  }

  const previousBalance = user.credits.balance;
  const previousRecurring = user.credits.recurringBalance || 0;
  const isInitialGrant = !wasAlreadySubscribed;
  const overrideAllowance = overrideTier ? PLAN_CREDITS[overrideTier] || 0 : 0;
  const paidAllowance = overrideTier
    ? roundCredits(Math.max(0, allowance - overrideAllowance))
    : allowance;
  const nextRecurring = isInitialGrant && overrideTier
    ? Math.min(allowance, roundCredits(previousRecurring + paidAllowance))
    : allowance;
  const delta = roundCredits(nextRecurring - previousRecurring);

  user.credits.recurringBalance = nextRecurring;
  user.credits.balance = roundCredits(nextRecurring + user.credits.oneTimeBalance);

  if (delta > 0) {
    user.credits.lifetimeGranted = roundCredits(user.credits.lifetimeGranted + delta);
  }

  await user.save();

  const transactionAmount = isInitialGrant
    ? roundCredits(Math.max(delta, 0))
    : roundCredits(Math.abs(delta));

  await CreditTransaction.create({
    userId: user._id,
    type: isInitialGrant ? "grant" : "adjustment",
    amount: transactionAmount,
    balanceAfter: user.credits.balance,
    reason: isInitialGrant ? "subscription_created" : "subscription_renewal",
    description: isInitialGrant
      ? `${tier.toUpperCase()} subscription started: +${transactionAmount} recurring credits.`
      : `Subscription renewed: ${allowance} recurring credits reset.`,
    creditRateUsd: ENV.BOOKIFY_USD_PER_CREDIT,
    markupMultiplier: 1,
    metadata: {
      invoiceId: invoice.id,
      subscriptionId: stripeSub.id,
      action: isInitialGrant ? "initial_grant" : "monthly_reset",
      direction: delta < 0 ? "remove" : delta > 0 ? "add" : "none",
      previousBalance,
    },
  });
}

async function createCheckoutSession(req, res) {
  try {
    const { mode, tier, credits } = req.body;
    const userId = req.user.id;

    if (!["subscription", "payment"].includes(mode)) {
      return res.status(400).json({ error: "Invalid checkout mode." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found!" });
    }

    // Reuse or create Stripe Customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId },
      });
      customerId = customer.id;
      user.stripeCustomerId = customerId;
      await user.save();
    }

    let lineItems = [];
    let metadata = { userId, mode };
    let checkoutAmountCents = 0;
    let checkoutOverrideTier = "";

    if (mode === "subscription") {
      if (!PLAN_CREDITS[tier]) {
        return res.status(400).json({ error: "Invalid subscription tier." });
      }

      if (user.stripeSubscriptionId) {
        return res.status(400).json({ error: "Use plan management to change an active paid subscription." });
      }

      const overrideTier = getSubscriptionOverrideTier(user);
      checkoutOverrideTier = overrideTier;

      if (overrideTier && !isPlanAbove(tier, overrideTier)) {
        return res.status(400).json({
          error: `This account already includes ${overrideTier}. Choose a higher plan to upgrade.`,
        });
      }

      const priceCents = overrideTier
        ? PLAN_PRICES[tier] - PLAN_PRICES[overrideTier]
        : PLAN_PRICES[tier];
      const allowance = overrideTier
        ? PLAN_CREDITS[tier] - PLAN_CREDITS[overrideTier]
        : PLAN_CREDITS[tier];

      if (priceCents <= 0 || allowance <= 0) {
        return res.status(400).json({ error: "Invalid upgrade target for this account." });
      }
      checkoutAmountCents = priceCents;

      lineItems = [
        {
          price_data: await createSubscriptionPriceData(tier, allowance, priceCents, {
            overrideTier,
          }),
          quantity: 1,
        },
      ];
      metadata.tier = tier;
      if (overrideTier) {
        metadata.overrideTier = overrideTier;
        metadata.paidAllowance = String(allowance);
      }
    } else {
      // mode === 'payment'
      const creditCount = Number(credits);
      if (!creditCount || creditCount < 100 || creditCount > 1500 || creditCount % 100 !== 0) {
        return res.status(400).json({ error: "One-time credits must be between 100 and 1,500 in multiples of 100." });
      }

      const totalCostCents = creditCount * CREDIT_UNIT_PRICE;

      lineItems = [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${creditCount} Bookify Credits`,
              description: `One-time purchase of ${creditCount} Bookify credits`,
            },
            unit_amount: totalCostCents,
          },
          quantity: 1,
        },
      ];
      metadata.credits = String(creditCount);
    }

    if (mode === "subscription") {
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: lineItems,
        payment_behavior: "default_incomplete",
        payment_settings: { save_default_payment_method: "on_subscription" },
        metadata,
        expand: ["latest_invoice.confirmation_secret"],
      });

      const clientSecret = subscription.latest_invoice?.confirmation_secret?.client_secret;

      if (!clientSecret) {
        throw new Error("Stripe did not return a subscription confirmation client secret.");
      }

      return res.status(200).json({
        clientSecret,
        publishableKey: ENV.STRIPE_PUBLISHABLE_KEY,
        type: "subscription",
        subscriptionId: subscription.id,
        amountCents: checkoutAmountCents,
        totalAmountCents: PLAN_PRICES[tier],
        paidAllowance: overrideTier ? PLAN_CREDITS[tier] - PLAN_CREDITS[overrideTier] : PLAN_CREDITS[tier],
        overrideTier: checkoutOverrideTier,
      });
    }

    const totalCostCents = Number(metadata.credits) * CREDIT_UNIT_PRICE;
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalCostCents,
      currency: "usd",
      customer: customerId,
      automatic_payment_methods: { enabled: true },
      metadata,
    });

    return res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      publishableKey: ENV.STRIPE_PUBLISHABLE_KEY,
      type: "payment",
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return res.status(500).json({ error: "Failed to initiate Stripe checkout." });
  }
}

async function getCheckoutSessionStatus(req, res) {
  try {
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({ error: "Checkout session ID is required." });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.metadata?.userId !== req.user.id) {
      return res.status(404).json({ error: "Checkout session not found." });
    }

    return res.status(200).json({
      status: session.status,
      paymentStatus: session.payment_status,
    });
  } catch (error) {
    console.error("Error retrieving checkout session:", error);
    return res.status(500).json({ error: "Failed to retrieve checkout session." });
  }
}

async function cancelSubscription(req, res) {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user || !user.stripeSubscriptionId) {
      return res.status(400).json({ error: "No active subscription found to cancel." });
    }

    // Update in Stripe to cancel at period end
    const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    user.subscriptionCancelAtPeriodEnd = true;
    user.subscriptionStatus = subscription.status;
    user.subscriptionCurrentPeriodEnd = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000)
      : user.subscriptionCurrentPeriodEnd;

    await user.save();

    return res.status(200).json({
      message: "Subscription set to cancel at end of billing period.",
      user: serializeProfileUser(user),
    });
  } catch (error) {
    console.error("Error cancelling subscription:", error);
    return res.status(500).json({ error: "Failed to cancel subscription." });
  }
}

async function reactivateSubscription(req, res) {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user || !user.stripeSubscriptionId || !user.subscriptionCancelAtPeriodEnd) {
      return res.status(400).json({ error: "No scheduled subscription cancellation found to reactivate." });
    }

    const stripeSub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);

    const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    user.subscriptionCancelAtPeriodEnd = false;
    user.subscriptionStatus = subscription.status || stripeSub.status;
    user.subscriptionCurrentPeriodEnd = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000)
      : user.subscriptionCurrentPeriodEnd;

    // Restore allowance based on the active tier
    const tier = user.subscriptionTier;
    user.credits.monthlyAllowance = PLAN_CREDITS[tier] || 0;
    user.credits.monthlyPreset = tier;

    await user.save();

    return res.status(200).json({
      message: "Subscription reactivated successfully.",
      user: serializeProfileUser(user),
    });
  } catch (error) {
    console.error("Error reactivating subscription:", error);
    return res.status(500).json({ error: "Failed to reactivate subscription." });
  }
}

async function changeSubscription(req, res) {
  try {
    const { tier } = req.body;
    const userId = req.user.id;

    if (!PLAN_CREDITS[tier]) {
      return res.status(400).json({ error: "Invalid plan tier." });
    }

    const user = await User.findById(userId);
    if (!user || !user.stripeSubscriptionId) {
      return res.status(400).json({ error: "No active subscription found to modify." });
    }

    const currentTier = user.subscriptionTier;
    const overrideTier = getSubscriptionOverrideTier(user);

    if (overrideTier && isPlanBelow(tier, overrideTier)) {
      return res.status(400).json({
        error: `This account includes ${overrideTier}. You cannot downgrade below that plan.`,
      });
    }

    if (currentTier === tier) {
      return res.status(400).json({ error: "Already subscribed to this plan." });
    }

    const stripeSub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
    const itemId = stripeSub.items.data[0].id;
    const overrideAllowance = overrideTier ? PLAN_CREDITS[overrideTier] || 0 : 0;
    const newPriceCents = overrideTier
      ? Math.max(0, PLAN_PRICES[tier] - PLAN_PRICES[overrideTier])
      : PLAN_PRICES[tier];
    const newAllowance = PLAN_CREDITS[tier];
    const paidAllowance = overrideTier
      ? Math.max(0, PLAN_CREDITS[tier] - overrideAllowance)
      : newAllowance;
    const oldAllowance = PLAN_CREDITS[currentTier] || 0;
    const remainingFraction = getRemainingPeriodFraction(stripeSub);
    const creditAdjustment = calculateProratedCreditAdjustment(
      oldAllowance,
      newAllowance,
      remainingFraction
    );

    let adjustmentResult = null;

    if (creditAdjustment.direction === "remove") {
      adjustmentResult = applyCreditAdjustmentToUser(user, creditAdjustment);
    }

    const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
      items: [
        {
          id: itemId,
          price_data: await createSubscriptionPriceData(tier, paidAllowance, newPriceCents, {
            overrideTier,
          }),
        },
      ],
      metadata: {
        ...stripeSub.metadata,
        userId,
        mode: "subscription",
        tier,
        ...(overrideTier ? { overrideTier } : {}),
      },
      cancel_at_period_end: false,
      payment_behavior: "error_if_incomplete",
      proration_behavior: "always_invoice",
    });

    user.subscriptionTier = tier;
    user.subscriptionStatus = subscription.status;
    user.subscriptionCurrentPeriodEnd = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000)
      : user.subscriptionCurrentPeriodEnd;
    user.credits.monthlyAllowance = newAllowance;
    user.credits.monthlyPreset = tier;
    user.subscriptionCancelAtPeriodEnd = false;

    if (creditAdjustment.direction === "add") {
      adjustmentResult = applyCreditAdjustmentToUser(user, creditAdjustment);
    }

    if (!adjustmentResult) {
      adjustmentResult = {
        applied: 0,
        previousBalance: roundCredits(user.credits.balance),
        previousRecurring: roundCredits(user.credits.recurringBalance),
        previousOneTime: roundCredits(user.credits.oneTimeBalance),
      };
    }

    await user.save();

    if (creditAdjustment.amount > 0) {
      const isUpgrade = creditAdjustment.direction === "add";

      await CreditTransaction.create({
        userId,
        type: isUpgrade ? "grant" : "adjustment",
        amount: creditAdjustment.amount,
        balanceAfter: user.credits.balance,
        reason: isUpgrade ? "subscription_upgrade" : "subscription_downgrade",
        description: isUpgrade
          ? `Subscription upgraded to ${tier.toUpperCase()}: +${creditAdjustment.amount} prorated credits granted.`
          : `Subscription downgraded to ${tier.toUpperCase()}: -${creditAdjustment.amount} prorated credits removed.`,
        creditRateUsd: ENV.BOOKIFY_USD_PER_CREDIT,
        markupMultiplier: 1,
        metadata: {
          subscriptionId: user.stripeSubscriptionId,
          previousTier: currentTier,
          nextTier: tier,
          oldAllowance,
          newAllowance,
          remainingFraction,
          action: "plan_change_proration",
          direction: creditAdjustment.direction,
          previousBalance: adjustmentResult.previousBalance,
          previousRecurring: adjustmentResult.previousRecurring,
          previousOneTime: adjustmentResult.previousOneTime,
        },
      });
    }

    return res.status(200).json({
      message: `Successfully switched plan to ${tier}.`,
      user: serializeProfileUser(user),
    });
  } catch (error) {
    console.error("Error switching plans:", error);

    if (error.statusCode) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
        requiredCredits: error.requiredCredits,
        balance: error.balance,
      });
    }

    return res.status(500).json({ error: "Failed to switch subscription plans." });
  }
}

async function stripeWebhook(req, res) {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.rawBody,
      sig,
      ENV.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const { userId, mode, tier, credits } = session.metadata;

        if (!userId) break;

        const user = await User.findById(userId);
        if (!user) break;

        await ensureUserCredits(userId);

        if (mode === "subscription") {
          const subscription = await stripe.subscriptions.retrieve(session.subscription);
          const allowance = PLAN_CREDITS[tier] || 0;

          user.stripeCustomerId = session.customer;
          user.stripeSubscriptionId = session.subscription;
          user.subscriptionStatus = subscription.status;
          user.subscriptionTier = tier;
          user.subscriptionCancelAtPeriodEnd = subscription.cancel_at_period_end;
          user.subscriptionCurrentPeriodEnd = new Date(subscription.current_period_end * 1000);
          user.credits.monthlyAllowance = allowance;
          user.credits.monthlyPreset = tier;

          // Grant initial recurring credits
          user.credits.recurringBalance = allowance;
          user.credits.balance = roundCredits(allowance + user.credits.oneTimeBalance);
          user.credits.lifetimeGranted = roundCredits(user.credits.lifetimeGranted + allowance);

          await user.save();

          await CreditTransaction.create({
            userId,
            type: "grant",
            amount: allowance,
            balanceAfter: user.credits.balance,
            reason: "subscription_created",
            description: `${tier.toUpperCase()} subscription started: +${allowance} recurring credits.`,
            creditRateUsd: ENV.BOOKIFY_USD_PER_CREDIT,
            markupMultiplier: 1,
            metadata: { subscriptionId: subscription.id },
          });
        } else if (mode === "payment") {
          const purchasedCredits = Number(credits);
          user.credits.oneTimeBalance = roundCredits(user.credits.oneTimeBalance + purchasedCredits);
          user.credits.balance = roundCredits(user.credits.recurringBalance + user.credits.oneTimeBalance);
          user.credits.lifetimeGranted = roundCredits(user.credits.lifetimeGranted + purchasedCredits);

          await user.save();

          await CreditTransaction.create({
            userId,
            type: "grant",
            amount: purchasedCredits,
            balanceAfter: user.credits.balance,
            reason: "one_time_credit_purchase",
            description: `Purchased ${purchasedCredits} one-time credits.`,
            creditRateUsd: ENV.BOOKIFY_USD_PER_CREDIT,
            markupMultiplier: 1,
            metadata: { sessionId: session.id },
          });
        }
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;
        const { userId, mode, credits } = paymentIntent.metadata || {};

        if (mode !== "payment" || !userId) break;

        const purchasedCredits = Number(credits);
        if (!purchasedCredits) break;

        const user = await User.findById(userId);
        if (!user) break;

        await ensureUserCredits(userId);

        const transactionExists = await CreditTransaction.exists({
          userId,
          "metadata.paymentIntentId": paymentIntent.id,
        });

        if (transactionExists) break;

        user.credits.oneTimeBalance = roundCredits(user.credits.oneTimeBalance + purchasedCredits);
        user.credits.balance = roundCredits(user.credits.recurringBalance + user.credits.oneTimeBalance);
        user.credits.lifetimeGranted = roundCredits(user.credits.lifetimeGranted + purchasedCredits);

        await user.save();

        await CreditTransaction.create({
          userId,
          type: "grant",
          amount: purchasedCredits,
          balanceAfter: user.credits.balance,
          reason: "one_time_credit_purchase",
          description: `Purchased ${purchasedCredits} one-time credits.`,
          creditRateUsd: ENV.BOOKIFY_USD_PER_CREDIT,
          markupMultiplier: 1,
          metadata: { paymentIntentId: paymentIntent.id },
        });
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object;
        await applyPaidSubscriptionInvoice(invoice);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const user = await User.findOne({ stripeSubscriptionId: subscription.id });
        if (!user) break;

        const tier = getSubscriptionTier(subscription, user.subscriptionTier);

        user.subscriptionStatus = subscription.status;
        user.subscriptionCancelAtPeriodEnd = subscription.cancel_at_period_end;
        user.subscriptionCurrentPeriodEnd = new Date(subscription.current_period_end * 1000);

        if (tier && PLAN_CREDITS[tier]) {
          user.subscriptionTier = tier;
          user.credits.monthlyAllowance = PLAN_CREDITS[tier];
          user.credits.monthlyPreset = tier;
        }

        await user.save();
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const user = await User.findOne({ stripeSubscriptionId: subscription.id });
        if (!user) break;

        const prevBalance = user.credits.balance;
        const overrideTier = getStripeSubscriptionOverrideTier(subscription, user);

        if (overrideTier && PLAN_CREDITS[overrideTier]) {
          const allowance = PLAN_CREDITS[overrideTier];

          user.stripeSubscriptionId = "";
          user.subscriptionStatus = "active";
          user.subscriptionTier = overrideTier;
          user.subscriptionOverrideTier = overrideTier;
          user.subscriptionCancelAtPeriodEnd = false;
          user.subscriptionCurrentPeriodEnd = null;
          user.credits.monthlyAllowance = allowance;
          user.credits.monthlyPreset = overrideTier;
          user.credits.recurringBalance = Math.min(
            roundCredits(user.credits.recurringBalance || 0),
            allowance
          );
          user.credits.balance = roundCredits(user.credits.recurringBalance + user.credits.oneTimeBalance);

          await user.save();

          await CreditTransaction.create({
            userId: user._id,
            type: "adjustment",
            amount: 0,
            balanceAfter: user.credits.balance,
            reason: "subscription_ended",
            description: `Paid subscription ended. Account returned to ${overrideTier.toUpperCase()} admin override.`,
            creditRateUsd: ENV.BOOKIFY_USD_PER_CREDIT,
            markupMultiplier: 1,
            metadata: {
              subscriptionId: subscription.id,
              overrideTier,
              previousBalance: prevBalance,
            },
          });
          break;
        }

        user.subscriptionStatus = "canceled";
        user.subscriptionTier = "";
        user.subscriptionOverrideTier = "";
        user.subscriptionCancelAtPeriodEnd = false;
        user.credits.monthlyAllowance = 0;
        user.credits.monthlyPreset = "";
        user.credits.recurringBalance = 0;
        user.credits.balance = user.credits.oneTimeBalance;

        await user.save();

        await CreditTransaction.create({
          userId: user._id,
          type: "adjustment",
          amount: 0,
          balanceAfter: user.credits.balance,
          reason: "subscription_ended",
          description: "Subscription canceled and ended. Unused recurring credits expired.",
          creditRateUsd: ENV.BOOKIFY_USD_PER_CREDIT,
          markupMultiplier: 1,
          metadata: {
            subscriptionId: subscription.id,
            previousBalance: prevBalance,
          },
        });
        break;
      }
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Webhook processing failed:", error);
    return res.status(500).json({ error: "Webhook event processing failed." });
  }
}

module.exports = {
  createCheckoutSession,
  getCheckoutSessionStatus,
  cancelSubscription,
  reactivateSubscription,
  changeSubscription,
  stripeWebhook,
};
