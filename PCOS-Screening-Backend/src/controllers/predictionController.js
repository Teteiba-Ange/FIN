const { v4: uuidv4 } = require("uuid");
const { run, get, all } = require("../config/database");

// ML Service URL - adjust if running on different port/host
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:5001";

// This will integrate with the trained ML model
const predictPCOSRisk = async (req, res) => {
  try {
    const { symptoms } = req.body;

    if (!symptoms) {
      return res.status(400).json({ error: "Symptoms data required" });
    }

    // Map frontend symptoms to ML service format
    const mlInput = mapSymptomsToMLInput(symptoms);
    console.log("Prediction request for user", req.userId, "input", mlInput);

    // Call ML service
    // Add a timeout to the ML service call to satisfy NFR: ML result within 5s
    const controller = new AbortController();
    const timeoutMs = parseInt(process.env.ML_REQUEST_TIMEOUT_MS || "5000", 10);
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const mlResponse = await fetch(`${ML_SERVICE_URL}/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mlInput),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!mlResponse.ok) {
      console.error('ML service error:', mlResponse.status, mlResponse.statusText);
      return res.status(500).json({ error: "ML service unavailable" });
    }

    const mlResult = await mlResponse.json();

    if (!mlResult.success) {
      return res.status(500).json({ error: mlResult.error || "ML prediction failed" });
    }

    const predictionId = uuidv4();

    await run(
      "INSERT INTO predictions (id, userId, score, riskLevel) VALUES (?, ?, ?, ?)",
      [predictionId, req.userId, mlResult.risk_score, mlResult.risk_level]
    );

    res.json({
      predictionId,
      score: mlResult.risk_score,
      riskLevel: mlResult.risk_level,
      riskColor: mlResult.risk_color,
      riskDescription: mlResult.risk_description,
      topFeatures: mlResult.top_features,
      disclaimer: mlResult.disclaimer,
      message: "PCOS risk assessment completed using ML model",
    });
  } catch (error) {
    console.error('Prediction error:', error);
    res.status(500).json({ error: error.message });
  }
};

const getPredictionHistory = async (req, res) => {
  try {
    const predictions = await all(
      "SELECT * FROM predictions WHERE userId = ? ORDER BY predictedAt DESC LIMIT 20",
      [req.userId]
    );

    res.json(predictions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Map frontend assessment data to ML service input format
function mapSymptomsToMLInput(symptoms) {
  return {
    age: parseFloat(symptoms.age) || 25,
    bmi: calculateBMI(symptoms.weight, symptoms.height),
    cycle_regularity: symptoms.cycleRegularity === "Regular" ? 2 : symptoms.cycleRegularity === "Irregular" ? 4 : 5,
    cycle_length: parseFloat(symptoms.cycleLength) || 28,
    weight_gain: symptoms.symptoms.includes("weight_gain") ? 1 : 0,
    hair_growth: symptoms.symptoms.includes("hair_growth") ? 1 : 0,
    skin_darkening: symptoms.symptoms.includes("skin_darkening") ? 1 : 0,
    hair_loss: symptoms.symptoms.includes("hair_loss") ? 1 : 0,
    pimples: symptoms.symptoms.includes("acne") ? 1 : 0,
    fast_food: symptoms.fastFoodFrequency === "frequently" ? 1 : 0,
    regular_exercise: symptoms.exerciseHabit === "Active" ? 1 : 0,
    waist_hip_ratio: 0.85, // Default, could be calculated if waist/hip provided
    pregnant: 0, // Default
    num_abortions: 0, // Default
    weight: parseFloat(symptoms.weight) || 60,
    years_married: symptoms.maritalStatus === "Married" ? 5 : 0,
  };
}

function calculateBMI(weight, height) {
  const w = parseFloat(weight);
  const h = parseFloat(height) / 100; // Convert cm to m
  if (!w || !h || h <= 0) return 22; // Default BMI
  return parseFloat((w / (h * h)).toFixed(1));
}

const getLatestPrediction = async (req, res) => {
  try {
    const prediction = await get(
      "SELECT * FROM predictions WHERE userId = ? ORDER BY predictedAt DESC LIMIT 1",
      [req.userId]
    );

    if (!prediction) {
      return res.status(404).json({ error: "No predictions found" });
    }

    res.json(prediction);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  predictPCOSRisk,
  getPredictionHistory,
  getLatestPrediction,
};
