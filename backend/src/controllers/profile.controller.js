const User = require("../models/User");
const fs = require("fs");
const { syncUserAdminRole } = require("../utils/admin.service");
const { ensureUserCredits, serializeCredits } = require("../utils/credits.service");
const { generateShareToken } = require("../utils/share-token");
const {
  assertUploadedImageFile,
  deleteUploadFile,
} = require("../utils/upload-paths");
const { uploadImageFileToStorage } = require("../utils/image-storage");

const PUBLIC_SHARE_THEMES = new Set([
  "",
  "violet-pink",
  "indigo-sky",
  "teal-lime",
  "coral-pop",
  "ocean-mint",
  "minimal-white",
  "soft-gray",
  "graphite-black",
]);

function serializeBookshelfShare(user) {
  const token = user?.bookshelfShare?.token || "";

  if (!token) return null;

  return {
    token,
    enabledAt: user.bookshelfShare.enabledAt,
  };
}

function serializeProfileUser(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    storeUrl: user.storeUrl || "",
    shelfPageName: user.shelfPageName || "",
    shelfPhotoUrl: user.shelfPhotoUrl || "",
    publicShareMetaTitle: user.publicShareMetaTitle || "",
    publicShareMetaDescription: user.publicShareMetaDescription || "",
    publicShareImageUrl: user.publicShareImageUrl || "",
    publicShareTheme: user.publicShareTheme || "",
    role: user.role,
    status: user.status || "active",
    credits: serializeCredits(user),
    bookshelfShare: serializeBookshelfShare(user),
    stripeCustomerId: user.stripeCustomerId || "",
    stripeSubscriptionId: user.stripeSubscriptionId || "",
    subscriptionStatus: user.subscriptionStatus || "",
    subscriptionTier: user.subscriptionTier || "",
    subscriptionOverrideTier: user.subscriptionOverrideTier || "",
    subscriptionCancelAtPeriodEnd: user.subscriptionCancelAtPeriodEnd || false,
    subscriptionCurrentPeriodEnd: user.subscriptionCurrentPeriodEnd || null,
  };
}

function normalizePublicShareTheme(value = "") {
  const theme = String(value || "").trim();

  return PUBLIC_SHARE_THEMES.has(theme) ? theme : null;
}

function normalizeStoreUrl(value = "") {
  return normalizeOptionalHttpUrl(value);
}

function normalizeShelfPhotoUrl(value = "") {
  return normalizeOptionalHttpUrl(value);
}

function normalizePublicShareImageUrl(value = "") {
  return normalizeOptionalHttpUrl(value);
}

function normalizeOptionalHttpUrl(value = "") {
  const trimmed = String(value || "").trim();

  if (!trimmed) return "";

  const normalized = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsed = new URL(normalized);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return null;
    }

    return parsed.href.length <= 500 ? parsed.href : null;
  } catch {
    return null;
  }
}

function normalizeShelfPageName(value = "") {
  return normalizeOptionalText(value, 80);
}

function normalizePublicShareMetaTitle(value = "") {
  return normalizeOptionalText(value, 80);
}

function normalizePublicShareMetaDescription(value = "") {
  return normalizeOptionalText(value, 180);
}

function normalizeOptionalText(value = "", maxLength = 80) {
  const trimmed = String(value || "").trim();

  if (!trimmed) return "";

  return trimmed.length <= maxLength ? trimmed : null;
}

async function getUniqueBookshelfShareToken() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = generateShareToken("shelf");
    const tokenExists = await User.exists({ "bookshelfShare.token": token });

    if (!tokenExists) return token;
  }

  throw new Error("Could not create a unique bookshelf link.");
}

/**
 * Get user profile
 * @access Private
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<Object>}
 */
async function getProfile(req, res) {
  try {
    const user = await ensureUserCredits(req.user.id);
    await syncUserAdminRole(user);

    if (!user) {
      return res.status(404).json({ error: "User not found!" });
    }

    return res.status(200).json({
      message: "User profile found!",
      user: serializeProfileUser(user),
    });
  } catch (error) {
    console.error("Error getting user profile:", error);
    return res.status(500).json({ error: "Internal Server Error!" });
  }
}

/**
 * Update user profile
 * @access Private
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<Object>}
 */
