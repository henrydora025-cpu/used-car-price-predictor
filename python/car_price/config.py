"""Paths and constants shared by the Python reference implementation."""
from __future__ import annotations

import os
from pathlib import Path

PYTHON_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = PYTHON_DIR.parent

RAW_DATA_PATH = Path(os.environ.get("CAR_PRICE_DATA", REPO_ROOT / "data" / "raw" / "used_cars.csv"))
MODEL_PATH = Path(os.environ.get("CAR_PRICE_MODEL", PYTHON_DIR / "models" / "car_price_model.joblib"))
FIGURES_DIR = Path(os.environ.get("CAR_PRICE_FIGURES", PYTHON_DIR / "reports" / "figures"))

REFERENCE_YEAR = 2026  # market snapshot: age = REFERENCE_YEAR - model year
RANDOM_STATE = 42
TEST_SIZE = 0.2

NUMERIC_FEATURES = ["age", "mileage", "miles_per_year", "engine_size", "owners", "accident_history", "condition_score"]
CATEGORICAL_FEATURES = ["manufacturer", "model", "fuel_type", "transmission", "body_type", "drivetrain"]
FEATURES = NUMERIC_FEATURES + CATEGORICAL_FEATURES
TARGET = "price"

MODEL_LABELS = {
    "linear_regression": "Linear Regression",
    "random_forest": "Random Forest",
    "gradient_boosting": "Gradient Boosting",
}
