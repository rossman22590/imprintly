const express = require("express");
const {
  adjustCredits,
  getUserDetails,
  listUsers,
  updateMonthlyCredits,
  updateUser,
} = require("../controllers/admin.controller");
const { requireAdmin } = require("../middlewares/admin.middleware");
const { authenticate } = require("../middlewares/auth.middleware");

const router = express.Router();

router.use(authenticate);
router.use(requireAdmin);

router.get("/users", listUsers);
router.get("/users/:userId", getUserDetails);
router.patch("/users/:userId", updateUser);
router.post("/users/:userId/credits", adjustCredits);
router.put("/users/:userId/credits/monthly", updateMonthlyCredits);

module.exports = router;
