"""
PCOS Data Preprocessing Module
==============================
Handles data loading, cleaning, feature selection, imputation,
outlier treatment, normalisation, encoding, train/test split, and SMOTE.

Based on the methodology specified in Chapter 3 (Section 3.12).
"""

import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from imblearn.over_sampling import SMOTE
import joblib
import os
import warnings

warnings.filterwarnings("ignore")

# ─── Configuration ──────────────────────────────────────────────────────────
DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "PCOS_extended_dataset.csv")
MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
TEST_SIZE = 0.20
RANDOM_STATE = 42

# Non-invasive, self-reportable features identified in Chapter 2 & 3
# These are features a user can self-report without clinical blood tests
NON_INVASIVE_FEATURES = [
    "Age (yrs)",
    "BMI",
    "Cycle(R/I)",           # Cycle regularity: 2=Regular, 4=Irregular
    "Cycle length(days)",
    "Weight gain(Y/N)",
    "hair growth(Y/N)",
    "Skin darkening (Y/N)",
    "Hair loss(Y/N)",
    "Pimples(Y/N)",
    "Fast food (Y/N)",
    "Reg.Exercise(Y/N)",
    "Waist:Hip Ratio",
    "Pregnant(Y/N)",
    "No. of abortions",
    "Weight (Kg)",
    "Marraige Status (Yrs)",
]

TARGET_COLUMN = "PCOS (Y/N)"

# Mapping for user-friendly feature names (used in SHAP explanations)
FEATURE_NAME_MAP = {
    "Age (yrs)": "Age",
    "BMI": "BMI",
    "Cycle(R/I)": "Cycle Regularity",
    "Cycle length(days)": "Cycle Length (days)",
    "Weight gain(Y/N)": "Weight Gain",
    "hair growth(Y/N)": "Excess Hair Growth",
    "Skin darkening (Y/N)": "Skin Darkening",
    "Hair loss(Y/N)": "Hair Loss",
    "Pimples(Y/N)": "Acne / Pimples",
    "Fast food (Y/N)": "Fast Food Consumption",
    "Reg.Exercise(Y/N)": "Regular Exercise",
    "Waist:Hip Ratio": "Waist-to-Hip Ratio",
    "Pregnant(Y/N)": "Pregnancy Status",
    "No. of abortions": "Number of Miscarriages",
    "Weight (Kg)": "Weight (kg)",
    "Marraige Status (Yrs)": "Years Married",
}


def load_data(path=DATA_PATH):
    """Load the PCOS dataset from CSV."""
    df = pd.read_csv(path)
    # Strip whitespace from column names
    df.columns = df.columns.str.strip()
    print(f"[INFO] Dataset loaded: {df.shape[0]} records, {df.shape[1]} columns")
    return df


def clean_data(df):
    """
    Clean the dataset:
    - Convert columns to numeric where possible
    - Handle non-numeric entries (replace with NaN)
    - Drop duplicate rows
    """
    df = df.copy()

    # The target column may have leading spaces
    if "PCOS (Y/N)" not in df.columns:
        # Try to find it with different spacing
        for col in df.columns:
            if "PCOS" in col and "Y/N" in col:
                df = df.rename(columns={col: "PCOS (Y/N)"})
                break

    # Convert all feature columns to numeric
    for col in df.columns:
        if col not in ["Sl. No", "Patient File No."]:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # Drop identifier columns
    drop_cols = [c for c in ["Sl. No", "Patient File No."] if c in df.columns]
    df = df.drop(columns=drop_cols, errors="ignore")

    # Drop duplicate rows
    n_before = len(df)
    df = df.drop_duplicates()
    n_after = len(df)
    if n_before != n_after:
        print(f"[INFO] Dropped {n_before - n_after} duplicate rows")

    print(f"[INFO] Data cleaned: {df.shape[0]} records, {df.shape[1]} columns")
    return df


def select_features(df):
    """Select only non-invasive, self-reportable features + target."""
    available = [f for f in NON_INVASIVE_FEATURES if f in df.columns]
    missing = [f for f in NON_INVASIVE_FEATURES if f not in df.columns]

    if missing:
        print(f"[WARNING] Missing features (skipped): {missing}")

    if TARGET_COLUMN not in df.columns:
        raise ValueError(f"Target column '{TARGET_COLUMN}' not found in dataset!")

    selected_df = df[available + [TARGET_COLUMN]].copy()
    print(f"[INFO] Selected {len(available)} non-invasive features")
    return selected_df, available


def impute_missing(df, features):
    """
    Impute missing values:
    - Median imputation for continuous features
    - Mode imputation for binary/categorical features
    """
    df = df.copy()
    binary_features = [
        "Cycle(R/I)", "Weight gain(Y/N)", "hair growth(Y/N)",
        "Skin darkening (Y/N)", "Hair loss(Y/N)", "Pimples(Y/N)",
        "Fast food (Y/N)", "Reg.Exercise(Y/N)", "Pregnant(Y/N)"
    ]

    for col in features:
        if df[col].isnull().sum() > 0:
            if col in binary_features:
                mode_val = df[col].mode()[0] if not df[col].mode().empty else 0
                df[col] = df[col].fillna(mode_val)
                print(f"[INFO] Imputed {col} with mode: {mode_val}")
            else:
                median_val = df[col].median()
                df[col] = df[col].fillna(median_val)
                print(f"[INFO] Imputed {col} with median: {median_val}")

    # Also impute target if needed
    if df[TARGET_COLUMN].isnull().sum() > 0:
        df = df.dropna(subset=[TARGET_COLUMN])
        print("[INFO] Dropped rows with missing target")

    return df


