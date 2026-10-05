const { v4: uuidv4 } = require("uuid");
const { run, get, all } = require("../config/database");
const groqService = require("../services/groqService");

// ML Service URL - adjust if running on different port/host
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:5001";
console.log("Using ML_SERVICE_URL:", ML_SERVICE_URL);

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

    // Only explanations grounded in something the user actually told us.
    const whrWasMeasured = calculateWHR(symptoms.waist, symptoms.hip) !== null;
    const topFeatures = stripSyntheticAttributions(
      mlResult.top_features,
      whrWasMeasured
    );

    // A-04 — attributions are persisted with the row now. They were previously
    // returned to the client and dropped, so "What influenced your last result"
    // was empty for anyone who restarted the app.
    await run(
      "INSERT INTO predictions (id, userId, score, riskLevel, topFeatures) VALUES (?, ?, ?, ?, ?)",
      [
        predictionId,
        req.userId,
        mlResult.risk_score,
        mlResult.risk_level,
        JSON.stringify(topFeatures),
      ]
    );

    res.json({
      predictionId,
      score: mlResult.risk_score,
      riskLevel: mlResult.risk_level,
      riskColor: mlResult.risk_color,
      riskDescription: mlResult.risk_description,
      topFeatures,
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

// ─── Feature mapping ─────────────────────────────────────────────────────────
/**
 * Maps the app's assessment answers to the model's feature vector.
 *
 * This function contained the most consequential bug in the system.
 *
 * D-01 — `fast_food` tested `symptoms.fastFoodFrequency === "frequently"`.
 *   The app has never sent that string. Step 4 sends one of "Never",
 *   "1–2x / week", "3–4x / week" or "Daily", so the feature evaluated to 0 for
 *   every user who has ever been assessed, and the question was asked for
 *   nothing. The mapping below covers the actual values, including the
 *   en-dash — "1–2x / week" uses U+2013, not a hyphen.
 *
 * D-02 — Four features were constants dressed as measurements:
 *   `waist_hip_ratio: 0.85`, `pregnant: 0`, `num_abortions: 0`, and
 *   `years_married: married ? 5 : 0`. Waist-to-hip ratio in particular is a
 *   real PCOS signal being passed as a literal, which means any SHAP
 *   attribution naming it was describing a number the user never gave.
 *
 *   The app now collects waist and hip (optional), so the ratio is computed
 *   when available. The remaining three are still not collected — they are
 *   marked explicitly below rather than left to look like real inputs.
 *
 * D-03 — `avgPeriodDuration` is collected in step 2 and still cannot be used.
 *   The model takes exactly 16 features (`ml-service/models/feature_names.pkl`)
 *   and period duration is not among them, so there is nothing to map it to.
 *   The ML service ignores unknown keys rather than rejecting them, which
 *   means sending it anyway would look like a fix while changing nothing.
 *   It is deliberately NOT sent. Resolving this needs either a retrain that
 *   includes the feature, or step 2 to stop asking. See PLAN.md.
 */

/** Population-median waist-to-hip ratio, used only when the user skipped it. */
const WHR_FALLBACK = 0.85;

const FAST_FOOD_SCORE = {
  Never: 0,
  "1–2x / week": 0, // en-dash, as sent by the app
  "1-2x / week": 0, // hyphen, defensively
  "3–4x / week": 1,
  "3-4x / week": 1,
  Daily: 1,
};

function calculateBMI(weight, height) {
  const w = parseFloat(weight);
  const h = parseFloat(height) / 100; // cm to m
  if (!w || !h || h <= 0) return 22; // population median fallback
  return parseFloat((w / (h * h)).toFixed(1));
}

function calculateWHR(waist, hip) {
  const w = parseFloat(waist);
  const h = parseFloat(hip);
  if (!(w > 0) || !(h > 0)) return null;
  return parseFloat((w / h).toFixed(2));
}

function mapSymptomsToMLInput(symptoms) {
  const reported = Array.isArray(symptoms.symptoms) ? symptoms.symptoms : [];
  const has = (key) => (reported.includes(key) ? 1 : 0);

  const whr = calculateWHR(symptoms.waist, symptoms.hip);

  return {
    age: parseFloat(symptoms.age) || 25,
    bmi: calculateBMI(symptoms.weight, symptoms.height),
    weight: parseFloat(symptoms.weight) || 60,

    cycle_regularity:
      symptoms.cycleRegularity === "Regular"
        ? 2
        : symptoms.cycleRegularity === "Irregular"
          ? 4
          : 5,
    cycle_length: parseFloat(symptoms.cycleLength) || 28,

    weight_gain: has("weight_gain"),
    hair_growth: has("hair_growth"),
    skin_darkening: has("skin_darkening"),
    hair_loss: has("hair_loss"),
    pimples: has("acne"),

    // D-01 — was hardcoded to 0 for every user in the system.
    fast_food: FAST_FOOD_SCORE[symptoms.fastFoodFrequency] ?? 0,
    regular_exercise: symptoms.exerciseHabit === "Active" ? 1 : 0,

    // D-02 — real when the user supplied measurements, median otherwise.
    waist_hip_ratio: whr ?? WHR_FALLBACK,

    // ── Not collected by the app ──────────────────────────────────────────────
    // These remain constants. The model was trained with them, so they cannot
    // simply be dropped without retraining, but they carry no user signal and
    // should not be presented in any explanation as though they did — see
    // `SYNTHETIC_FEATURES` below, which the response filter uses.
    pregnant: 0,
    num_abortions: 0,
    years_married: symptoms.maritalStatus === "Married" ? 5 : 0,
  };
}

/**
 * Features whose values the user never supplied. Any SHAP attribution naming
 * one of these is explaining a constant we invented, so it is stripped before
 * the result reaches the app rather than being shown as a reason for the score.
 */
const SYNTHETIC_FEATURES = new Set([
  "pregnant",
  "num_abortions",
  "years_married",
  "Pregnant",
  "Number of abortions",
  "Years married",
]);

function stripSyntheticAttributions(features, whrWasMeasured) {
  if (!Array.isArray(features)) return [];
  return features.filter((f) => {
    const name = f?.feature ?? "";
    if (SYNTHETIC_FEATURES.has(name)) return false;
    // The waist-hip ratio is only a real explanation when the user measured it.
    if (!whrWasMeasured && /waist|hip/i.test(name)) return false;
    return true;
  });
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

/**
 * Personalised guidance for a completed assessment, generated by Groq.
 *
 * Kept separate from `/predict` deliberately: the score must not wait on a
 * language model. The app renders the result as soon as the model returns,
 * then fills the guidance in when it arrives — and if it never arrives, the
 * built-in suggestions are already on screen.
 *
 * Returns `{ suggestions: null }` rather than an error when generation is
 * unavailable, because it is an enhancement and the caller has a fallback.
 */
const getRecommendations = async (req, res) => {
  try {
    const { answers } = req.body;

    if (!answers || typeof answers !== "object") {
      return res.status(400).json({ error: "answers is required" });
    }

    const suggestions = await groqService.getRecommendations(answers);

    res.json({
      suggestions,
      // The app labels generated content as such. It cannot do that unless
      // the server tells it which of the two it received.
      generated: Array.isArray(suggestions),
    });
  } catch (error) {
    console.error("[ERROR] getRecommendations:", error);
    // Still a 200: the client's fallback path is the same either way, and a
    // failure here must never look like the assessment itself failed.
    res.json({ suggestions: null, generated: false });
  }
};

module.exports = {
  predictPCOSRisk,
  getPredictionHistory,
  getLatestPrediction,
  getRecommendations,
};
