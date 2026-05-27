const jwt = require("jsonwebtoken");
const ENV = require("../configs/env");
const User = require("../models/User");
const { syncUserAdminRole } = require("../utils/admin.service");
const { ensureUserCredits, serializeCredits } = require("../utils/credits.service");
const { clearAuthCookie, setAuthCookie } = require("../utils/auth-cookie");

function generateToken(userId) {
  return jwt.sign({ id: userId }, ENV.JWT_SECRET_KEY, { expiresIn: "7d" });
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
    const token = generateToken(user._id);
    setAuthCookie(res, token);

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
      token,
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
    const token = generateToken(user._id);
    setAuthCookie(res, token);

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
      token,
    });
  } catch (error) {
    console.error("Error signing in user:", error);

    return res.status(500).json({ error: "Internal Server Error!" });
  }
}

function logoutUser(_, res) {
  clearAuthCookie(res);

  return res.status(200).json({ message: "User signed out successfully!" });
}

module.exports = { logoutUser, registerUser, signInUser };
