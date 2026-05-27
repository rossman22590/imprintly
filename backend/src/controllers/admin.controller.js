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

const RUN_STATUSES = [
  "queued",
  "generating",
  "cancelling",
  "cancelled",
  "complete",
  "failed",
];
const RUN_PROVIDERS = ["gemini", "groq"];

function normalizeRunStatus(value = "") {
  return RUN_STATUSES.includes(value) ? value : "";
}

function normalizeRunProvider(value = "") {
  return RUN_PROVIDERS.includes(value) ? value : "";
}

function normalizeId(value) {
  return value?._id?.toString?.() || value?.toString?.() || "";
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

function countByStatus(rows = []) {
  return rows.reduce((counts, row) => {
    counts[row._id || "unknown"] = row.count || 0;
    return counts;
  }, {});
}

function countBookChapterStatuses(chapters = []) {
  return chapters.reduce(
    (counts, chapter) => {
      const status = chapter?.generationStatus || "empty";

      counts.total += 1;
      counts.wordCount += Number(chapter?.wordCount || 0);
      counts[status] = Number(counts[status] || 0) + 1;

      return counts;
    },
    {
      total: 0,
      empty: 0,
      queued: 0,
      generating: 0,
      complete: 0,
      failed: 0,
      wordCount: 0,
    }
  );
}

function serializeRunUser(user) {
  if (!user || !user.email) {
    return {
      _id: normalizeId(user),
      name: "",
      email: "",
      role: "",
      status: "",
    };
  }

  return {
    _id: normalizeId(user),
    name: user.name || "",
    email: user.email || "",
    role: user.role || "user",
    status: user.status || "active",
  };
}

function serializeRunBook(book) {
  if (!book || !book.title) {
    return {
      _id: normalizeId(book),
      title: "",
      subtitle: "",
      author: "",
      genre: "",
      status: "",
      generationStatus: "",
      generationProvider: "",
      generationJobId: "",
      chapterStatusCounts: countBookChapterStatuses([]),
      createdAt: null,
      updatedAt: null,
    };
  }

  return {
    _id: normalizeId(book),
    title: book.title || "",
    subtitle: book.subtitle || "",
    author: book.author || "",
    genre: book.genre || "",
    status: book.status || "draft",
    generationStatus: book.generation?.status || "manual",
    generationProvider: book.generation?.provider || "",
    generationJobId: book.generation?.jobId || "",
    chapterStatusCounts: countBookChapterStatuses(book.chapters || []),
    createdAt: book.createdAt || null,
    updatedAt: book.updatedAt || null,
  };
}

function serializeAdminRun(job) {
  return {
    _id: normalizeId(job._id),
    id: job.id,
    provider: job.provider,
    status: job.status,
    retryFailedOnly: Boolean(job.retryFailedOnly),
    cancelled: Boolean(job.cancelled),
    payloadTitle: job.payload?.title || job.payload?.topic || "",
    progress: job.progress || {},
    failedChapters: Array.isArray(job.failedChapters) ? job.failedChapters : [],
    error: job.error || "",
    user: serializeRunUser(job.userId),
    book: serializeRunBook(job.bookId),
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
  };
}

async function getAdminRunsSummary() {
  const [runStatusRows, totalBooks, bookStatusRows] = await Promise.all([
    GenerationJob.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]),
    Book.countDocuments({}),
    Book.aggregate([
      {
        $group: {
          _id: "$generation.status",
          count: { $sum: 1 },
        },
      },
    ]),
  ]);
  const runStatuses = countByStatus(runStatusRows);
  const bookStatuses = countByStatus(bookStatusRows);
  const activeRuns =
    Number(runStatuses.queued || 0) +
    Number(runStatuses.generating || 0) +
    Number(runStatuses.cancelling || 0);

  return {
    totalRuns: Object.values(runStatuses).reduce(
      (total, count) => total + Number(count || 0),
      0
    ),
    successfulRuns: Number(runStatuses.complete || 0),
    failedRuns: Number(runStatuses.failed || 0),
    activeRuns,
    cancelledRuns: Number(runStatuses.cancelled || 0),
    totalBooks,
    successfulBooks: Number(bookStatuses.complete || 0),
    failedBooks: Number(bookStatuses.failed || 0),
  };
}

async function buildRunQuery({ search, status, provider }) {
  const query = {};

  if (status) {
    query.status = status;
  }

  if (provider) {
    query.provider = provider;
  }

  if (!search) {
    return query;
  }

  const pattern = new RegExp(escapeRegex(search), "i");
  const [matchingUsers, matchingBooks] = await Promise.all([
    User.find({
      $or: [{ name: pattern }, { email: pattern }],
    })
      .select("_id")
      .limit(1000)
      .lean(),
    Book.find({
      $or: [{ title: pattern }, { subtitle: pattern }, { author: pattern }],
    })
      .select("_id")
      .limit(1000)
      .lean(),
  ]);
  const userIds = matchingUsers.map((user) => user._id);
  const bookIds = matchingBooks.map((book) => book._id);
  const searchOr = [
    { id: pattern },
    { error: pattern },
    { "progress.message": pattern },
    { "progress.currentChapterTitle": pattern },
    { "payload.title": pattern },
    { "payload.topic": pattern },
    { "payload.author": pattern },
  ];

  if (userIds.length) {
    searchOr.push({ userId: { $in: userIds } });
  }

  if (bookIds.length) {
    searchOr.push({ bookId: { $in: bookIds } });
  }

  if (mongoose.Types.ObjectId.isValid(search)) {
    const objectId = new mongoose.Types.ObjectId(search);
    searchOr.push({ _id: objectId }, { userId: objectId }, { bookId: objectId });
  }

  query.$or = searchOr;

  return query;
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

async function listRuns(req, res) {
  try {
    const limit = normalizeLimit(req.query.limit);
    const page = normalizePage(req.query.page);
    const search = String(req.query.search || "").trim();
    const status = normalizeRunStatus(String(req.query.status || "").trim());
    const provider = normalizeRunProvider(String(req.query.provider || "").trim());
    const query = await buildRunQuery({ search, status, provider });

    const [runs, total, summary] = await Promise.all([
      GenerationJob.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate({
          path: "userId",
          select: "name email role status",
        })
        .populate({
          path: "bookId",
          select:
            "title subtitle author genre status createdAt updatedAt generation.provider generation.status generation.jobId chapters.title chapters.generationStatus chapters.wordCount chapters.generationStats",
        })
        .lean(),
      GenerationJob.countDocuments(query),
      getAdminRunsSummary(),
    ]);

    const serializedRuns = runs.map(serializeAdminRun);

    return res.status(200).json({
      message: "Admin jobs retrieved.",
      jobs: serializedRuns,
      runs: serializedRuns,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
      summary,
    });
  } catch (error) {
    console.error("Error listing admin runs:", error);

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
  listRuns,
  getUserDetails,
  listUsers,
  updatePlanSettings,
  updateMonthlyCredits,
  updateUser,
  updateUserStatus,
};
