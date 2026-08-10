"""
PCOS Risk Prediction Flask API
================================
Flask microservice exposing a /predict endpoint for PCOS risk prediction.

This version is prepared for deployment as a Docker Space on Hugging Face.
It:
- listens on port 7860 by default (Hugging Face Docker Spaces)
- loads model artifacts from the local models/ directory
- exposes health, prediction, and feature endpoints
- supports CORS for the React Native frontend
- uses SHAP when available, but does not require SHAP for predictions
"""

import os
import warnings

import flask
import joblib
import numpy as np
from flask_cors import CORS

# Required so joblib can reconstruct the custom ensemble class when loading
# the trained model.
from soft_voting_ensemble import SoftVotingEnsemble  # noqa: F401


warnings.filterwarnings("ignore")


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "models")

# Hugging Face Docker Spaces uses port 7860 by default.
# PORT can still be overridden with an environment variable if necessary.
PORT = int(
    os.environ.get(
        "PORT",
        os.environ.get("ML_SERVICE_PORT", "7860"),
    )
)

app = flask.Flask(__name__)

# Allow the React Native/mobile frontend to call this API.
CORS(app)


# ---------------------------------------------------------------------------
# Optional SHAP support
# ---------------------------------------------------------------------------

try:
    import shap

    SHAP_AVAILABLE = True
except Exception as exc:
    shap = None
    SHAP_AVAILABLE = False
    print(
        f"[WARNING] SHAP is not available. "
        f"Predictions will still work without explanations. Details: {exc}"
    )


# ---------------------------------------------------------------------------
# Model artifacts
# ---------------------------------------------------------------------------

model = None
scaler = None
features = None
feature_map = None
shap_explainer = None


def load_model_artifacts():
    """Load all required model artifacts into memory."""

    global model, scaler, features, feature_map, shap_explainer

    required_files = {
        "model": "best_model.pkl",
        "scaler": "scaler.pkl",
        "features": "feature_names.pkl",
        "feature_map": "feature_name_map.pkl",
    }

    missing = [
        filename
        for filename in required_files.values()
        if not os.path.exists(os.path.join(MODEL_DIR, filename))
    ]

    if missing:
        raise FileNotFoundError(
            "The following required model files are missing from "
            f"'{MODEL_DIR}': {', '.join(missing)}"
        )

    model = joblib.load(os.path.join(MODEL_DIR, "best_model.pkl"))
    scaler = joblib.load(os.path.join(MODEL_DIR, "scaler.pkl"))
    features = joblib.load(os.path.join(MODEL_DIR, "feature_names.pkl"))
    feature_map = joblib.load(os.path.join(MODEL_DIR, "feature_name_map.pkl"))

    # Try to load/recreate SHAP only if it is installed.
    shap_explainer = None

    if not SHAP_AVAILABLE:
        print("[INFO] SHAP disabled.")
        return

    explainer_path = os.path.join(MODEL_DIR, "shap_explainer.pkl")

    if os.path.exists(explainer_path):
        try:
            saved = joblib.load(explainer_path)

            if isinstance(saved, dict) and saved.get("type") == "kernel":
                background = saved.get("background")

                if background is not None:
                    shap_explainer = shap.KernelExplainer(
                        model.predict_proba,
                        background,
                    )
                    print("[INFO] SHAP KernelExplainer recreated.")
                else:
                    print(
                        "[WARNING] SHAP background data is missing; "
                        "SHAP explanations will be disabled."
                    )
            else:
                shap_explainer = saved
                print("[INFO] Saved SHAP explainer loaded.")

        except Exception as exc:
            print(
                f"[WARNING] Could not load/recreate saved SHAP explainer: {exc}"
            )
            shap_explainer = None

    # If there is no saved explainer, try to create a TreeExplainer.
    if shap_explainer is None:
        try:
            if hasattr(model, "estimators_"):
                shap_explainer = shap.TreeExplainer(model.estimators_[0])
            else:
                shap_explainer = shap.TreeExplainer(model)

            print("[INFO] SHAP TreeExplainer created.")

        except Exception as exc:
            print(
                f"[WARNING] Could not create SHAP explainer: {exc}. "
                "The API will continue without SHAP explanations."
            )
            shap_explainer = None


# Load the model when the module starts so both Flask and Gunicorn have
# the model ready before requests arrive.
load_model_artifacts()


# ---------------------------------------------------------------------------
# Feature input mapping
# ---------------------------------------------------------------------------
# Maps user-friendly API field names to the exact feature names used during
# model training.

