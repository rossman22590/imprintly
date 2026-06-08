const mongoose = require("mongoose");

const audiobookProgressSchema = new mongoose.Schema(
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

const audiobookJobSchema = new mongoose.Schema(
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
      required: true,
      index: true,
    },
    voiceId: {
      type: String,
      default: "",
    },
    voiceName: {
      type: String,
      default: "",
    },
    modelId: {
      type: String,
      default: "",
    },
    // "all" regenerates every chapter; "chapter" regenerates a single chapter.
    scope: {
      type: String,
      enum: ["all", "chapter"],
      default: "all",
    },
    chapterIndex: {
      type: Number,
      default: null,
    },
    status: {
      type: String,
      enum: ["queued", "generating", "complete", "failed"],
      default: "queued",
      index: true,
    },
    progress: {
      type: audiobookProgressSchema,
      default: () => ({}),
    },
    creditsCharged: {
      type: Number,
      default: 0,
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

audiobookJobSchema.index({ userId: 1, createdAt: -1 });

const AudiobookJob = mongoose.model("AudiobookJob", audiobookJobSchema);

module.exports = AudiobookJob;
