"""
PCOS Model Evaluation Module
==============================
Loads the saved model and test set, computes all metrics,
generates SHAP summary plots and detailed evaluation.

Based on Chapter 3, Section 3.12.4 - 3.12.5.
"""

import numpy as np
import os
import joblib
import warnings

from sklearn.metrics import (
    roc_auc_score, accuracy_score, precision_score,
    recall_score, f1_score, classification_report,
    brier_score_loss, confusion_matrix
)
try:
    import shap
    SHAP_AVAILABLE = True
except Exception:
    shap = None
    SHAP_AVAILABLE = False
    print("[WARNING] 'shap' package not available; SHAP analysis will be skipped. Install with 'pip install shap'.")
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from soft_voting_ensemble import SoftVotingEnsemble  # required for pickle to find the classv

warnings.filterwarnings("ignore")

MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
PLOTS_DIR = os.path.join(os.path.dirname(__file__), "plots")


def load_artifacts():
    """Load saved model, test data, and feature info."""
    model = joblib.load(os.path.join(MODEL_DIR, "best_model.pkl"))
    test_data = joblib.load(os.path.join(MODEL_DIR, "test_data.pkl"))
    features = joblib.load(os.path.join(MODEL_DIR, "feature_names.pkl"))
    feature_map = joblib.load(os.path.join(MODEL_DIR, "feature_name_map.pkl"))
    scaler = joblib.load(os.path.join(MODEL_DIR, "scaler.pkl"))

    return model, test_data, features, feature_map, scaler


def calculate_specificity(y_true, y_pred):
    """Calculate specificity (true negative rate) safely from a confusion matrix."""
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred).ravel()
    return tn / (tn + fp) if (tn + fp) > 0 else 0.0


def evaluate_on_test_set(model, X_test, y_test):
    """Compute comprehensive metrics on the held-out test set."""
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]

    sensitivity = recall_score(y_test, y_pred, zero_division=0)
    specificity = calculate_specificity(y_test, y_pred)

    metrics = {
        "AUC-ROC": roc_auc_score(y_test, y_prob),
        "Accuracy": accuracy_score(y_test, y_pred),
        "Precision": precision_score(y_test, y_pred, zero_division=0),
        "Sensitivity (Recall)": sensitivity,
        "Specificity": specificity,
        "F1 Score": f1_score(y_test, y_pred, zero_division=0),
        "Brier Score": brier_score_loss(y_test, y_prob),
    }

    return metrics, y_pred, y_prob

def generate_shap_analysis(model, X_test, features, feature_map):
    """
    Generate SHAP analysis for model explainability.
    """
    os.makedirs(PLOTS_DIR, exist_ok=True)
    friendly_names = [feature_map.get(f, f) for f in features]

    try:
        if hasattr(model, "estimators_") and hasattr(model, "voting"):
            print("[INFO] Using sub-estimator for SHAP (VotingClassifier detected)")
            shap_model = model.estimators_[0]
        elif hasattr(model, "calibrated_classifiers_"):
            print("[INFO] Using base estimator for SHAP (CalibratedClassifier detected)")
            shap_model = model.calibrated_classifiers_[0].estimator
        else:
            shap_model = model

        explainer = shap.TreeExplainer(shap_model)
        shap_values = explainer.shap_values(X_test)

        if isinstance(shap_values, list) and len(shap_values) == 2:
            shap_values_positive = np.array(shap_values[1])
        elif isinstance(shap_values, np.ndarray) and shap_values.ndim == 3:
            shap_values_positive = shap_values[:, :, 1]
        else:
            shap_values_positive = np.array(shap_values)

    except Exception as e:
        print(f"[WARNING] TreeExplainer failed ({e}), using KernelExplainer...")
        background = (
            shap.sample(X_test, min(50, len(X_test)))
            if hasattr(shap, "sample")
            else X_test[: min(50, len(X_test))]
        )
        predict_proba = getattr(model, "predict_proba", None)
        if predict_proba is None:
            raise AttributeError("Model does not implement predict_proba for SHAP KernelExplainer")
        explainer = shap.KernelExplainer(predict_proba, background)
        shap_values = explainer.shap_values(X_test)

        # KernelExplainer returns (n_samples, n_features, n_classes) or list
        if isinstance(shap_values, np.ndarray) and shap_values.ndim == 3:
            shap_values_positive = shap_values[:, :, 1]
        elif isinstance(shap_values, list) and len(shap_values) == 2:
            shap_values_positive = np.array(shap_values[1])
        else:
            shap_values_positive = np.array(shap_values)

    # SHAP Summary Plot (Bar)
    plt.figure(figsize=(12, 8))
    shap.summary_plot(
        shap_values_positive, X_test,
        feature_names=friendly_names,
        plot_type="bar", show=False
    )
    plt.title("SHAP Feature Importance - PCOS Risk Prediction", fontsize=14)
    plt.tight_layout()
    plt.savefig(os.path.join(PLOTS_DIR, "shap_bar_plot.png"), dpi=150)
    plt.close()
    print(f"[INFO] SHAP bar plot saved to {PLOTS_DIR}/shap_bar_plot.png")

    # SHAP Summary Plot (Beeswarm)
    plt.figure(figsize=(12, 8))
    shap.summary_plot(
        shap_values_positive, X_test,
        feature_names=friendly_names, show=False
    )
    plt.title("SHAP Summary - PCOS Risk Prediction", fontsize=14)
    plt.tight_layout()
    plt.savefig(os.path.join(PLOTS_DIR, "shap_beeswarm_plot.png"), dpi=150)
    plt.close()
    print(f"[INFO] SHAP beeswarm plot saved to {PLOTS_DIR}/shap_beeswarm_plot.png")

    return shap_values_positive, explainer

   


