const User = require("../models/User");
const fs = require("fs");
const { syncUserAdminRole } = require("../utils/admin.service");
const { ensureUserCredits, serializeCredits } = require("../utils/credits.service");
const {
  assertUploadedImageFile,
  deleteUploadFile,
  normalizeUploadUrl,
} = require("../utils/upload-paths");

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
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
        credits: serializeCredits(user),
      },
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
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({
        error: "Please provide a name to update!",
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

    const updatedUser = await user.save();

    return res.status(200).json({
      message: "User profile updated successfully!",
      user: {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        avatar: updatedUser.avatar,
        role: updatedUser.role,
        credits: serializeCredits(updatedUser),
      },
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

    // Delete old avatar image if it exists
    if (user.avatar) {
      deleteUploadFile(user.avatar);
    }

    // Save relative path from backend root
    user.avatar = normalizeUploadUrl(`/uploads/${req.file.filename}`);
    const updatedUser = await user.save();

    return res.status(200).json({
      message: "Avatar updated successfully!",
      user: {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        avatar: updatedUser.avatar,
        role: updatedUser.role,
        credits: serializeCredits(updatedUser),
      },
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
      user: {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        avatar: updatedUser.avatar,
        role: updatedUser.role,
        credits: serializeCredits(updatedUser),
      },
    });
  } catch (error) {
    console.error("Error deleting avatar:", error);

    return res.status(500).json({ error: "Internal Server Error!" });
  }
}

module.exports = { getProfile, updateProfile, updateAvatar, deleteAvatar };
