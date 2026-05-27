const mongoose = require("mongoose");
const Book = require("../models/Book");
const CreditTransaction = require("../models/CreditTransaction");
const GenerationJob = require("../models/GenerationJob");
const User = require("../models/User");
const {
  isConfiguredAdminEmail,
  syncUserAdminRole,
} = require("../utils/admin.service");
const {
  getMonthlyCreditPlanSettings,
  updateMonthlyCreditPlanSettings,
} = require("../utils/monthly-credit-plans.service");
const {
  adjustUserCredits,
  buildCreditHistoryQuery,
  CREDIT_HISTORY_DAYS,
  ensureUserCredits,
  serializeCredits,
  serializeTransaction,
  setMonthlyCreditAllowance,
} = require("../utils/credits.service");
const { deleteUploadFile } = require("../utils/upload-paths");

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeLimit(value) {
  return Math.min(Math.max(Number.parseInt(value, 10) || 25, 1), 100);
}

function normalizePage(value) {
  return Math.max(Number.parseInt(value, 10) || 1, 1);
}

function normalizeAccountStatus(value = "") {
  return ["active", "banned"].includes(value) ? value : "";
}

function isBanned(user) {
  return user?.status === "banned";
}

function deleteBookUploads(book) {
  if (book.coverImage) {
    deleteUploadFile(book.coverImage);
  }

  (book.chapters || []).forEach((chapter) => {
    (chapter.images || []).forEach((image) => {
      if (image?.url) {
        deleteUploadFile(image.url);
      }
    });
  });
}

function deleteUserUploads(user) {
  [user.avatar, user.shelfPhotoUrl, user.publicShareImageUrl]
    .filter(Boolean)
    .forEach(deleteUploadFile);
}

async function assertCanModerateUser(user, admin, action) {
  await syncUserAdminRole(user);

  if (user._id.toString() === admin.id.toString()) {
    const error = new Error(`You cannot ${action} your own account.`);
    error.statusCode = 400;
    throw error;
  }

  if (isConfiguredAdminEmail(user.email)) {
    const error = new Error("This email is hardcoded as an admin and cannot be changed this way.");
    error.statusCode = 400;
    throw error;
  }

  if (user.role === "admin") {
    const adminCount = await User.countDocuments({ role: "admin" });

    if (adminCount <= 1) {
      const error = new Error(`You cannot ${action} the last admin account.`);
      error.statusCode = 400;
      throw error;
    }
  }
}

async function serializeAdminUser(user) {
  const ensuredUser = await ensureUserCredits(user._id);
  await syncUserAdminRole(ensuredUser);
  const bookCount = await Book.countDocuments({ userId: user._id });

  return {
    _id: ensuredUser._id,
    name: ensuredUser.name,
    email: ensuredUser.email,
    avatar: ensuredUser.avatar,
    role: ensuredUser.role || "user",
    status: ensuredUser.status || "active",
    bannedAt: ensuredUser.bannedAt || null,
    bannedReason: ensuredUser.bannedReason || "",
    bannedBy: ensuredUser.bannedBy || null,
    credits: serializeCredits(ensuredUser),
    bookCount,
    createdAt: ensuredUser.createdAt,
    updatedAt: ensuredUser.updatedAt,
  };
}

async function getAdminSummary() {
  const [totalUsers, adminUsers, bannedUsers, creditTotals] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ role: "admin" }),
    User.countDocuments({ status: "banned" }),
    User.aggregate([
      {
        $group: {
          _id: null,
          outstandingCredits: { $sum: "$credits.balance" },
          lifetimeSpent: { $sum: "$credits.lifetimeSpent" },
        },
      },
    ]),
  ]);
  const totals = creditTotals[0] || {};

  return {
    totalUsers,
    adminUsers,
    bannedUsers,
    outstandingCredits: Math.round(Number(totals.outstandingCredits || 0) * 100) / 100,
    lifetimeSpent: Math.round(Number(totals.lifetimeSpent || 0) * 100) / 100,
  };
}

async function listUsers(req, res) {
  try {
    const limit = normalizeLimit(req.query.limit);
    const page = normalizePage(req.query.page);
    const search = String(req.query.search || "").trim();
    const role = String(req.query.role || "").trim();
    const query = {};

    if (search) {
      const pattern = new RegExp(escapeRegex(search), "i");
      query.$or = [{ name: pattern }, { email: pattern }];
    }

    if (["user", "admin"].includes(role)) {
      query.role = role;
    }

    const [users, total, summary] = await Promise.all([
      User.find(query)
        .select("-password")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      User.countDocuments(query),
      getAdminSummary(),
    ]);

    const serializedUsers = await Promise.all(users.map(serializeAdminUser));

    return res.status(200).json({
      message: "Admin users retrieved.",
      users: serializedUsers,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
      summary,
    });
  } catch (error) {
    console.error("Error listing admin users:", error);

    return res.status(500).json({ error: "Internal Server Error!" });
  }
}

async function getPlanSettings(req, res) {
  try {
    const settings = await getMonthlyCreditPlanSettings();

    return res.status(200).json({
      message: "Monthly credit plans retrieved.",
      settings,
    });
  } catch (error) {
    console.error("Error getting admin plan settings:", error);

    return res.status(500).json({ error: "Internal Server Error!" });
  }
}

