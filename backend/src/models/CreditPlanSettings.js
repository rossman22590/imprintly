const mongoose = require("mongoose");

const creditPlanSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: "monthly-credit-plans",
    },
    plans: {
      premium: {
        monthlyCredits: {
          type: Number,
          default: 500,
          min: [0, "Premium monthly credits cannot be negative"],
        },
      },
      ultra: {
        monthlyCredits: {
          type: Number,
          default: 1000,
          min: [0, "Ultra monthly credits cannot be negative"],
        },
      },
    },
  },
  {
    timestamps: true,
  }
);

const CreditPlanSettings = mongoose.model(
  "CreditPlanSettings",
  creditPlanSettingsSchema
);

module.exports = CreditPlanSettings;
