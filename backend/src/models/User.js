const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minLength: [2, "Name must be at least 2 characters"],
      maxLength: [50, "Name cannot exceed 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: function (v) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: "Please enter a valid email address",
      },
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minLength: [8, "Password must be at least 8 characters"],
      validate: {
        validator: function (v) {
          // at least one uppercase, one lowercase, one number
          return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(v);
        },
        message:
          "Password must contain at least one uppercase letter, one lowercase letter, and one number",
      },
      select: false, // don't return password in queries by default
    },
    avatar: {
      type: String,
      default: "",
    },
    storeUrl: {
      type: String,
      default: "",
      trim: true,
      maxLength: [500, "Store URL cannot exceed 500 characters"],
    },
    shelfPageName: {
      type: String,
      default: "",
      trim: true,
      maxLength: [80, "Shelf page name cannot exceed 80 characters"],
    },
    shelfPhotoUrl: {
      type: String,
      default: "",
      trim: true,
      maxLength: [500, "Shelf photo URL cannot exceed 500 characters"],
    },
    publicShareMetaTitle: {
      type: String,
      default: "",
      trim: true,
      maxLength: [80, "Share meta title cannot exceed 80 characters"],
    },
    publicShareMetaDescription: {
      type: String,
      default: "",
      trim: true,
      maxLength: [180, "Share meta description cannot exceed 180 characters"],
    },
    publicShareImageUrl: {
      type: String,
      default: "",
      trim: true,
      maxLength: [500, "Share image URL cannot exceed 500 characters"],
    },
    publicShareTheme: {
      type: String,
      enum: [
        "",
        "violet-pink",
        "indigo-sky",
        "teal-lime",
        "coral-pop",
        "ocean-mint",
        "minimal-white",
        "soft-gray",
        "graphite-black",
      ],
      default: "",
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
      index: true,
    },
    passwordResetTokenHash: {
      type: String,
      default: "",
      select: false,
    },
    passwordResetTokenExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },
    credits: {
      balance: {
        type: Number,
        default: 50,
        min: [0, "Credit balance cannot be negative"],
      },
      lifetimeGranted: {
        type: Number,
        default: 50,
        min: [0, "Lifetime granted credits cannot be negative"],
      },
      lifetimeSpent: {
        type: Number,
        default: 0,
        min: [0, "Lifetime spent credits cannot be negative"],
      },
      monthlyAllowance: {
        type: Number,
        default: 0,
        min: [0, "Monthly credit allowance cannot be negative"],
      },
      monthlyPreset: {
        type: String,
        enum: ["", "premium", "ultra", "custom"],
        default: "",
      },
      monthlyResetDay: {
        type: Number,
        default: 1,
        min: [1, "Monthly reset day must be at least 1"],
        max: [1, "Monthly reset day is fixed to the 1st"],
      },
      monthlyResetKey: {
        type: String,
        default: "",
        trim: true,
        maxLength: [7, "Monthly reset key cannot exceed 7 characters"],
      },
      monthlyResetAt: {
        type: Date,
        default: null,
      },
      ledgerInitialized: {
        type: Boolean,
        default: false,
      },
      initializedAt: {
        type: Date,
        default: null,
      },
    },
    bookshelfShare: {
      token: {
        type: String,
        default: "",
        trim: true,
        maxLength: [80, "Bookshelf share token cannot exceed 80 characters"],
      },
      enabledAt: {
        type: Date,
        default: null,
      },
    },
  },
  {
    timestamps: true,
  }
);

userSchema.index(
  { "bookshelfShare.token": 1 },
  {
    unique: true,
    partialFilterExpression: { "bookshelfShare.token": { $gt: "" } },
  }
);
userSchema.index(
  { passwordResetTokenHash: 1 },
  {
    partialFilterExpression: { passwordResetTokenHash: { $gt: "" } },
  }
);

// Hash password before saving
userSchema.pre("save", async function (next) {
  // only hash if password is modified (or new)
  if (!this.isModified("password")) return next(); // move to the next middleware or save operation

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next(); // proceed to save the User document
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords during login
userSchema.methods.passwordsMatch = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", userSchema);

module.exports = User;
