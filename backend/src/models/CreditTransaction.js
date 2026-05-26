const mongoose = require("mongoose");

const creditTransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["grant", "debit", "refund", "adjustment"],
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0, "Credit amount cannot be negative"],
    },
    balanceAfter: {
      type: Number,
      required: true,
      min: [0, "Credit balance cannot be negative"],
    },
    reason: {
      type: String,
      default: "",
      maxLength: [120, "Credit reason cannot exceed 120 characters"],
      index: true,
    },
    description: {
      type: String,
      default: "",
      maxLength: [400, "Credit description cannot exceed 400 characters"],
    },
    provider: {
      type: String,
      default: "",
      maxLength: [40, "Provider cannot exceed 40 characters"],
    },
    model: {
      type: String,
      default: "",
      maxLength: [120, "Model cannot exceed 120 characters"],
    },
    usage: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    usdCost: {
      type: Number,
      default: 0,
      min: [0, "USD cost cannot be negative"],
    },
    creditRateUsd: {
      type: Number,
      default: 0,
      min: [0, "Credit rate cannot be negative"],
    },
    markupMultiplier: {
      type: Number,
      default: 1,
      min: [0, "Markup cannot be negative"],
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

creditTransactionSchema.index({ userId: 1, createdAt: -1 });

const CreditTransaction = mongoose.model(
  "CreditTransaction",
  creditTransactionSchema
);

module.exports = CreditTransaction;
