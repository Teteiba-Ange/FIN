const express = require("express");
const {
  getUserProfile,
  updateUserProfile,
  updateProfilePicture,
  avatarUpload,
} = require("../controllers/userController");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

router.get("/profile", authMiddleware, getUserProfile);
router.put("/profile", authMiddleware, updateUserProfile);

// Profile picture upload — field name must be "profilePicture" in the form
router.put(
  "/profile/picture",
  authMiddleware,
  avatarUpload.single("profilePicture"),
  updateProfilePicture
);

module.exports = router;