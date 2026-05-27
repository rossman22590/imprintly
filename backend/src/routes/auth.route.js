const router = require("express").Router();
const {
  logoutUser,
  registerUser,
  signInUser,
} = require("../controllers/auth.controller");

router.post("/register", registerUser);
router.post("/login", signInUser);
router.post("/logout", logoutUser);

module.exports = router;
