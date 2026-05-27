const express = require("express");
const {
  adjustCredits,
  deleteUser,
  getPlanSettings,
  getUserDetails,
  listUsers,
  updatePlanSettings,
  updateMonthlyCredits,
  updateUser,
  updateUserStatus,
} = require("../controllers/admin.controller");
const { requireAdmin } = require("../middlewares/admin.middleware");
const { authenticate } = require("../middlewares/auth.middleware");

const router = express.Router();

router.use(authenticate);
router.use(requireAdmin);

router.get("/plans", getPlanSettings);
router.put("/plans", updatePlanSettings);
router.get("/users", listUsers);
router.get("/users/:userId", getUserDetails);
router.patch("/users/:userId", updateUser);
router.patch("/users/:userId/status", updateUserStatus);
router.delete("/users/:userId", deleteUser);
router.post("/users/:userId/credits", adjustCredits);
router.put("/users/:userId/credits/monthly", updateMonthlyCredits);

module.exports = router;
