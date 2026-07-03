const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { get, run } = require("../config/database");

// ─── Auto-migrate: add profilePicture column if missing ──────────────────────
(async () => {
  try {
    // Use IF NOT EXISTS for Postgres compatibility
    await run(`ALTER TABLE users ADD COLUMN IF NOT EXISTS profilePicture TEXT DEFAULT NULL`);
    console.log("[MIGRATION] Ensured profilePicture column exists on users table.");
  } catch (err) {
    console.warn("[MIGRATION] profilePicture column check failed:", err.message || err);
  }
})();

// ─── Profile picture upload directory ────────────────────────────────────────
const AVATAR_DIR = process.env.AVATAR_DIR
  ? path.resolve(process.env.AVATAR_DIR)
  : path.resolve(__dirname, "../../data/avatars");

if (!fs.existsSync(AVATAR_DIR)) {
  fs.mkdirSync(AVATAR_DIR, { recursive: true });
  console.log(`[INFO] Created avatar directory: ${AVATAR_DIR}`);
}

console.log(`[INFO] Profile pictures will be saved to: ${AVATAR_DIR}`);

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, AVATAR_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `avatar-${req.userId}${ext}`);
  },
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = ["image/jpeg", "image/png", "image/webp"];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, and WebP allowed."));
    }
  },
});

// ─── Helper: safe SELECT that works even if profilePicture column is new ─────
const selectUser = (userId) =>
  get(
    `SELECT id, email, fullName, age, weight, height,
            profilePicture, createdAt, updatedAt
     FROM users WHERE id = ?`,
    [userId]
  );

// ─── Controllers ──────────────────────────────────────────────────────────────

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
    const values = [];

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
    if (!req.file)
      return res.status(400).json({ error: "No image uploaded" });

    const savedPath = path.join(AVATAR_DIR, req.file.filename);

    if (!fs.existsSync(savedPath))
      return res.status(500).json({ error: "Image was not saved correctly. Please try again." });

    const profilePictureUrl = `/avatars/${req.file.filename}`;

    await run(
      "UPDATE users SET profilePicture = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?",
      [profilePictureUrl, req.userId]
    );

    console.log(`[INFO] Profile picture updated for user ${req.userId}: ${savedPath}`);

    res.json({
      success: true,
      message: "Profile picture updated successfully",
      profilePicture: profilePictureUrl,
    });
  } catch (error) {
    console.error("[ERROR] updateProfilePicture:", error);
    if (req.file) fs.unlink(req.file.path, () => {});
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getUserProfile, updateUserProfile, updateProfilePicture, avatarUpload };