async function updatePlanSettings(req, res) {
  try {
    const settings = await updateMonthlyCreditPlanSettings(req.body || {});

    return res.status(200).json({
      message: "Monthly credit plans updated.",
      settings,
    });
  } catch (error) {
    console.error("Error updating admin plan settings:", error);

    return res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Internal Server Error!" });
  }
}

async function getUserDetails(req, res) {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user ID." });
    }

    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const [serializedUser, transactions] = await Promise.all([
      serializeAdminUser(user),
      CreditTransaction.find(buildCreditHistoryQuery(userId))
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    return res.status(200).json({
      message: "Admin user details retrieved.",
      user: serializedUser,
      transactions: transactions.map(serializeTransaction),
      historyDays: CREDIT_HISTORY_DAYS,
    });
  } catch (error) {
    console.error("Error getting admin user details:", error);

    return res.status(500).json({ error: "Internal Server Error!" });
  }
}

async function updateUser(req, res) {
  try {
    const { userId } = req.params;
    const { name, role } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user ID." });
    }

    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length < 2) {
        return res.status(400).json({ error: "Name must be at least 2 characters." });
      }

      user.name = name.trim().slice(0, 50);
    }

    if (role !== undefined) {
      if (!["user", "admin"].includes(role)) {
        return res.status(400).json({ error: "Role must be user or admin." });
      }

      if (user._id.toString() === req.admin.id.toString() && role !== "admin") {
        return res.status(400).json({ error: "You cannot remove your own admin role." });
      }

      if (isConfiguredAdminEmail(user.email) && role !== "admin") {
        return res.status(400).json({
          error: "This email is hardcoded as an admin and cannot be demoted.",
        });
      }

      user.role = role;
    }

    await user.save({ validateBeforeSave: false });

    return res.status(200).json({
      message: "User updated.",
      user: await serializeAdminUser(user),
    });
  } catch (error) {
    console.error("Error updating admin user:", error);

    return res.status(500).json({ error: "Internal Server Error!" });
  }
}

async function updateUserStatus(req, res) {
  try {
    const { userId } = req.params;
    const status = normalizeAccountStatus(req.body?.status);
    const reason = String(req.body?.reason || "").trim().slice(0, 300);

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user ID." });
    }

    if (!status) {
      return res.status(400).json({ error: "Status must be active or banned." });
    }

    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    if (status === "banned") {
      await assertCanModerateUser(user, req.admin, "ban");
    }

    if (status === "banned") {
      user.status = "banned";
      user.bannedAt = isBanned(user) ? user.bannedAt || new Date() : new Date();
      user.bannedReason = reason;
      user.bannedBy = req.admin.id;
    } else {
      user.status = "active";
      user.bannedAt = null;
      user.bannedReason = "";
      user.bannedBy = null;
    }

    await user.save({ validateBeforeSave: false });

    return res.status(200).json({
      message: status === "banned" ? "User banned." : "User unbanned.",
      user: await serializeAdminUser(user),
    });
  } catch (error) {
    console.error("Error updating admin user status:", error);

    return res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Internal Server Error!" });
  }
}

async function deleteUser(req, res) {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user ID." });
    }

    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    await assertCanModerateUser(user, req.admin, "delete");

    const books = await Book.find({ userId: user._id });

    deleteUserUploads(user);
    books.forEach(deleteBookUploads);

    const [deletedBooks, deletedTransactions, deletedJobs] = await Promise.all([
      Book.deleteMany({ userId: user._id }),
      CreditTransaction.deleteMany({ userId: user._id }),
      GenerationJob.deleteMany({ userId: user._id }),
    ]);

    await user.deleteOne();

    return res.status(200).json({
      message: "User deleted.",
      deletedUserId: user._id.toString(),
      deleted: {
        books: deletedBooks.deletedCount || 0,
        creditTransactions: deletedTransactions.deletedCount || 0,
        generationJobs: deletedJobs.deletedCount || 0,
      },
    });
  } catch (error) {
    console.error("Error deleting admin user:", error);

    return res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Internal Server Error!" });
  }
}

async function adjustCredits(req, res) {
  try {
    const { userId } = req.params;
    const { action, amount, note } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user ID." });
    }

    const adjustment = await adjustUserCredits({
      userId,
      action,
      amount,
      note: typeof note === "string" ? note.slice(0, 300) : "",
      adminUserId: req.admin.id.toString(),
    });

    return res.status(200).json({
      message: "Credits adjusted.",
      user: await serializeAdminUser(adjustment.user),
      transaction: serializeTransaction(adjustment.transaction),
    });
  } catch (error) {
    console.error("Error adjusting admin user credits:", error);

    return res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Internal Server Error!" });
  }
}

async function updateMonthlyCredits(req, res) {
  try {
    const { userId } = req.params;
    const { amount, preset, note } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user ID." });
    }

    const result = await setMonthlyCreditAllowance({
      userId,
      amount,
      preset,
      note: typeof note === "string" ? note.slice(0, 300) : "",
      adminUserId: req.admin.id.toString(),
    });

    return res.status(200).json({
      message: "Monthly credits updated.",
      user: await serializeAdminUser(result.user),
      transaction: serializeTransaction(result.transaction),
    });
  } catch (error) {
    console.error("Error updating monthly credits:", error);

    return res
      .status(error.statusCode || 500)
      .json({ error: error.message || "Internal Server Error!" });
  }
}

module.exports = {
  adjustCredits,
  deleteUser,
  getPlanSettings,
  getUserDetails,
  listUsers,
  updatePlanSettings,
  updateMonthlyCredits,
  updateUser,
  updateUserStatus,
};
