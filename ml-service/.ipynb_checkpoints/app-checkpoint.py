"""
PCOS Risk Prediction Flask API
================================
Flask microservice exposing a /predict endpoint for PCOS risk prediction.
Receives clinical feature vectors, processes them through the trained model,
computes SHAP values, and returns risk score with explainability.

Based on Chapter 3, Section 3.10.3.
"""

import numpy as np
import os
import joblib
import warnings
from flask import Flask, request, jsonify
from flask_cors import CORS
import shap

warnings.filterwarnings("ignore")

# ─── Configuration ──────────────────────────────────────────────────────────
MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
PORT = int(os.environ.get("ML_SERVICE_PORT", 5000))

app = Flask(__name__)
CORS(app)

# ─── Load Model Artifacts on Startup ────────────────────────────────────────
model = None
scaler = None
features = None
feature_map = None
shap_explainer = None


def load_model_artifacts():
    """Load all model artifacts into memory."""
    global model, scaler, features, feature_map, shap_explainer

    model = joblib.load(os.path.join(MODEL_DIR, "best_model.pkl"))
    scaler = joblib.load(os.path.join(MODEL_DIR, "scaler.pkl"))
    features = joblib.load(os.path.join(MODEL_DIR, "feature_names.pkl"))
    feature_map = joblib.load(os.path.join(MODEL_DIR, "feature_name_map.pkl"))

    # Try to load pre-computed SHAP explainer
    explainer_path = os.path.join(MODEL_DIR, "shap_explainer.pkl")
    if os.path.exists(explainer_path):
        shap_explainer = joblib.load(explainer_path)
    else:
        # Create a new one
        try:
            if hasattr(model, "estimators_") and hasattr(model, "voting"):
                shap_explainer = shap.TreeExplainer(model.estimators_[0])
            elif hasattr(model, "calibrated_classifiers_"):
                base = model.calibrated_classifiers_[0].estimator
                shap_explainer = shap.TreeExplainer(base)
            else:
                shap_explainer = shap.TreeExplainer(model)
        except Exception:
            shap_explainer = None

    print("[INFO] Model artifacts loaded successfully")
    print(f"[INFO] Features: {[feature_map.get(f, f) for f in features]}")


# ─── Feature Input Mapping ──────────────────────────────────────────────────
# Maps user-friendly API field names to internal feature column names
API_FIELD_MAP = {
    "age": "Age (yrs)",
    "bmi": "BMI",
    "cycle_regularity": "Cycle(R/I)",        # 2=Regular, 4=Irregular
    "cycle_length": "Cycle length(days)",
    "weight_gain": "Weight gain(Y/N)",        # 0 or 1
    "hair_growth": "hair growth(Y/N)",        # 0 or 1
    "skin_darkening": "Skin darkening (Y/N)", # 0 or 1
    "hair_loss": "Hair loss(Y/N)",            # 0 or 1
    "pimples": "Pimples(Y/N)",                # 0 or 1
    "fast_food": "Fast food (Y/N)",           # 0 or 1
    "regular_exercise": "Reg.Exercise(Y/N)",  # 0 or 1
    "waist_hip_ratio": "Waist:Hip Ratio",
    "pregnant": "Pregnant(Y/N)",              # 0 or 1
    "num_abortions": "No. of abortions",
    "weight": "Weight (Kg)",
    "years_married": "Marraige Status (Yrs)",
}


def classify_risk(score):
    """Classify risk score into low/moderate/high with colour."""
    if score < 30:
        return {"level": "Low", "color": "#4CAF50", "description": "Your predicted PCOS risk is low. Continue maintaining healthy lifestyle habits."}
    elif score < 60:
        return {"level": "Moderate", "color": "#FF9800", "description": "Your predicted PCOS risk is moderate. Consider consulting a healthcare provider for further assessment."}
    else:
        return {"level": "High", "color": "#F44336", "description": "Your predicted PCOS risk is high. We strongly recommend consulting a qualified healthcare professional for a clinical evaluation."}


def get_shap_explanation(input_scaled, top_n=3):
    """Compute SHAP values for a single prediction and return top features."""
    if shap_explainer is None:
        return []

    try:
        shap_values = shap_explainer.shap_values(input_scaled)

        # Handle different SHAP output formats
        if isinstance(shap_values, list):
            sample_shap = shap_values[1][0]  # Class 1 (PCOS), first sample
        else:
            sample_shap = shap_values[0]

        # Pair features with SHAP values
        feature_importance = list(zip(features, sample_shap))
        feature_importance.sort(key=lambda x: abs(x[1]), reverse=True)

        explanations = []
        for feat_name, shap_val in feature_importance[:top_n]:
            friendly_name = feature_map.get(feat_name, feat_name)
            direction = "increases" if shap_val > 0 else "decreases"
            explanations.append({
                "feature": friendly_name,
                "shap_value": round(float(shap_val), 4),
                "direction": direction,
                "explanation": f"Your {friendly_name.lower()} {direction} your risk score"
            })

        return explanations

    except Exception as e:
        print(f"[WARNING] SHAP computation failed: {e}")
        return []


