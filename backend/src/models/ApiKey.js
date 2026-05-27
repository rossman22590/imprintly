const mongoose = require("mongoose");

const apiKeySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxLength: [80, "API key name cannot exceed 80 characters"],
    },
    keyHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
      select: false,
    },
    prefix: {
      type: String,
      required: true,
      trim: true,
      maxLength: [20, "API key prefix cannot exceed 20 characters"],
    },
    last4: {
      type: String,
      required: true,
      trim: true,
      maxLength: [4, "API key suffix cannot exceed 4 characters"],
    },
    lastUsedAt: {
      type: Date,
      default: null,
    },
    revokedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

apiKeySchema.index({ userId: 1, createdAt: -1 });
apiKeySchema.index({ userId: 1, revokedAt: 1 });

const ApiKey = mongoose.model("ApiKey", apiKeySchema);

module.exports = ApiKey;