async function updateProfile(req, res) {
  try {
    const {
      name,
      storeUrl,
      publicShareTheme,
      shelfPageName,
      shelfPhotoUrl,
      publicShareMetaTitle,
      publicShareMetaDescription,
      publicShareImageUrl,
    } = req.body;

    if (
      !name &&
      storeUrl === undefined &&
      publicShareTheme === undefined &&
      shelfPageName === undefined &&
      shelfPhotoUrl === undefined &&
      publicShareMetaTitle === undefined &&
      publicShareMetaDescription === undefined &&
      publicShareImageUrl === undefined
    ) {
      return res.status(400).json({
        error: "Please provide profile details to update!",
      });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ error: "User not found!" });
    }

    // Update fields if provided
    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length < 2) {
        return res.status(400).json({
          error: "Name must be at least 2 characters!",
        });
      }

      if (name.trim().length > 50) {
        return res.status(400).json({
          error: "Name cannot exceed 50 characters!",
        });
      }

      user.name = name.trim();
    }

    if (storeUrl !== undefined) {
      const normalizedStoreUrl = normalizeStoreUrl(storeUrl);

      if (normalizedStoreUrl === null) {
        return res.status(400).json({
          error: "Please enter a valid store URL.",
        });
      }

      user.storeUrl = normalizedStoreUrl;
    }

    if (shelfPageName !== undefined) {
      const normalizedShelfPageName = normalizeShelfPageName(shelfPageName);

      if (normalizedShelfPageName === null) {
        return res.status(400).json({
          error: "Shelf page name cannot exceed 80 characters.",
        });
      }

      user.shelfPageName = normalizedShelfPageName;
    }

    if (shelfPhotoUrl !== undefined) {
      const normalizedShelfPhotoUrl = normalizeShelfPhotoUrl(shelfPhotoUrl);

      if (normalizedShelfPhotoUrl === null) {
        return res.status(400).json({
          error: "Please enter a valid shelf photo URL.",
        });
      }

      user.shelfPhotoUrl = normalizedShelfPhotoUrl;
    }

    if (publicShareMetaTitle !== undefined) {
      const normalizedMetaTitle =
        normalizePublicShareMetaTitle(publicShareMetaTitle);

      if (normalizedMetaTitle === null) {
        return res.status(400).json({
          error: "Share meta title cannot exceed 80 characters.",
        });
      }

      user.publicShareMetaTitle = normalizedMetaTitle;
    }

    if (publicShareMetaDescription !== undefined) {
      const normalizedMetaDescription =
        normalizePublicShareMetaDescription(publicShareMetaDescription);

      if (normalizedMetaDescription === null) {
        return res.status(400).json({
          error: "Share meta description cannot exceed 180 characters.",
        });
      }

      user.publicShareMetaDescription = normalizedMetaDescription;
    }

    if (publicShareImageUrl !== undefined) {
      const normalizedShareImageUrl =
        normalizePublicShareImageUrl(publicShareImageUrl);

      if (normalizedShareImageUrl === null) {
        return res.status(400).json({
          error: "Please enter a valid share image URL.",
        });
      }

      user.publicShareImageUrl = normalizedShareImageUrl;
    }

    if (publicShareTheme !== undefined) {
      const normalizedTheme = normalizePublicShareTheme(publicShareTheme);

      if (normalizedTheme === null) {
        return res.status(400).json({
          error: "Please choose a valid share page color.",
        });
      }

      user.publicShareTheme = normalizedTheme;
    }

    const updatedUser = await user.save();

    return res.status(200).json({
      message: "User profile updated successfully!",
      user: serializeProfileUser(updatedUser),
    });
  } catch (error) {
    console.error("Error updating user profile:", error);

    return res.status(500).json({ error: "Internal Server Error!" });
  }
}

/**
 * Upload/update user avatar
 * @access Private
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<Object>}
 */
async function updateAvatar(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided!" });
    }

    assertUploadedImageFile(req.file);

    const user = await User.findById(req.user.id);

    if (!user) {
      // Delete uploaded file if user not found
      fs.unlinkSync(req.file.path);

      return res.status(404).json({ error: "User not found!" });
    }

    const storedAvatarUrl = await uploadImageFileToStorage(
      req.file.path,
      req.file.filename,
      req.file.mimetype
    );

    if (user.avatar) {
      deleteUploadFile(user.avatar);
    }

    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    user.avatar = storedAvatarUrl;
    const updatedUser = await user.save();

    return res.status(200).json({
      message: "Avatar updated successfully!",
      user: serializeProfileUser(updatedUser),
    });
  } catch (error) {
    console.error("Error updating avatar:", error);

    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    return res
      .status(error.statusCode || 500)
      .json({
        error: error.statusCode ? error.message : "Internal Server Error!",
      });
  }
}

/**
 * Delete user avatar
 * @access Private
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<Object>}
 */
async function deleteAvatar(req, res) {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ error: "User not found!" });
    }

    if (!user.avatar) {
      return res.status(400).json({ error: "No avatar to delete!" });
    }

    deleteUploadFile(user.avatar);

    user.avatar = "";
    const updatedUser = await user.save();

    return res.status(200).json({
      message: "Avatar deleted successfully!",
      user: serializeProfileUser(updatedUser),
    });
  } catch (error) {
    console.error("Error deleting avatar:", error);

    return res.status(500).json({ error: "Internal Server Error!" });
  }
}

async function enableBookshelfShare(req, res) {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ error: "User not found!" });
    }

    if (!user.bookshelfShare?.token) {
      user.bookshelfShare = {
        token: await getUniqueBookshelfShareToken(),
        enabledAt: new Date(),
      };
      await user.save();
    }

    return res.status(200).json({
      message: "Bookshelf share link is active.",
      user: serializeProfileUser(user),
      bookshelfShare: serializeBookshelfShare(user),
    });
  } catch (error) {
    console.error("Error enabling bookshelf share:", error);

    return res.status(500).json({ error: "Internal Server Error!" });
  }
}

async function disableBookshelfShare(req, res) {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ error: "User not found!" });
    }

    user.bookshelfShare = {
      token: "",
      enabledAt: null,
    };
    await user.save();

    return res.status(200).json({
      message: "Bookshelf share link was revoked.",
      user: serializeProfileUser(user),
      bookshelfShare: null,
    });
  } catch (error) {
    console.error("Error disabling bookshelf share:", error);

    return res.status(500).json({ error: "Internal Server Error!" });
  }
}

module.exports = {
  getProfile,
  updateProfile,
  updateAvatar,
  deleteAvatar,
  enableBookshelfShare,
  disableBookshelfShare,
  serializeProfileUser,
};
