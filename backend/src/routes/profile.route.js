const router = require("express").Router();
const {
  getProfile,
  updateProfile,
  updateAvatar,
  deleteAvatar,
  enableBookshelfShare,
  disableBookshelfShare,
} = require("../controllers/profile.controller");
const { authenticate } = require("../middlewares/auth.middleware");
const { uploadAvatarImage } = require("../middlewares/upload.middleware");

router.get("/", authenticate, getProfile);
router.put("/", authenticate, updateProfile);

router.put("/avatar", authenticate, uploadAvatarImage, updateAvatar);
router.delete("/avatar", authenticate, deleteAvatar);
router.post("/bookshelf-share", authenticate, enableBookshelfShare);
router.delete("/bookshelf-share", authenticate, disableBookshelfShare);

module.exports = router;
