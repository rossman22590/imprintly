const mongoose = require("mongoose");

const progressSchema = new mongoose.Schema(
  {
    total: {
      type: Number,
      default: 0,
    },
    completed: {
      type: Number,
      default: 0,
    },
    failed: {
      type: Number,
      default: 0,
    },
    currentChapterIndex: {
      type: Number,
      default: null,
    },
    currentChapterTitle: {
      type: String,
      default: "",
    },
    message: {
      type: String,
      default: "Queued",
    },
  },
  { _id: false }
);

const generationJobSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    bookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Book",
      default: null,
      index: true,
    },
    provider: {
      type: String,
      enum: ["gemini", "groq"],
      required: true,
      default: "groq",
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    retryFailedOnly: {
      type: Boolean,
      default: false,
    },
    cancelled: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: [
        "queued",
        "generating",
        "cancelling",
        "cancelled",
        "complete",
        "failed",
      ],
      default: "queued",
      index: true,
    },
    progress: {
      type: progressSchema,
      default: () => ({}),
    },
    failedChapters: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    error: {
      type: String,
      default: "",
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

generationJobSchema.index({ userId: 1, createdAt: -1 });
generationJobSchema.index({ status: 1, updatedAt: 1 });

const GenerationJob = mongoose.model("GenerationJob", generationJobSchema);

module.exports = GenerationJob;
