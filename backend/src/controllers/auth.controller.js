const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const ENV = require("../configs/env");
const User = require("../models/User");
const { syncUserAdminRole } = require("../utils/admin.service");
const { ensureUserCredits, serializeCredits } = require("../utils/credits.service");
const { sendPasswordResetEmail } = require("../utils/email.service");

const PASSWORD_RESET_REQUEST_MESSAGE =
  "If an account exists for that email, we'll send a password reset link shortly.";

function generateToken(userId) {
  return jwt.sign({ id: userId }, ENV.JWT_SECRET_KEY, { expiresIn: "7d" });
}

function hashPasswordResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function normalizeEmail(email = "") {
  return String(email).trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password) {
  if (!password || typeof password !== "string") {
    return "Password is required";
  }

  if (password.length < 8) {
    return "Password must be at least 8 characters";
  }

  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) {
    return "Password must contain at least one uppercase letter, one lowercase letter, and one number";
  }

  return "";
}

function getPasswordResetTtlMinutes() {
  const parsed = Number.parseInt(ENV.PASSWORD_RESET_TOKEN_TTL_MINUTES, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60;
}

function getClientOrigin(req) {
  const configuredClientUrl = ENV.CLIENT_URL.trim().replace(/\/$/, "");

  if (configuredClientUrl) {
    return configuredClientUrl;
  }

  const requestOrigin = String(req.get("origin") || "")
    .trim()
    .replace(/\/$/, "");

  if (requestOrigin) {
    return requestOrigin;
  }

  const forwardedProtocol = String(req.get("x-forwarded-proto") || "")
    .split(",")[0]
    .trim();
  const forwardedHost = String(req.get("x-forwarded-host") || "")
    .split(",")[0]
    .trim();
  const protocol = forwardedProtocol || req.protocol || "https";
  const host = forwardedHost || req.get("host");

  if (!host) {
    throw new Error("Unable to resolve password reset URL origin");
  }

  return `${protocol}://${host}`.replace(/\/$/, "");
}

async function registerUser(req, res) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Required fields are missing!" });
    }

    const userExists = await User.findOne({ email });

    if (userExists) {
      console.error("Email already registered!");

      return res.status(400).json({ error: "Registration failed!" });
    }

    const user = await User.create({ name, email, password });
    await ensureUserCredits(user._id);
    await syncUserAdminRole(user);

    return res.status(201).json({
      message: "User registered successfully!",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        storeUrl: user.storeUrl || "",
        shelfPageName: user.shelfPageName || "",
        shelfPhotoUrl: user.shelfPhotoUrl || "",
        publicShareMetaTitle: user.publicShareMetaTitle || "",
        publicShareMetaDescription: user.publicShareMetaDescription || "",
        publicShareImageUrl: user.publicShareImageUrl || "",
        publicShareTheme: user.publicShareTheme || "",
        role: user.role,
        credits: serializeCredits(user),
      },
      token: generateToken(user._id),
    });
  } catch (error) {
    console.error("Error registering user:", error);

    return res.status(500).json({ error: "Internal Server Error!" });
  }
}

async function signInUser(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Required fields are missing!" });
    }

    const user = await User.findOne({ email }).select("+password");

    if (!user || !(await user.passwordsMatch(password))) {
      return res.status(401).json({ error: "Invalid credentials!" });
    }

    await ensureUserCredits(user._id);
    await syncUserAdminRole(user);

    return res.status(200).json({
      message: "User signed in successfully!",
      user: {
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
        credits: serializeCredits(user),
      },
      token: generateToken(user._id),
    });
  } catch (error) {
    console.error("Error signing in user:", error);

    return res.status(500).json({ error: "Internal Server Error!" });
  }
}

async function requestPasswordReset(req, res) {
  try {
    const email = normalizeEmail(req.body?.email);

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(200).json({ message: PASSWORD_RESET_REQUEST_MESSAGE });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = hashPasswordResetToken(resetToken);
    const expiresInMinutes = getPasswordResetTtlMinutes();
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);
    const resetUrl = `${getClientOrigin(req)}/reset-password/${resetToken}`;

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordResetTokenHash: resetTokenHash,
          passwordResetTokenExpiresAt: expiresAt,
        },
      }
    );

    try {
      await sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        resetUrl,
        expiresInMinutes,
      });
    } catch (emailError) {
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            passwordResetTokenHash: "",
            passwordResetTokenExpiresAt: null,
          },
        }
      );

      throw emailError;
    }

    return res.status(200).json({ message: PASSWORD_RESET_REQUEST_MESSAGE });
  } catch (error) {
    console.error("Error requesting password reset:", error);

    return res.status(500).json({ error: "Unable to send password reset email." });
  }
}

async function resetPassword(req, res) {
  try {
    const token = String(req.body?.token || "").trim();
    const password = String(req.body?.password || "");
    const passwordError = validatePassword(password);

    if (!token) {
      return res.status(400).json({ error: "Reset token is required." });
    }

    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const user = await User.findOne({
      passwordResetTokenHash: hashPasswordResetToken(token),
      passwordResetTokenExpiresAt: { $gt: new Date() },
    }).select("+password +passwordResetTokenHash +passwordResetTokenExpiresAt");

    if (!user) {
      return res.status(400).json({ error: "Invalid or expired reset link." });
    }

    user.password = password;
    user.passwordResetTokenHash = "";
    user.passwordResetTokenExpiresAt = null;
    await user.save();

    return res.status(200).json({ message: "Password reset successfully." });
  } catch (error) {
    console.error("Error resetting password:", error);

    return res.status(500).json({ error: "Unable to reset password." });
  }
}

module.exports = {
  registerUser,
  signInUser,
  requestPasswordReset,
  resetPassword,
};
