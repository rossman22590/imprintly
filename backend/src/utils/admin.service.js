const ENV = require("../configs/env");
const User = require("../models/User");

const HARDCODED_ADMIN_EMAILS = new Set(["rcohen@mytsi.org"]);

function parseAdminEmails() {
  return String(ENV.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function isEnabled(value) {
  return value === true || value === "true" || value === "1" || value === 1;
}

function isConfiguredAdminEmail(email = "") {
  const normalizedEmail = String(email).trim().toLowerCase();
  const adminEmails = parseAdminEmails();

  return (
    HARDCODED_ADMIN_EMAILS.has(normalizedEmail) ||
    adminEmails.includes("*") ||
    adminEmails.includes(normalizedEmail)
  );
}

async function shouldBootstrapAsFirstAdmin(user) {
  if (!isEnabled(ENV.BOOTSTRAP_FIRST_ADMIN)) return false;

  const existingAdmin = await User.exists({ role: "admin" });

  if (existingAdmin) return false;

  const firstUser = await User.findOne({}).sort({ createdAt: 1, _id: 1 });

  return firstUser?._id?.toString() === user?._id?.toString();
}

async function syncUserAdminRole(user) {
  if (!user) return user;

  const shouldBeAdmin =
    user.role === "admin" ||
    isConfiguredAdminEmail(user.email) ||
    (await shouldBootstrapAsFirstAdmin(user));

  if (shouldBeAdmin && user.role !== "admin") {
    user.role = "admin";
    await user.save({ validateBeforeSave: false });
  }

  return user;
}

module.exports = {
  isConfiguredAdminEmail,
  syncUserAdminRole,
};