def get_top_features_for_sample(shap_values, features, feature_map, sample_idx=0, top_n=3):
    """
    Get the top N most important features for a specific prediction.
    Handles both 2D and 3D SHAP value arrays.
    """
    # Handle 3D array: (samples, features, classes) → take class 1
    if hasattr(shap_values, 'ndim') and shap_values.ndim == 3:
        sample_shap = shap_values[sample_idx, :, 1]
    elif isinstance(shap_values, list):
        sample_shap = np.array(shap_values[1])[sample_idx]
    else:
        sample_shap = np.array(shap_values)[sample_idx]

    # Flatten in case it's still nested
    sample_shap = np.array(sample_shap).flatten()

    feature_importance = list(zip(features, sample_shap))
    feature_importance.sort(key=lambda x: abs(float(x[1])), reverse=True)

    top_features = []
    for feat_name, shap_val in feature_importance[:top_n]:
        friendly_name = feature_map.get(feat_name, feat_name)
        direction = "increases" if float(shap_val) > 0 else "decreases"
        top_features.append({
            "feature": friendly_name,
            "shap_value": round(float(shap_val), 4),
            "direction": direction,
            "explanation": f"Your {friendly_name.lower()} {direction} your risk score"
        })

    return top_features


def run_evaluation():
    """Run complete model evaluation with SHAP analysis."""
    print("=" * 60)
    print("  PCOS Model Evaluation Report")
    print("=" * 60)

    # Load artifacts
    model, test_data, features, feature_map, scaler = load_artifacts()
    X_test = test_data["X_test"]
    y_test = test_data["y_test"]

    print(f"\nTest set: {X_test.shape[0]} samples, {X_test.shape[1]} features")
    print(f"Features: {[feature_map.get(f, f) for f in features]}")

    # Compute metrics
    metrics, y_pred, y_prob = evaluate_on_test_set(model, X_test, y_test)

    print(f"\n{'─' * 40}")
    print("  Test Set Metrics")
    print(f"{'─' * 40}")
    for name, value in metrics.items():
        print(f"  {name:.<30} {value:.4f}")

    # NFR-14 Compliance Check
    print(f"\n{'─' * 40}")
    print("  NFR-14 Compliance Check")
    print(f"{'─' * 40}")
    auc_met = metrics["AUC-ROC"] >= 0.85
    sens_met = metrics["Sensitivity (Recall)"] >= 0.80
    print(f"  AUC >= 0.85:         {'✓ PASS' if auc_met else '✗ FAIL'} "
          f"({metrics['AUC-ROC']:.4f})")
    print(f"  Sensitivity >= 0.80: {'✓ PASS' if sens_met else '✗ FAIL'} "
          f"({metrics['Sensitivity (Recall)']:.4f})")

    # Classification Report
    print(f"\n{'-' * 40}")
    print("  Classification Report")
    print(f"{'-' * 40}")
    print(classification_report(
        y_test, y_pred, target_names=["No PCOS", "PCOS"]
    ))

    # Confusion Matrix
    cm = confusion_matrix(y_test, y_pred)
    print("Confusion Matrix:")
    print(f"  TN={cm[0][0]}, FP={cm[0][1]}")
    print(f"  FN={cm[1][0]}, TP={cm[1][1]}")

    # SHAP Analysis (skip if shap package missing)
    if SHAP_AVAILABLE:
        print(f"\n{'-' * 40}")
        print("  SHAP Explainability Analysis")
        print(f"{'-' * 40}")
        shap_values, explainer = generate_shap_analysis(
            model, X_test, features, feature_map
        )

        # Example: Top 3 features for first test sample
        try:
            top_features = get_top_features_for_sample(
                shap_values, features, feature_map, sample_idx=0, top_n=3
            )
            print("\n  Example prediction explanation (sample 0):")
            for tf in top_features:
                print(f"    - {tf['feature']}: SHAP={tf['shap_value']:.4f} ({tf['direction']} risk)")
        except Exception:
            print("[WARNING] Could not compute example SHAP explanations for sample 0.")

        # Save SHAP explainer for API use — KernelExplainer can't be pickled,
        # so we save the background data and recreate it in app.py on demand
        explainer_path = os.path.join(MODEL_DIR, "shap_explainer.pkl")
        if explainer is not None and hasattr(explainer, 'data'):
            # KernelExplainer — save background data instead
            joblib.dump(
                {"type": "kernel", "background": explainer.data},
                explainer_path
            )
            print(f"\n[SUCCESS] SHAP background data saved to {explainer_path}")
        elif explainer is not None:
            # TreeExplainer — can be pickled normally
            joblib.dump(explainer, explainer_path)
            print(f"\n[SUCCESS] SHAP explainer saved to {explainer_path}")
        else:
            print("[WARNING] No SHAP explainer to save.")
    else:
        print("[WARNING] Skipping SHAP analysis because 'shap' package is not installed.")
        shap_values = None
        explainer = None

    return metrics


if __name__ == "__main__":
    metrics = run_evaluation()
