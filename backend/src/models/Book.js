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

const visualReferenceSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: "",
      maxLength: [100, "Reference ID cannot exceed 100 characters"],
    },
    name: {
      type: String,
      default: "",
      maxLength: [120, "Reference name cannot exceed 120 characters"],
    },
    label: {
      type: String,
      default: "",
      maxLength: [120, "Reference label cannot exceed 120 characters"],
    },
    description: {
      type: String,
      default: "",
      maxLength: [1200, "Reference description cannot exceed 1200 characters"],
    },
    imageUrl: {
      type: String,
      default: "",
    },
    kind: {
      type: String,
      enum: ["character", "style", "world", "reference"],
      default: "reference",
    },
  },
  {
    _id: false,
  }
);

const visualBibleSchema = new mongoose.Schema(
  {
    enabled: {
      type: Boolean,
      default: true,
    },
    matchBookStyle: {
      type: Boolean,
      default: true,
    },
    characters: {
      type: [visualReferenceSchema],
      default: [],
    },
    styleReferences: {
      type: [visualReferenceSchema],
      default: [],
    },
    worldReferences: {
      type: [visualReferenceSchema],
      default: [],
    },
    notes: {
      type: String,
      default: "",
      maxLength: [2000, "Visual bible notes cannot exceed 2000 characters"],
    },
    updatedAt: {
      type: Date,
      default: null,
    },
  },
  {
    _id: false,
  }
);

const sourceFileSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: "",
      maxLength: [80, "Source file ID cannot exceed 80 characters"],
    },
    name: {
      type: String,
      default: "",
      maxLength: [180, "Source file name cannot exceed 180 characters"],
    },
    url: {
      type: String,
      default: "",
    },
    mimeType: {
      type: String,
      default: "",
      maxLength: [120, "Source file type cannot exceed 120 characters"],
    },
    size: {
      type: Number,
      default: 0,
    },
    extractedText: {
      type: String,
      default: "",
      maxLength: [60000, "Source file text cannot exceed 60000 characters"],
    },
    textPreview: {
      type: String,
      default: "",
      maxLength: [1800, "Source file preview cannot exceed 1800 characters"],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false,
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

const kdpSettingsSchema = new mongoose.Schema(
  {
    format: {
      type: String,
      enum: ["ebook", "paperback", "hardcover"],
      default: "paperback",
    },
    trimSize: {
      type: String,
      default: "6x9",
      maxLength: [30, "Trim size cannot exceed 30 characters"],
    },
    paperType: {
      type: String,
      default: "bw-white",
      maxLength: [50, "Paper type cannot exceed 50 characters"],
    },
    pageCountOverride: {
      type: String,
      default: "",
      maxLength: [20, "Page count override cannot exceed 20 characters"],
    },
    fontSize: {
      type: String,
      default: "12",
      maxLength: [10, "Font size cannot exceed 10 characters"],
    },
    interiorBleed: {
      type: String,
      default: "none",
      maxLength: [20, "Interior bleed setting cannot exceed 20 characters"],
    },
    marginTop: {
      type: String,
      default: "",
      maxLength: [10, "Top margin cannot exceed 10 characters"],
    },
    marginBottom: {
      type: String,
      default: "",
      maxLength: [10, "Bottom margin cannot exceed 10 characters"],
    },
    marginInside: {
      type: String,
      default: "",
      maxLength: [10, "Inside margin cannot exceed 10 characters"],
    },
    marginOutside: {
      type: String,
      default: "",
      maxLength: [10, "Outside margin cannot exceed 10 characters"],
    },
    lineSpacing: {
      type: String,
      default: "1.44",
      maxLength: [10, "Line spacing cannot exceed 10 characters"],
    },
    paragraphIndent: {
      type: String,
      default: "1.35",
      maxLength: [10, "Paragraph indent cannot exceed 10 characters"],
    },
    renderDiagrams: {
      type: String,
      default: "false",
      maxLength: [10, "Diagram rendering setting cannot exceed 10 characters"],
    },
    coverImageSize: {
      type: String,
      default: "2K",
      maxLength: [10, "Cover image size cannot exceed 10 characters"],
    },
    tocDesign: {
      type: String,
      default: "basic",
      maxLength: [30, "TOC design cannot exceed 30 characters"],
    },
  },
  {
    _id: false,
  }
);

const kdpAssetsSchema = new mongoose.Schema(
  {
    tableOfContents: {
      type: String,
      default: "",
      maxLength: [20000, "Table of contents cannot exceed 20000 characters"],
    },
    description: {
      type: String,
      default: "",
      maxLength: [20000, "Description cannot exceed 20000 characters"],
    },
    keywords: {
      type: String,
      default: "",
      maxLength: [5000, "Keywords cannot exceed 5000 characters"],
    },
    categories: {
      type: String,
      default: "",
      maxLength: [10000, "Categories cannot exceed 10000 characters"],
    },
    backCoverBlurb: {
      type: String,
      default: "",
      maxLength: [12000, "Back cover blurb cannot exceed 12000 characters"],
    },
    authorBio: {
      type: String,
      default: "",
      maxLength: [12000, "Author biography cannot exceed 12000 characters"],
    },
    copyrightPage: {
      type: String,
      default: "",
      maxLength: [12000, "Copyright page cannot exceed 12000 characters"],
    },
    coverPrompt: {
      type: String,
      default: "",
      maxLength: [12000, "Cover prompt cannot exceed 12000 characters"],
    },
    riskNotes: {
      type: String,
      default: "",
      maxLength: [20000, "Risk notes cannot exceed 20000 characters"],
    },
  },
  {
    _id: false,
  }
);

const communityListingSchema = new mongoose.Schema(
  {
    isListed: {
      type: Boolean,
      default: false,
    },
    listedAt: {
      type: Date,
      default: null,
    },
    purchaseUrl: {
      type: String,
      default: "",
      trim: true,
      maxLength: [500, "Purchase URL cannot exceed 500 characters"],
    },
    freeFullPdfEnabled: {
      type: Boolean,
      default: false,
    },
    freeFullPdfEnabledAt: {
      type: Date,
      default: null,
    },
  },
  {
    _id: false,
  }
);

const bookBibleSchema = new mongoose.Schema(
  {
    source: {
      type: String,
      default: "",
      maxLength: [12000, "Source bible cannot exceed 12000 characters"],
    },
    characters: {
      type: String,
      default: "",
      maxLength: [12000, "Characters bible cannot exceed 12000 characters"],
    },
    locations: {
      type: String,
      default: "",
      maxLength: [12000, "Locations bible cannot exceed 12000 characters"],
    },
    worldRules: {
      type: String,
      default: "",
      maxLength: [12000, "World rules bible cannot exceed 12000 characters"],
    },
    timeline: {
      type: String,
      default: "",
      maxLength: [12000, "Timeline bible cannot exceed 12000 characters"],
    },
    styleGuide: {
      type: String,
      default: "",
      maxLength: [12000, "Style guide cannot exceed 12000 characters"],
    },
    canonFacts: {
      type: String,
      default: "",
      maxLength: [12000, "Canon facts cannot exceed 12000 characters"],
    },
    unresolvedThreads: {
      type: String,
      default: "",
      maxLength: [12000, "Unresolved threads cannot exceed 12000 characters"],
    },
    notes: {
      type: String,
      default: "",
      maxLength: [12000, "Bible notes cannot exceed 12000 characters"],
    },
    updatedAt: {
      type: Date,
      default: null,
    },
  },
  {
    _id: false,
  }
);

const audiobookChapterVersionSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
    },
    audioUrl: {
      type: String,
      default: "",
    },
    duration: {
      type: Number,
      default: 0,
    },
    charCount: {
      type: Number,
      default: 0,
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
    createdAt: {
      type: Date,
      default: null,
    },
  },
  {
    _id: false,
  }
);

