const express = require("express");
const {
  recordSymptoms,
  getSymptomHistory,
  getLatestSymptoms,
} = require("../controllers/symptomController");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

router.post("/record", authMiddleware, recordSymptoms);
router.get("/history", authMiddleware, getSymptomHistory);
router.get("/latest", authMiddleware, getLatestSymptoms);

module.exports = router;
