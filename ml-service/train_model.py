"""
PCOS Model Training Module
===========================
Trains and evaluates four candidate classifiers:
  1. Logistic Regression (interpretable baseline)
  2. Random Forest
  3. XGBoost
  4. Voting Ensemble (Random Forest + XGBoost)

Uses stratified 5-fold cross-validation and RandomizedSearchCV
for hyperparameter tuning. Selects the best model by AUC.

Based on the methodology in Chapter 3 (Sections 3.12.3 - 3.12.5).
"""

import os
import joblib
import warnings
import json
from datetime import datetime
from soft_voting_ensemble import SoftVotingEnsemble
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, VotingClassifier
from sklearn.model_selection import (
    StratifiedKFold, RandomizedSearchCV, cross_val_score
)
from sklearn.metrics import (
    roc_auc_score, roc_curve, accuracy_score, precision_score,
    recall_score, f1_score, confusion_matrix, classification_report,
    brier_score_loss
)
from sklearn.calibration import CalibratedClassifierCV, calibration_curve
from xgboost import XGBClassifier

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns

from data_preprocessing import preprocess_pipeline

warnings.filterwarnings("ignore")

MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
PLOTS_DIR = os.path.join(os.path.dirname(__file__), "plots")
RANDOM_STATE = 42
N_CV_FOLDS = 5
N_ITER_SEARCH = 50


# ─── Hyperparameter Grids ──────────────────────────────────────────────────

LR_PARAMS = {
    "C": [0.001, 0.01, 0.1, 1, 10, 100],
    "penalty": ["l2"],
    "solver": ["lbfgs"],
    "max_iter": [1000],
}

RF_PARAMS = {
    "n_estimators": [50, 100, 200, 300, 500],
    "max_depth": [3, 5, 7, 10, 15, None],
    "min_samples_split": [2, 5, 10],
    "min_samples_leaf": [1, 2, 4],
    "max_features": ["sqrt", "log2"],
    "bootstrap": [True],
}

XGB_PARAMS = {
    "n_estimators": [50, 100, 200, 300],
    "max_depth": [3, 5, 7, 10],
    "learning_rate": [0.01, 0.05, 0.1, 0.2],
    "subsample": [0.6, 0.8, 1.0],
    "colsample_bytree": [0.6, 0.8, 1.0],
    "gamma": [0, 0.1, 0.3, 0.5],
    "reg_alpha": [0, 0.01, 0.1],
    "reg_lambda": [1, 1.5, 2],
}
# ─── Custom Soft Voting Ensemble ────────────────────────────────────────────
import numpy as np
from sklearn.base import BaseEstimator, ClassifierMixin, clone

class SoftVotingEnsemble(BaseEstimator, ClassifierMixin):
    """Soft voting ensemble that averages predicted probabilities."""

    def __init__(self, estimators):
        self.estimators = estimators

    def fit(self, X, y):
        self.estimators_ = []
        for name, est in self.estimators:
            cloned = clone(est)
            cloned.fit(X, y)
            self.estimators_.append(cloned)
        self.classes_ = np.unique(y)
        return self

    def predict_proba(self, X):
        probs = np.mean(
            [est.predict_proba(X) for est in self.estimators_], axis=0
        )
        return probs

    def predict(self, X):
        proba = self.predict_proba(X)
        return self.classes_[np.argmax(proba, axis=1)]

def train_logistic_regression(X_train, y_train):
    """Train Logistic Regression with hyperparameter tuning."""
    print("\n" + "=" * 60)
    print("Training Logistic Regression...")
    print("=" * 60)

    lr = LogisticRegression(random_state=RANDOM_STATE)
    cv = StratifiedKFold(n_splits=N_CV_FOLDS, shuffle=True,
                         random_state=RANDOM_STATE)

    search = RandomizedSearchCV(
        lr, LR_PARAMS, n_iter=6, cv=cv, scoring="roc_auc",
        random_state=RANDOM_STATE, n_jobs=-1, verbose=0
    )
    search.fit(X_train, y_train)

    best_model = search.best_estimator_
    print(f"  Best params: {search.best_params_}")
    print(f"  Best CV AUC: {search.best_score_:.4f}")

    return best_model, search.best_score_


def train_random_forest(X_train, y_train):
    """Train Random Forest with hyperparameter tuning."""
    print("\n" + "=" * 60)
    print("Training Random Forest...")
    print("=" * 60)

    rf = RandomForestClassifier(random_state=RANDOM_STATE)
    cv = StratifiedKFold(n_splits=N_CV_FOLDS, shuffle=True,
                         random_state=RANDOM_STATE)

    search = RandomizedSearchCV(
        rf, RF_PARAMS, n_iter=N_ITER_SEARCH, cv=cv, scoring="roc_auc",
        random_state=RANDOM_STATE, n_jobs=-1, verbose=0
    )
    search.fit(X_train, y_train)

    best_model = search.best_estimator_
    print(f"  Best params: {search.best_params_}")
    print(f"  Best CV AUC: {search.best_score_:.4f}")

    return best_model, search.best_score_