const audiobookChapterSchema = new mongoose.Schema(
  {
    chapterIndex: {
      type: Number,
      default: 0,
    },
    title: {
      type: String,
      default: "",
    },
    script: {
      type: String,
      default: "",
    },
    audioUrl: {
      type: String,
      default: "",
    },
    duration: {
      type: Number,
      default: 0,
    },
    charCount: {
      type: Number,
      default: 0,
    },
    activeVersionId: {
      type: String,
      default: "",
    },
    versions: {
      type: [audiobookChapterVersionSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ["empty", "queued", "generating", "complete", "failed"],
      default: "empty",
    },
    error: {
      type: String,
      default: "",
    },
    updatedAt: {
      type: Date,
      default: null,
    },
  },
  {
    _id: false,
  }
);

const audiobookIntroSchema = new mongoose.Schema(
  {
    mode: {
      type: String,
      enum: ["none", "generated", "recorded"],
      default: "none",
    },
    script: {
      type: String,
      default: "",
      maxLength: [8000, "Intro script cannot exceed 8000 characters"],
    },
    audioUrl: {
      type: String,
      default: "",
    },
    duration: {
      type: Number,
      default: 0,
    },
    charCount: {
      type: Number,
      default: 0,
    },
    activeVersionId: {
      type: String,
      default: "",
    },
    versions: {
      type: [audiobookChapterVersionSchema],
      default: [],
    },
    updatedAt: {
      type: Date,
      default: null,
    },
  },
  {
    _id: false,
  }
);

const audiobookSchema = new mongoose.Schema(
  {
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
    status: {
      type: String,
      enum: ["empty", "queued", "generating", "complete", "failed"],
      default: "empty",
    },
    jobId: {
      type: String,
      default: "",
    },
    progress: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    intro: {
      type: audiobookIntroSchema,
      default: () => ({}),
    },
    chapters: {
      type: [audiobookChapterSchema],
      default: [],
    },
    totalDuration: {
      type: Number,
      default: 0,
    },
    lastGeneratedAt: {
      type: Date,
      default: null,
    },
  },
  {
    _id: false,
  }
);

const translatedChapterSchema = new mongoose.Schema(
  {
    chapterId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Chapter ID is required"],
    },
    originalChapterId: {
      type: String,
      default: function() {
        return this.chapterId ? this.chapterId.toString() : "";
      }
    },
    title: {
      type: String,
      default: "",
    },
    content: {
      type: String,
      default: "",
    },
    translationStatus: {
      type: String,
      enum: {
        values: ["queued", "translating", "complete", "failed"],
        message: "Translation status must be queued, translating, complete, or failed",
      },
      default: "queued",
    },
    status: {
      type: String,
      enum: ["empty", "translating", "complete", "failed"],
      default: "empty"
    },
    wordCount: {
      type: Number,
      default: 0,
    },
    translationStats: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const translationSchema = new mongoose.Schema(
  {
    targetLanguage: {
      type: String,
      required: [true, "Target language is required"],
      trim: true,
    },
    engine: {
      type: String,
      required: [true, "Translation engine is required"],
      enum: {
        values: ["gemini", "groq"],
        message: "Translation engine must be gemini or groq",
      },
    },
    model: {
      type: String,
      required: [true, "Translation model is required"],
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    title: {
      type: String,
      default: "",
    },
    subtitle: {
      type: String,
      default: "",
    },
    chapters: {
      type: [translatedChapterSchema],
      default: [],
    },
    audiobook: {
      type: audiobookSchema,
      default: () => ({}),
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
      mode: {
        type: String,
        enum: ["generated", "edited", ""],
        default: "",
      },
      customPrompt: {
        type: String,
        default: "",
        maxLength: [4000, "Cover custom prompt cannot exceed 4000 characters"],
      },
      previousCoverImage: {
        type: String,
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
      useGoogleSearch: {
        type: Boolean,
        default: false,
      },
      includeTextGraphics: {
        type: Boolean,
        default: false,
      },
      includeImages: {
        type: Boolean,
        default: false,
      },
      chapterLength: {
        type: String,
        enum: ["small", "medium", "large"],
        default: "medium",
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
    kdp: {
      settings: {
        type: kdpSettingsSchema,
        default: () => ({}),
      },
      assets: {
        type: kdpAssetsSchema,
        default: () => ({}),
      },
      updatedAt: {
        type: Date,
        default: null,
      },
    },
    audiobook: {
      type: audiobookSchema,
      default: () => ({}),
    },
    translations: {
      type: [translationSchema],
      default: [],
    },
    bible: {
      type: bookBibleSchema,
      default: () => ({}),
    },
    sourceFiles: {
      type: [sourceFileSchema],
      default: [],
    },
    visualBible: {
      type: visualBibleSchema,
      default: () => ({}),
    },
    status: {
      type: String,
      enum: {
        values: ["draft", "published"],
        message: "Status must be either 'draft' or 'published'",
      },
      default: "draft",
    },
    previewShare: {
      token: {
        type: String,
        default: "",
        trim: true,
        maxLength: [80, "Preview share token cannot exceed 80 characters"],
      },
      enabledAt: {
        type: Date,
        default: null,
      },
    },
    communityListing: {
      type: communityListingSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
bookSchema.index({ userId: 1, status: 1 });
bookSchema.index({ title: "text" }); // Enable text search on title
bookSchema.index({
  "communityListing.isListed": 1,
  "communityListing.listedAt": -1,
});
bookSchema.index(
  { "previewShare.token": 1 },
  {
    unique: true,
    partialFilterExpression: { "previewShare.token": { $gt: "" } },
  }
);

const Book = mongoose.model("Book", bookSchema);

module.exports = Book;
