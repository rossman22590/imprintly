const express = require("express");
const { getCredits } = require("../controllers/credits.controller");
const { authenticate } = require("../middlewares/auth.middleware");

const router = express.Router();

router.use(authenticate);
router.get("/", getCredits);

module.exports = router;