API_FIELD_MAP = {
    "age": "Age (yrs)",
    "bmi": "BMI",
    "cycle_regularity": "Cycle(R/I)",        # 2 = Regular, 4 = Irregular
    "cycle_length": "Cycle length(days)",
    "weight_gain": "Weight gain(Y/N)",        # 0 = No, 1 = Yes
    "hair_growth": "hair growth(Y/N)",        # 0 = No, 1 = Yes
    "skin_darkening": "Skin darkening (Y/N)", # 0 = No, 1 = Yes
    "hair_loss": "Hair loss(Y/N)",            # 0 = No, 1 = Yes
    "pimples": "Pimples(Y/N)",                # 0 = No, 1 = Yes
    "fast_food": "Fast food (Y/N)",           # 0 = No, 1 = Yes
    "regular_exercise": "Reg.Exercise(Y/N)",  # 0 = No, 1 = Yes
    "waist_hip_ratio": "Waist:Hip Ratio",
    "pregnant": "Pregnant(Y/N)",              # 0 = No, 1 = Yes
    "num_abortions": "No. of abortions",
    "weight": "Weight (Kg)",
    "years_married": "Marraige Status (Yrs)",
}


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def classify_risk(score):
    """Classify risk score into low, moderate, or high."""

    if score < 30:
        return {
            "level": "Low",
            "color": "#4CAF50",
            "description": (
                "Your predicted PCOS risk is low. Continue maintaining "
                "healthy lifestyle habits."
            ),
        }

    if score < 60:
        return {
            "level": "Moderate",
            "color": "#FF9800",
            "description": (
                "Your predicted PCOS risk is moderate. Consider consulting "
                "a healthcare provider for further assessment."
            ),
        }

    return {
        "level": "High",
        "color": "#F44336",
        "description": (
            "Your predicted PCOS risk is high. We strongly recommend "
            "consulting a qualified healthcare professional for a clinical "
            "evaluation."
        ),
    }


def get_shap_explanation(input_scaled, top_n=3):
    """Compute SHAP values for one prediction and return top features."""

    if shap_explainer is None:
        return []

    try:
        shap_values = shap_explainer.shap_values(input_scaled)

        # SHAP can return either a list of arrays or a single array.
        if isinstance(shap_values, list):
            if len(shap_values) > 1:
                sample_shap = np.asarray(shap_values[1])[0]
            else:
                sample_shap = np.asarray(shap_values[0])[0]
        else:
            values = np.asarray(shap_values)

            if values.ndim == 3:
                # Typical multi-class format:
                # (samples, features, classes)
                sample_shap = values[0, :, 1]
            elif values.ndim == 2:
                sample_shap = values[0]
            else:
                sample_shap = values.flatten()

        feature_names = list(features)

        # Protect against an unexpected SHAP/model feature-count mismatch.
        if len(sample_shap) != len(feature_names):
            print(
                "[WARNING] SHAP feature count does not match model feature "
                "count; explanations skipped."
            )
            return []

        feature_importance = list(zip(feature_names, sample_shap))
        feature_importance.sort(
            key=lambda item: abs(float(item[1])),
            reverse=True,
        )

        explanations = []

        for feature_name, shap_value in feature_importance[:top_n]:
            friendly_name = feature_map.get(feature_name, feature_name)
            direction = "increases" if float(shap_value) > 0 else "decreases"

            explanations.append(
                {
                    "feature": friendly_name,
                    "shap_value": round(float(shap_value), 4),
                    "direction": direction,
                    "explanation": (
                        f"Your {str(friendly_name).lower()} "
                        f"{direction} your risk score"
                    ),
                }
            )

        return explanations

    except Exception as exc:
        print(f"[WARNING] SHAP computation failed: {exc}")
        return []


# ---------------------------------------------------------------------------
# API endpoints
# ---------------------------------------------------------------------------

@app.route("/", methods=["GET"])
def home():
    """Simple landing/verification endpoint."""

    return flask.jsonify(
        {
            "service": "PCOS Risk Prediction API",
            "status": "running",
            "message": "PCOS ML inference service is running.",
            "endpoints": {
                "health": "GET /health",
                "predict": "POST /predict",
                "features": "GET /features",
            },
        }
    )


