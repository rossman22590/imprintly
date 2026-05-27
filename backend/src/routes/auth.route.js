const router = require("express").Router();
const {
  registerUser,
  requestPasswordReset,
  resetPassword,
  signInUser,
} = require("../controllers/auth.controller");

router.post("/register", registerUser);
router.post("/login", signInUser);
router.post("/password-reset/request", requestPasswordReset);
router.post("/password-reset/confirm", resetPassword);

module.exports = router;
