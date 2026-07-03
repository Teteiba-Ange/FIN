const { v4: uuidv4 } = require("uuid");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { run, all, get } = require("../config/database");

// ─── Use absolute path so files always land in the right place ───────────────
const resolveUploadPath = (value) =>
  path.isAbsolute(value)
    ? value
    : path.resolve(__dirname, "../../", value);

const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? resolveUploadPath(process.env.UPLOAD_DIR)
  : path.resolve(__dirname, "../../data/uploads");

// Ensure the upload directory exists on startup
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  console.log(`[INFO] Created upload directory: ${UPLOAD_DIR}`);
}

console.log(`[INFO] Report uploads will be saved to: ${UPLOAD_DIR}`);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // Keep original extension, sanitize name
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}-${base}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 }, // 10MB default
  fileFilter: (req, file, cb) => {
    const allowedMimes = ["application/pdf", "image/jpeg", "image/png"];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only PDF, JPEG, and PNG allowed."));
    }
  },
});

const uploadReport = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const reportId = uuidv4();
    const fileUrl = `/uploads/${req.file.filename}`;

    // Confirm file actually exists on disk before saving to DB
    const savedPath = path.join(UPLOAD_DIR, req.file.filename);
    if (!fs.existsSync(savedPath)) {
      return res.status(500).json({ error: "File was not saved correctly. Please try again." });
    }

    await run(
      "INSERT INTO reports (id, userId, fileName, fileUrl) VALUES (?, ?, ?, ?)",
      [reportId, req.userId, req.file.originalname, fileUrl]
    );

    console.log(`[INFO] Report uploaded: ${req.file.originalname} → ${savedPath}`);

    res.status(201).json({
      success: true,
      message: "Report uploaded successfully",
      reportId,
      fileName: req.file.originalname,
      fileUrl,
      savedTo: savedPath, // helpful during development
      size: req.file.size,
      uploadedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[ERROR] uploadReport:", error);
    // Clean up uploaded file on DB error
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }
    res.status(500).json({ error: error.message });
  }
};

const getReports = async (req, res) => {
  try {
    const reports = await all(
      "SELECT * FROM reports WHERE userId = ? ORDER BY uploadedAt DESC",
      [req.userId]
    );

    res.json(reports);
  } catch (error) {
    console.error("[ERROR] getReports:", error);
    res.status(500).json({ error: error.message });
  }
};

const deleteReport = async (req, res) => {
  try {
    const { reportId } = req.params;

    const report = await get(
      "SELECT * FROM reports WHERE id = ? AND userId = ?",
      [reportId, req.userId]
    );

    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    // Delete file from disk
    const filePath = path.join(UPLOAD_DIR, path.basename(report.fileUrl));
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[INFO] Deleted file: ${filePath}`);
    }

    // Delete from database
    await run("DELETE FROM reports WHERE id = ?", [reportId]);

    res.json({ success: true, message: "Report deleted successfully" });
  } catch (error) {
    console.error("[ERROR] deleteReport:", error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = { upload, uploadReport, getReports, deleteReport };