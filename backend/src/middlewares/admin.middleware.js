const User = require("../models/User");
const { syncUserAdminRole } = require("../utils/admin.service");

async function requireAdmin(req, res, next) {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    await syncUserAdminRole(user);

    if (user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required." });
    }

    req.admin = {
      id: user._id,
      email: user.email,
      name: user.name,
    };

    return next();
  } catch (error) {
    console.error("Error checking admin access:", error);

    return res.status(500).json({ error: "Internal Server Error!" });
  }
}

module.exports = { requireAdmin };
