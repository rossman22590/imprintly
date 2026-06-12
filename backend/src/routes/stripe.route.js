const express = require("express");
const {
  createCheckoutSession,
  getCheckoutSessionStatus,
  cancelSubscription,
  reactivateSubscription,
  changeSubscription,
  stripeWebhook,
} = require("../controllers/stripe.controller");
const { authenticate } = require("../middlewares/auth.middleware");

const router = express.Router();

// Public webhook endpoint (Stripe signature verification is performed inside the controller)
router.post("/webhook", stripeWebhook);

// Protected Stripe endpoints
router.use(authenticate);
router.post("/create-checkout-session", createCheckoutSession);
router.get("/checkout-session-status", getCheckoutSessionStatus);
router.post("/cancel-subscription", cancelSubscription);
router.post("/reactivate-subscription", reactivateSubscription);
router.post("/change-subscription", changeSubscription);

module.exports = router;
