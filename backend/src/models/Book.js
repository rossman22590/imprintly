const mongoose = require("mongoose");

const imageAssetSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
    },
    prompt: {
      type: String,
      default: "",
      maxLength: [4000, "Image prompt cannot exceed 4000 characters"],
    },
    alt: {
      type: String,
      default: "",
      maxLength: [300, "Image alt text cannot exceed 300 characters"],
    },
    model: {
      type: String,
      default: "",
    },
    mimeType: {
      type: String,
      default: "image/png",
    },
    aspectRatio: {
      type: String,
      default: "",
    },
    imageSize: {
      type: String,
      default: "",
    },
    source: {
      type: String,
      enum: ["gemini"],
      default: "gemini",
    },
  },
  {
    timestamps: true,
  }
);

const chapterSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Chapter title is required"],
      trim: true,
      maxLength: [200, "Chapter title cannot exceed 200 characters"],
    },
    description: {
      type: String,
      default: "",
      maxLength: [1000, "Chapter description cannot exceed 1000 characters"],
    },
    content: {
      type: String,
      default: "",
    },
    generationStatus: {
      type: String,
      enum: ["empty", "queued", "generating", "complete", "failed"],
      default: "empty",
    },
    wordCount: {
      type: Number,
      default: 0,
    },
    outlinePath: {
      type: [String],
      default: [],
    },
    generationStats: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    images: {
      type: [imageAssetSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

const bookSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true, // speed up queries by userId
    },
    title: {
      type: String,
      required: [true, "Book title is required"],
      trim: true,
      minLength: [1, "Book title cannot be empty"],
      maxLength: [200, "Book title cannot exceed 200 characters"],
    },
    subtitle: {
      type: String,
      default: "",
      maxLength: [300, "Subtitle cannot exceed 300 characters"],
    },
    author: {
      type: String,
      required: [true, "Author name is required"],
      trim: true,
      maxLength: [100, "Author name cannot exceed 100 characters"],
    },
    coverImage: {
      type: String,
      default: "",
    },
    coverGeneration: {
      prompt: {
        type: String,
        default: "",
        maxLength: [4000, "Cover prompt cannot exceed 4000 characters"],
      },
      model: {
        type: String,
        default: "",
      },
      aspectRatio: {
        type: String,
        default: "",
      },
      imageSize: {
        type: String,
        default: "",
      },
      source: {
        type: String,
        enum: ["gemini", ""],
        default: "",
      },
      createdAt: {
        type: Date,
        default: null,
      },
    },
    chapters: [chapterSchema],
    genre: {
      type: String,
      default: "Nonfiction",
      maxLength: [100, "Genre cannot exceed 100 characters"],
    },
    audience: {
      type: String,
      default: "General readers",
      maxLength: [200, "Audience cannot exceed 200 characters"],
    },
    language: {
      type: String,
      default: "English",
      maxLength: [50, "Language cannot exceed 50 characters"],
    },
    targetWordCount: {
      type: Number,
      default: 0,
    },
    generation: {
      provider: {
        type: String,
        enum: ["gemini", "groq"],
        default: "groq",
      },
      status: {
        type: String,
        enum: [
          "manual",
          "outline",
          "queued",
          "generating",
          "cancelling",
          "cancelled",
          "complete",
          "failed",
        ],
        default: "manual",
      },
      sourcePrompt: {
        type: String,
        default: "",
      },
      style: {
        type: String,
        default: "Informative",
      },
      structureModel: {
        type: String,
        default: "",
      },
      sectionModel: {
        type: String,
        default: "",
      },
      outlineTree: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
      },
      stats: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
      },
      statsText: {
        type: String,
        default: "",
      },
      jobId: {
        type: String,
        default: "",
      },
      progress: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
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
    status: {
      type: String,
      enum: {
        values: ["draft", "published"],
        message: "Status must be either 'draft' or 'published'",
      },
      default: "draft",
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
bookSchema.index({ userId: 1, status: 1 });
bookSchema.index({ title: "text" }); // Enable text search on title

const Book = mongoose.model("Book", bookSchema);

module.exports = Book;
