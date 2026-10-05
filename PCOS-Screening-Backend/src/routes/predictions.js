const express = require("express");
const {
  predictPCOSRisk,
  getPredictionHistory,
  getLatestPrediction,
  getRecommendations,
} = require("../controllers/predictionController");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

router.post("/predict", authMiddleware, predictPCOSRisk);
router.get("/history", authMiddleware, getPredictionHistory);
router.get("/latest", authMiddleware, getLatestPrediction);

// Separate from /predict so the score never waits on a language model.
router.post("/recommendations", authMiddleware, getRecommendations);

module.exports = router;