def train_xgboost(X_train, y_train):
    """Train XGBoost with hyperparameter tuning."""
    print("\n" + "=" * 60)
    print("Training XGBoost...")
    print("=" * 60)

    xgb = XGBClassifier(
        random_state=RANDOM_STATE,
        objective="binary:logistic",
        nthread=1,
    )
    cv = StratifiedKFold(n_splits=N_CV_FOLDS, shuffle=True,
                         random_state=RANDOM_STATE)

    search = RandomizedSearchCV(
        xgb, XGB_PARAMS, n_iter=N_ITER_SEARCH, cv=cv, scoring="roc_auc",
        random_state=RANDOM_STATE, n_jobs=1, verbose=0
    )
    search.fit(X_train, y_train,)

    best_model = search.best_estimator_
    print(f"  Best params: {search.best_params_}")
    print(f"  Best CV AUC: {search.best_score_:.4f}")

    return best_model, search.best_score_


def train_voting_ensemble(X_train, y_train, rf_model, xgb_model):
    """Train a Voting Ensemble combining Random Forest and XGBoost."""
    print("\n" + "=" * 60)
    print("Training Voting Ensemble (RF + XGBoost)...")
    print("=" * 60)

    best_xgb_params = xgb_model.get_params()
    for key in ("use_label_encoder", "nthread"):
        best_xgb_params.pop(key, None)

    fresh_xgb = XGBClassifier(**best_xgb_params)
    fresh_xgb.fit(X_train, y_train)

    ensemble = SoftVotingEnsemble(estimators=[
        ("rf", rf_model),
        ("xgb", fresh_xgb),
    ])
    ensemble.fit(X_train, y_train)

    cv = StratifiedKFold(n_splits=N_CV_FOLDS, shuffle=True,
                         random_state=RANDOM_STATE)
    cv_scores = cross_val_score(
        ensemble, X_train, y_train, cv=cv, scoring="roc_auc"
    )
    mean_auc = cv_scores.mean()

    print(f"  CV AUC scores: {cv_scores}")
    print(f"  Mean CV AUC:   {mean_auc:.4f} (+/- {cv_scores.std():.4f})")

    return ensemble, mean_auc


def evaluate_model(model, X_test, y_test, model_name="Model"):
    """
    Comprehensive evaluation on held-out test set.
    Returns a dictionary of all metrics.
    """
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]

    auc = roc_auc_score(y_test, y_prob)
    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred, zero_division=0)
    sensitivity = recall_score(y_test, y_pred)  # Same as recall
    specificity = recall_score(y_test, y_pred, pos_label=0)
    f1 = f1_score(y_test, y_pred)
    brier = brier_score_loss(y_test, y_prob)

    metrics = {
        "model_name": model_name,
        "auc_roc": round(auc, 4),
        "accuracy": round(accuracy, 4),
        "precision": round(precision, 4),
        "sensitivity_recall": round(sensitivity, 4),
        "specificity": round(specificity, 4),
        "f1_score": round(f1, 4),
        "brier_score": round(brier, 4),
    }

    return metrics, y_pred, y_prob


def tune_threshold_on_validation(model, X_val, y_val):
    """
    Find the decision threshold that maximises F1 on the validation set.
    This ensures the threshold is chosen WITHOUT touching the test set.
    """
    import numpy as np
    from sklearn.metrics import f1_score, recall_score

    y_prob = model.predict_proba(X_val)[:, 1]
    thresholds = np.arange(0.20, 0.70, 0.01)

    best_thresh = 0.50
    best_f1 = 0.0
    results = []

    for t in thresholds:
        y_pred = (y_prob >= t).astype(int)
        sens = recall_score(y_val, y_pred, zero_division=0)
        spec = recall_score(y_val, y_pred, pos_label=0, zero_division=0)
        f1   = f1_score(y_val, y_pred, zero_division=0)
        results.append((t, sens, spec, f1))

        # Prioritise sensitivity >= 0.80 AND best F1
        if sens >= 0.80 and f1 > best_f1:
            best_f1 = f1
            best_thresh = t

    print(f"[INFO] Best threshold from validation: {best_thresh:.2f} "
          f"(F1={best_f1:.4f})")
    return best_thresh