@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint used to verify that the service is running."""

    return flask.jsonify(
        {
            "status": "healthy",
            "model_loaded": model is not None,
            "features_count": len(features) if features is not None else 0,
            "shap_available": SHAP_AVAILABLE,
            "shap_explainer_loaded": shap_explainer is not None,
        }
    )


@app.route("/predict", methods=["POST"])
def predict():
    """
    PCOS Risk Prediction Endpoint.

    Expects JSON containing the 16 API fields defined in API_FIELD_MAP.

    Returns:
        risk score
        risk probability
        risk level
        top SHAP features when available
        medical disclaimer
    """

    try:
        data = flask.request.get_json(silent=True)

        if not data:
            return flask.jsonify(
                {"error": "No JSON data provided."}
            ), 400

        # Check all required API fields.
        missing_fields = [
            api_field
            for api_field in API_FIELD_MAP
            if api_field not in data
        ]

        if missing_fields:
            return flask.jsonify(
                {
                    "error": "Missing required fields.",
                    "missing_fields": missing_fields,
                    "required_fields": list(API_FIELD_MAP.keys()),
                }
            ), 400

        # Build the feature vector in the SAME ORDER used by the trained model.
        #
        # This is safer than relying on the order of API_FIELD_MAP because
        # feature_names.pkl represents the exact training feature order.
        feature_values = []

        for internal_feature in features:
            matching_api_field = None

            for api_field, mapped_internal_name in API_FIELD_MAP.items():
                if mapped_internal_name == internal_feature:
                    matching_api_field = api_field
                    break

            if matching_api_field is None:
                return flask.jsonify(
                    {
                        "error": "Model feature is not mapped to an API field.",
                        "feature": internal_feature,
                    }
                ), 500

            try:
                feature_values.append(
                    float(data[matching_api_field])
                )
            except (TypeError, ValueError):
                return flask.jsonify(
                    {
                        "error": "Invalid numeric value.",
                        "field": matching_api_field,
                        "value": data[matching_api_field],
                    }
                ), 400

        # Convert to numpy array and apply the same scaler used during training.
        input_array = np.asarray([feature_values], dtype=float)
        input_scaled = scaler.transform(input_array)

        # Generate model prediction.
        if not hasattr(model, "predict_proba"):
            return flask.jsonify(
                {
                    "error": (
                        "Loaded model does not provide predict_proba(), "
                        "which is required to calculate the risk probability."
                    )
                }
            ), 500

        risk_probability = float(model.predict_proba(input_scaled)[0][1])
        risk_probability = max(0.0, min(1.0, risk_probability))

        risk_score = round(risk_probability * 100, 1)

        risk_classification = classify_risk(risk_score)

        explanations = get_shap_explanation(
            input_scaled,
            top_n=3,
        )

        response = {
            "success": True,
            "risk_score": risk_score,
            "risk_probability": round(risk_probability, 4),
            "risk_level": risk_classification["level"],
            "risk_color": risk_classification["color"],
            "risk_description": risk_classification["description"],
            "top_features": explanations,
            "disclaimer": (
                "This risk score is NOT a clinical diagnosis. "
                "It is a statistical prediction based on self-reported "
                "features. Please consult a qualified healthcare "
                "professional for formal assessment and diagnosis."
            ),
        }

        return flask.jsonify(response)

    except ValueError as exc:
        return flask.jsonify(
            {"error": f"Invalid input value: {str(exc)}"}
        ), 400

    except Exception as exc:
        print(f"[ERROR] Prediction failed: {exc}")

        return flask.jsonify(
            {"error": f"Prediction failed: {str(exc)}"}
        ), 500


@app.route("/features", methods=["GET"])
def get_features():
    """Return required input features and descriptions."""

    if features is None or feature_map is None:
        return flask.jsonify(
            {"error": "Model not loaded yet."}
        ), 503

    feature_info = []

    for api_field, internal_name in API_FIELD_MAP.items():
        if internal_name in features:
            friendly_name = feature_map.get(
                internal_name,
                internal_name,
            )

            feature_info.append(
                {
                    "field": api_field,
                    "name": friendly_name,
                    "type": (
                        "binary"
                        if "(Y/N)" in internal_name
                        or internal_name == "Cycle(R/I)"
                        else "numeric"
                    ),
                    "description": _get_field_description(api_field),
                }
            )

    return flask.jsonify(
        {
            "features": feature_info,
            "count": len(feature_info),
        }
    )


def _get_field_description(field):
    """Return a user-friendly description for each input field."""

    descriptions = {
        "age": "Your age in years",
        "bmi": "Body Mass Index (weight in kg / height in m²)",
        "cycle_regularity": (
            "Menstrual cycle regularity "
            "(2 = Regular, 4 = Irregular)"
        ),
        "cycle_length": "Average menstrual cycle length in days",
        "weight_gain": (
            "Have you experienced recent unexplained weight gain? "
            "(0 = No, 1 = Yes)"
        ),
        "hair_growth": (
            "Do you experience excessive hair growth (hirsutism)? "
            "(0 = No, 1 = Yes)"
        ),
        "skin_darkening": (
            "Do you have darkened skin patches (acanthosis nigricans)? "
            "(0 = No, 1 = Yes)"
        ),
        "hair_loss": (
            "Are you experiencing unusual hair loss? "
            "(0 = No, 1 = Yes)"
        ),
        "pimples": (
            "Do you have persistent acne or pimples? "
            "(0 = No, 1 = Yes)"
        ),
        "fast_food": (
            "Do you regularly consume fast food? "
            "(0 = No, 1 = Yes)"
        ),
        "regular_exercise": (
            "Do you exercise regularly? "
            "(0 = No, 1 = Yes)"
        ),
        "waist_hip_ratio": (
            "Waist-to-hip ratio "
            "(waist circumference / hip circumference)"
        ),
        "pregnant": (
            "Are you currently pregnant? "
            "(0 = No, 1 = Yes)"
        ),
        "num_abortions": (
            "Number of pregnancy losses or miscarriages"
        ),
        "weight": "Your current weight in kilograms",
        "years_married": (
            "Number of years married (0 if unmarried)"
        ),
    }

    return descriptions.get(field, "")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print(
        f"\n[INFO] Starting PCOS ML Inference Service on port {PORT}"
    )
    print("[INFO] Endpoints:")
    print("  GET  /          - Service information")
    print("  GET  /health    - Health check")
    print("  POST /predict   - Risk prediction")
    print("  GET  /features  - Feature descriptions")

    app.run(
        host="0.0.0.0",
        port=PORT,
        debug=False,
    )