# ─── API Endpoints ──────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint."""
    return jsonify({
        "status": "healthy",
        "model_loaded": model is not None,
        "features_count": len(features) if features is not None else 0,
    })


@app.route("/predict", methods=["POST"])
def predict():
    """
    PCOS Risk Prediction Endpoint.

    Expects JSON payload with clinical features.
    Returns risk score, risk level, and SHAP explanations.

    Example request:
    {
        "age": 28,
        "bmi": 25.3,
        "cycle_regularity": 4,
        "cycle_length": 5,
        "weight_gain": 1,
        "hair_growth": 1,
        "skin_darkening": 0,
        "hair_loss": 1,
        "pimples": 1,
        "fast_food": 1,
        "regular_exercise": 0,
        "waist_hip_ratio": 0.85,
        "pregnant": 0,
        "num_abortions": 0,
        "weight": 68,
        "years_married": 5
    }
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({"error": "No JSON data provided"}), 400

        # Build feature vector in the correct order
        feature_values = []
        missing_fields = []

        for api_field, internal_name in API_FIELD_MAP.items():
            if internal_name in features:
                if api_field in data:
                    feature_values.append(float(data[api_field]))
                else:
                    missing_fields.append(api_field)

        if missing_fields:
            return jsonify({
                "error": "Missing required fields",
                "missing_fields": missing_fields,
                "required_fields": list(API_FIELD_MAP.keys())
            }), 400

        # Convert to numpy array and scale
        input_array = np.array([feature_values])
        input_scaled = scaler.transform(input_array)

        # Get prediction
        risk_probability = model.predict_proba(input_scaled)[0][1]
        risk_score = round(float(risk_probability * 100), 1)

        # Classify risk level
        risk_classification = classify_risk(risk_score)

        # Get SHAP explanations
        explanations = get_shap_explanation(input_scaled, top_n=3)

        response = {
            "success": True,
            "risk_score": risk_score,
            "risk_probability": round(float(risk_probability), 4),
            "risk_level": risk_classification["level"],
            "risk_color": risk_classification["color"],
            "risk_description": risk_classification["description"],
            "top_features": explanations,
            "disclaimer": (
                "This risk score is NOT a clinical diagnosis. "
                "It is a statistical prediction based on self-reported features. "
                "Please consult a qualified healthcare professional for "
                "formal assessment and diagnosis."
            )
        }

        return jsonify(response)

    except ValueError as e:
        return jsonify({"error": f"Invalid input value: {str(e)}"}), 400
    except Exception as e:
        return jsonify({"error": f"Prediction failed: {str(e)}"}), 500


@app.route("/features", methods=["GET"])
def get_features():
    """Return the list of required input features with descriptions."""
    if features is None or feature_map is None:
        return jsonify({"error": "Model not loaded yet"}), 503
    feature_info = []
    for api_field, internal_name in API_FIELD_MAP.items():
        if internal_name in features:
            friendly_name = feature_map.get(internal_name, internal_name)
            feature_info.append({
                "field": api_field,
                "name": friendly_name,
                "type": "binary" if "(Y/N)" in internal_name or internal_name == "Cycle(R/I)" else "numeric",
                "description": _get_field_description(api_field)
            })
    return jsonify({"features": feature_info})


def _get_field_description(field):
    """Return a user-friendly description for each input field."""
    descriptions = {
        "age": "Your age in years",
        "bmi": "Body Mass Index (weight in kg / height in m²)",
        "cycle_regularity": "Menstrual cycle regularity (2 = Regular, 4 = Irregular)",
        "cycle_length": "Average menstrual cycle length in days",
        "weight_gain": "Have you experienced recent unexplained weight gain? (0 = No, 1 = Yes)",
        "hair_growth": "Do you experience excessive hair growth (hirsutism)? (0 = No, 1 = Yes)",
        "skin_darkening": "Do you have darkened skin patches (acanthosis nigricans)? (0 = No, 1 = Yes)",
        "hair_loss": "Are you experiencing unusual hair loss? (0 = No, 1 = Yes)",
        "pimples": "Do you have persistent acne or pimples? (0 = No, 1 = Yes)",
        "fast_food": "Do you regularly consume fast food? (0 = No, 1 = Yes)",
        "regular_exercise": "Do you exercise regularly? (0 = No, 1 = Yes)",
        "waist_hip_ratio": "Waist-to-hip ratio (waist circumference / hip circumference)",
        "pregnant": "Are you currently pregnant? (0 = No, 1 = Yes)",
        "num_abortions": "Number of pregnancy losses or miscarriages",
        "weight": "Your current weight in kilograms",
        "years_married": "Number of years married (0 if unmarried)",
    }
    return descriptions.get(field, "")


# ─── Main ───────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    load_model_artifacts()
    print(f"\n[INFO] Starting PCOS ML Inference Service on port {PORT}")
    print("[INFO] Endpoints:")
    print("  GET  /health   - Health check")
    print("  POST /predict  - Risk prediction")
    print("  GET  /features - Feature descriptions")
    app.run(host="0.0.0.0", port=PORT, debug=False)
