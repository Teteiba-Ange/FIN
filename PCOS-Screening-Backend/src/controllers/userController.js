const path = require("path");
const fs   = require("fs");
const multer = require("multer");
const { get, run } = require("../config/database");

// ─── Avatar directory ─────────────────────────────────────────────────────────
const AVATAR_DIR = process.env.AVATAR_DIR
  ? path.resolve(process.env.AVATAR_DIR)
  : path.resolve(__dirname, "../../data/avatars");

if (!fs.existsSync(AVATAR_DIR)) {
  fs.mkdirSync(AVATAR_DIR, { recursive: true });
  console.log(`[INFO] Created avatar directory: ${AVATAR_DIR}`);
}

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, AVATAR_DIR),
  filename:    (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `avatar-${req.userId}${ext}`);
  },
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits:  { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    allowed.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error("Only JPEG, PNG and WebP allowed."));
  },
});

const selectUser = (userId) =>
  get(
    `SELECT id, email, fullName, age, weight, height,
            profilePicture, notifSymptom, notifCycle,
            notifWellness, notifCommunity, createdAt, updatedAt
     FROM users WHERE id = ?`,
    [userId]
  );

const getUserProfile = async (req, res) => {
  try {
    const user = await selectUser(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (error) {
    console.error("[ERROR] getUserProfile:", error);
    res.status(500).json({ error: error.message });
  }
};

const updateUserProfile = async (req, res) => {
  try {
    const { fullName, age, weight, height } = req.body;
    const updates = [];
    const values  = [];

    if (fullName !== undefined) { updates.push("fullName = ?"); values.push(fullName); }
    if (age      !== undefined) { updates.push("age = ?");      values.push(age); }
    if (weight   !== undefined) { updates.push("weight = ?");   values.push(weight); }
    if (height   !== undefined) { updates.push("height = ?");   values.push(height); }

    if (updates.length === 0)
      return res.status(400).json({ error: "No fields to update" });

    updates.push("updatedAt = CURRENT_TIMESTAMP");
    values.push(req.userId);

    await run(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, values);
    const updatedUser = await selectUser(req.userId);
    res.json(updatedUser);
  } catch (error) {
    console.error("[ERROR] updateUserProfile:", error);
    res.status(500).json({ error: error.message });
  }
};

const updateProfilePicture = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No image uploaded" });

    const savedPath = path.join(AVATAR_DIR, req.file.filename);
    if (!fs.existsSync(savedPath))
      return res.status(500).json({ error: "Image not saved correctly." });

    const profilePictureUrl = `/avatars/${req.file.filename}`;
    await run(
      "UPDATE users SET profilePicture = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?",
      [profilePictureUrl, req.userId]
    );
    res.json({ success: true, profilePicture: profilePictureUrl });
  } catch (error) {
    console.error("[ERROR] updateProfilePicture:", error);
    if (req.file) fs.unlink(req.file.path, () => {});
    res.status(500).json({ error: error.message });
  }
};

const savePushToken = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "Token required" });
    await run(
      "UPDATE users SET pushToken = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?",
      [token, req.userId]
    );
    console.log(`[PUSH] Token saved for user ${req.userId}`);
    res.json({ success: true, message: "Push token saved" });
  } catch (error) {
    console.error("[ERROR] savePushToken:", error);
    res.status(500).json({ error: error.message });
  }
};

const saveNotificationSettings = async (req, res) => {
  try {
    const { symptomReminder, cycleReminder, communityActivity, wellnessTips } = req.body;
    await run(
      `UPDATE users SET
         notifSymptom   = ?,
         notifCycle     = ?,
         notifCommunity = ?,
         notifWellness  = ?,
         updatedAt      = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        symptomReminder   ? 1 : 0,
        cycleReminder     ? 1 : 0,
        communityActivity ? 1 : 0,
        wellnessTips      ? 1 : 0,
        req.userId,
      ]
    );
    res.json({ success: true, message: "Notification preferences saved" });
  } catch (error) {
    console.error("[ERROR] saveNotificationSettings:", error);
    res.status(500).json({ error: error.message });
  }
};

const getNotificationSettings = async (req, res) => {
  try {
    const user = await get(
      "SELECT notifSymptom, notifCycle, notifCommunity, notifWellness FROM users WHERE id = ?",
      [req.userId]
    );
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({
      symptomReminder:   !!user.notifSymptom,
      cycleReminder:     !!user.notifCycle,
      communityActivity: !!user.notifCommunity,
      wellnessTips:      !!user.notifWellness,
    });
  } catch (error) {
    console.error("[ERROR] getNotificationSettings:", error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getUserProfile,
  updateUserProfile,
  updateProfilePicture,
  savePushToken,
  saveNotificationSettings,
  getNotificationSettings,
  avatarUpload,
};