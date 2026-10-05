// src/routes/users.js
const express = require("express");
const {
  getUserProfile,
  updateUserProfile,
  updateProfilePicture,
  savePushToken,
  saveNotificationSettings,
  getNotificationSettings,
  avatarUpload,
} = require("../controllers/userController");
const { exportData, deleteAccount } = require("../controllers/accountController");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

// Profile
router.get("/profile",  authMiddleware, getUserProfile);
router.put("/profile",  authMiddleware, updateUserProfile);

// Profile picture
router.put(
  "/profile/picture",
  authMiddleware,
  avatarUpload.single("profilePicture"),
  updateProfilePicture
);

// Push notifications
router.post("/push-token",              authMiddleware, savePushToken);
router.get("/notification-settings",   authMiddleware, getNotificationSettings);
router.put("/notification-settings",   authMiddleware, saveNotificationSettings);

// Data rights (G-06). Both stores require an in-app deletion path for any app
// with accounts, and this one holds menstrual and family medical history.
router.get("/export", authMiddleware, exportData);
router.delete("/account", authMiddleware, deleteAccount);

module.exports = router;