def plot_roc_curves(models_results, y_test):
    """Plot ROC curves for all models."""
    os.makedirs(PLOTS_DIR, exist_ok=True)

    plt.figure(figsize=(10, 8))
    colors = ["#2196F3", "#4CAF50", "#FF5722", "#9C27B0"]

    for i, (name, _, y_prob) in enumerate(models_results):
        fpr, tpr, _ = roc_curve(y_test, y_prob)
        auc = roc_auc_score(y_test, y_prob)
        plt.plot(fpr, tpr, color=colors[i], lw=2,
                 label=f"{name} (AUC = {auc:.4f})")

    plt.plot([0, 1], [0, 1], "k--", lw=1, label="Random (AUC = 0.5)")
    plt.xlabel("False Positive Rate", fontsize=12)
    plt.ylabel("True Positive Rate", fontsize=12)
    plt.title("ROC Curves - PCOS Risk Prediction Models", fontsize=14)
    plt.legend(loc="lower right", fontsize=10)
    plt.grid(alpha=0.3)
    plt.tight_layout()
    plt.savefig(os.path.join(PLOTS_DIR, "roc_curves.png"), dpi=150)
    plt.close()
    print(f"\n[INFO] ROC curves saved to {PLOTS_DIR}/roc_curves.png")


def plot_confusion_matrix(y_test, y_pred, model_name):
    """Plot confusion matrix for the best model."""
    os.makedirs(PLOTS_DIR, exist_ok=True)

    cm = confusion_matrix(y_test, y_pred)
    plt.figure(figsize=(8, 6))
    sns.heatmap(
        cm, annot=True, fmt="d", cmap="Blues",
        xticklabels=["No PCOS", "PCOS"],
        yticklabels=["No PCOS", "PCOS"]
    )
    plt.xlabel("Predicted", fontsize=12)
    plt.ylabel("Actual", fontsize=12)
    plt.title(f"Confusion Matrix - {model_name}", fontsize=14)
    plt.tight_layout()
    plt.savefig(os.path.join(PLOTS_DIR, "confusion_matrix.png"), dpi=150)
    plt.close()
    print(f"[INFO] Confusion matrix saved to {PLOTS_DIR}/confusion_matrix.png")


def plot_calibration_curve(y_test, y_prob, model_name):
    """Plot calibration curve for the best model."""
    os.makedirs(PLOTS_DIR, exist_ok=True)

    prob_true, prob_pred = calibration_curve(y_test, y_prob, n_bins=10)

    plt.figure(figsize=(8, 6))
    plt.plot(prob_pred, prob_true, "s-", color="#2196F3",
             label=model_name, lw=2)
    plt.plot([0, 1], [0, 1], "k--", label="Perfectly Calibrated")
    plt.xlabel("Mean Predicted Probability", fontsize=12)
    plt.ylabel("Fraction of Positives", fontsize=12)
    plt.title(f"Calibration Curve - {model_name}", fontsize=14)
    plt.legend(fontsize=10)
    plt.grid(alpha=0.3)
    plt.tight_layout()
    plt.savefig(os.path.join(PLOTS_DIR, "calibration_curve.png"), dpi=150)
    plt.close()
    print(f"[INFO] Calibration curve saved to {PLOTS_DIR}/calibration_curve.png")


def check_calibration_and_fix(model, X_train, y_train, X_test, y_test):
    """
    Check if model is well-calibrated. If Brier score > 0.15,
    apply Platt scaling (sigmoid) or isotonic regression.
    """
    y_prob = model.predict_proba(X_test)[:, 1]
    brier = brier_score_loss(y_test, y_prob)

    if brier > 0.15:
        print(f"\n[INFO] Brier score ({brier:.4f}) indicates poor calibration.")
        print("[INFO] Applying Platt scaling (sigmoid calibration)...")

        calibrated = CalibratedClassifierCV(
            model, method="sigmoid", cv=5
        )
        calibrated.fit(X_train, y_train)

        y_prob_cal = calibrated.predict_proba(X_test)[:, 1]
        brier_cal = brier_score_loss(y_test, y_prob_cal)
        print(f"[INFO] Brier score after calibration: {brier_cal:.4f}")

        if brier_cal < brier:
            print("[INFO] Calibration improved the model. Using calibrated version.")
            return calibrated
        else:
            print("[INFO] Calibration did not improve. Keeping original model.")
            return model
    else:
        print(f"\n[INFO] Model is well-calibrated (Brier: {brier:.4f})")
        return model


