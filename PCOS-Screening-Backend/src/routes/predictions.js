const express = require("express");
const {
  predictPCOSRisk,
  getPredictionHistory,
  getLatestPrediction,
} = require("../controllers/predictionController");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

router.post("/predict", authMiddleware, predictPCOSRisk);
router.get("/history", authMiddleware, getPredictionHistory);
router.get("/latest", authMiddleware, getLatestPrediction);

module.exports = router;
