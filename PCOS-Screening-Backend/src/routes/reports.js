const express = require("express");
const {
  upload,
  uploadReport,
  getReports,
  deleteReport,
} = require("../controllers/reportController");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

router.post("/upload", authMiddleware, upload.single("file"), uploadReport);
router.get("/", authMiddleware, getReports);
router.delete("/:reportId", authMiddleware, deleteReport);

module.exports = router;