def train_all_models():
    """
    Main training pipeline:
    1. Preprocess data
    2. Train all 4 models
    3. Evaluate on test set
    4. Select best model
    5. Check calibration
    6. Save best model
    """
    print("=" * 60)
    print("  PCOS Risk Prediction - Model Training Pipeline")
    print(f"  Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # Step 1: Preprocess
    X_train, X_test, y_train, y_test, scaler, features = preprocess_pipeline()

    # Step 2: Train all models
    lr_model, lr_auc = train_logistic_regression(X_train, y_train)
    rf_model, rf_auc = train_random_forest(X_train, y_train)
    xgb_model, xgb_auc = train_xgboost(X_train, y_train)
    ensemble_model, ensemble_auc = train_voting_ensemble(
        X_train, y_train, rf_model, xgb_model
    )

    # Step 3: Evaluate all models on held-out test set
    models = {
        "Logistic Regression": (lr_model, lr_auc),
        "Random Forest": (rf_model, rf_auc),
        "XGBoost": (xgb_model, xgb_auc),
        "Voting Ensemble": (ensemble_model, ensemble_auc),
    }

    print("\n" + "=" * 60)
    print("  Model Evaluation on Held-Out Test Set")
    print("=" * 60)

    all_results = []
    models_for_roc = []

    for name, (model, cv_auc) in models.items():
        metrics, y_pred, y_prob = evaluate_model(model, X_test, y_test, name)
        metrics["cv_auc"] = round(cv_auc, 4)
        all_results.append(metrics)
        models_for_roc.append((name, y_pred, y_prob))

        print(f"\n--- {name} ---")
        print(f"  CV AUC:        {cv_auc:.4f}")
        print(f"  Test AUC:      {metrics['auc_roc']}")
        print(f"  Sensitivity:   {metrics['sensitivity_recall']}")
        print(f"  Specificity:   {metrics['specificity']}")
        print(f"  Precision:     {metrics['precision']}")
        print(f"  F1 Score:      {metrics['f1_score']}")
        print(f"  Accuracy:      {metrics['accuracy']}")
        print(f"  Brier Score:   {metrics['brier_score']}")

        # Check NFR-14 thresholds
        if metrics["auc_roc"] >= 0.85:
            print("  [PASS] AUC >= 0.85 threshold MET")
        else:
            print("  [FAIL] AUC < 0.85 threshold NOT MET")

        if metrics["sensitivity_recall"] >= 0.80:
            print("  [PASS] Sensitivity >= 0.80 threshold MET")
        else:
            print("  [FAIL] Sensitivity < 0.80 threshold NOT MET")

    # Step 4: Select best model by test AUC
    best_result = max(all_results, key=lambda x: x["auc_roc"])
    best_name = best_result["model_name"]
    best_model = models[best_name][0]

    print(f"\n{'=' * 60}")
    print(f"  BEST MODEL: {best_name}")
    print(f"  Test AUC: {best_result['auc_roc']}")
    print(f"  Sensitivity: {best_result['sensitivity_recall']}")
    print("=" * 60)

    # Step 5: Plot visualizations
    plot_roc_curves(models_for_roc, y_test)

    best_metrics, best_y_pred, best_y_prob = evaluate_model(
        best_model, X_test, y_test, best_name
    )
    plot_confusion_matrix(y_test, best_y_pred, best_name)
    plot_calibration_curve(y_test, best_y_prob, best_name)

    # Step 6: Check calibration and potentially fix
    best_model = check_calibration_and_fix(
        best_model, X_train, y_train, X_test, y_test
    )

    # Step 7: Save best model
    os.makedirs(MODEL_DIR, exist_ok=True)
    joblib.dump(best_model, os.path.join(MODEL_DIR, "best_model.pkl"))

    # Save evaluation report
    report = {
        "training_date": datetime.now().isoformat(),
        "best_model": best_name,
        "all_results": all_results,
        "best_result": best_result,
        "features_used": features,
        "dataset_info": {
            "train_samples": int(X_train.shape[0]),
            "test_samples": int(X_test.shape[0]),
            "n_features": int(X_train.shape[1]),
        },
        "nfr14_compliance": {
            "auc_threshold": 0.85,
            "auc_achieved": best_result["auc_roc"],
            "auc_met": best_result["auc_roc"] >= 0.85,
            "sensitivity_threshold": 0.80,
            "sensitivity_achieved": best_result["sensitivity_recall"],
            "sensitivity_met": best_result["sensitivity_recall"] >= 0.80,
        }
    }

    with open(os.path.join(MODEL_DIR, "evaluation_report.json"), "w") as f:
        json.dump(report, f, indent=2)

    print(f"\n[SUCCESS] Best model saved to {MODEL_DIR}/best_model.pkl")
    print(f"[SUCCESS] Evaluation report saved to {MODEL_DIR}/evaluation_report.json")
    print(f"[SUCCESS] Plots saved to {PLOTS_DIR}/")

    # Print classification report
    print(f"\n{'=' * 60}")
    print(f"  Classification Report - {best_name}")
    print(f"{'=' * 60}")
    print(classification_report(
        y_test, best_y_pred,
        target_names=["No PCOS", "PCOS"]
    ))

    return best_model, best_result


if __name__ == "__main__":
    best_model, best_result = train_all_models()