def clip_outliers(df, features):
    """
    Clip outliers using the interquartile range (IQR) method.
    Values below Q1 - 1.5*IQR or above Q3 + 1.5*IQR are clipped.
    Only applied to continuous features.
    """
    df = df.copy()
    continuous_features = [
        "Age (yrs)", "BMI", "Cycle length(days)",
        "Waist:Hip Ratio", "Weight (Kg)", "Marraige Status (Yrs)",
        "No. of abortions"
    ]

    for col in continuous_features:
        if col in features and col in df.columns:
            Q1 = df[col].quantile(0.25)
            Q3 = df[col].quantile(0.75)
            IQR = Q3 - Q1
            lower = Q1 - 1.5 * IQR
            upper = Q3 + 1.5 * IQR
            n_clipped = ((df[col] < lower) | (df[col] > upper)).sum()
            if n_clipped > 0:
                df[col] = df[col].clip(lower=lower, upper=upper)
                print(f"[INFO] Clipped {n_clipped} outliers in {col} "
                      f"[{lower:.2f}, {upper:.2f}]")

    return df

def split_and_scale(df, features, use_validation=True):
    """
    Split into train / (optional val) / test with stratification.
    SMOTE applied only to the training set to avoid data leakage.

    With 2000+ rows:  use_validation=True  → 80/10/10
    With <700 rows:   use_validation=False → 80/20 (current behaviour)
    """
    X = df[features].values
    y = df[TARGET_COLUMN].values.astype(int)

    if use_validation:
        # Step 1: carve out 20% as a temporary held-out block
        X_train, X_temp, y_train, y_temp = train_test_split(
            X, y,
            test_size=0.20,
            random_state=RANDOM_STATE,
            stratify=y
        )
        # Step 2: split that 20% evenly into val (10%) and test (10%)
        X_val, X_test, y_val, y_test = train_test_split(
            X_temp, y_temp,
            test_size=0.50,          # 50% of 20% = 10% of total
            random_state=RANDOM_STATE,
            stratify=y_temp
        )
        print(f"[INFO] Train: {X_train.shape[0]}  Val: {X_val.shape[0]}  Test: {X_test.shape[0]}")
        print(f"[INFO] Train PCOS+: {sum(y_train)}  Val PCOS+: {sum(y_val)}  Test PCOS+: {sum(y_test)}")
    else:
        # Original 80/20 behaviour — kept for small datasets
        X_train, X_test, y_train, y_test = train_test_split(
            X, y,
            test_size=0.20,
            random_state=RANDOM_STATE,
            stratify=y
        )
        X_val, y_val = None, None
        print(f"[INFO] Train: {X_train.shape[0]}  Test: {X_test.shape[0]}")

    # StandardScaler — fit on train only, transform all splits
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled  = scaler.transform(X_test)
    X_val_scaled   = scaler.transform(X_val) if X_val is not None else None

    # SMOTE — applied only to training set to prevent data leakage
    print("[INFO] Applying SMOTE to training set only...")
    smote = SMOTE(random_state=RANDOM_STATE)
    X_train_resampled, y_train_resampled = smote.fit_resample(
        X_train_scaled, y_train
    )
    print(f"[INFO] After SMOTE — Train: {X_train_resampled.shape[0]} "
          f"(PCOS+: {sum(y_train_resampled)}, PCOS-: {sum(y_train_resampled==0)})")

    return (X_train_resampled, X_val_scaled, X_test_scaled,
            y_train_resampled, y_val,        y_test,
            scaler)


def preprocess_pipeline():
    os.makedirs(MODEL_DIR, exist_ok=True)

    df = load_data()
    df = clean_data(df)
    df, features = select_features(df)
    df = impute_missing(df, features)
    df = clip_outliers(df, features)

    # Use validation split only when dataset is large enough
    use_val = len(df) >= 700
    X_train, X_val, X_test, y_train, y_val, y_test, scaler = split_and_scale(
        df, features, use_validation=use_val
    )

    joblib.dump(scaler, os.path.join(MODEL_DIR, "scaler.pkl"))
    joblib.dump(features, os.path.join(MODEL_DIR, "feature_names.pkl"))
    joblib.dump(FEATURE_NAME_MAP, os.path.join(MODEL_DIR, "feature_name_map.pkl"))

    # Save test set for evaluate_model.py
    joblib.dump(
        {"X_test": X_test, "y_test": y_test},
        os.path.join(MODEL_DIR, "test_data.pkl")
    )

    # Save validation set separately for threshold tuning in train_model.py
    if X_val is not None:
        joblib.dump(
            {"X_val": X_val, "y_val": y_val},
            os.path.join(MODEL_DIR, "val_data.pkl")
        )
        print("[INFO] Validation set saved to val_data.pkl")

    return X_train, X_test, y_train, y_test, scaler, features


if __name__ == "__main__":
    X_train, X_test, y_train, y_test, scaler, features = preprocess_pipeline()
    print("\nFinal shapes:")
    print(f"  X_train: {X_train.shape}")
    print(f"  X_test:  {X_test.shape}")
    print(f"  y_train: {y_train.shape}")
    print(f"  y_test:  {y_test.shape}")
