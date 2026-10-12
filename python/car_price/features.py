"""Feature engineering and scikit-learn preprocessing pipelines.

Imputation, scaling and encodings live inside the model pipelines, so they are re-fitted
on the training folds only during cross-validation (no leakage).
"""
from __future__ import annotations

import pandas as pd
from sklearn import __version__ as sklearn_version
from sklearn.compose import ColumnTransformer
from sklearn.model_selection import KFold
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler, TargetEncoder

from .config import CATEGORICAL_FEATURES, NUMERIC_FEATURES, RANDOM_STATE, REFERENCE_YEAR
from .data import CONDITION_SCORE


def add_features(df: pd.DataFrame, reference_year: int = REFERENCE_YEAR) -> pd.DataFrame:
    out = df.copy()
    out["age"] = (reference_year - out["year"]).clip(lower=0)
    out["miles_per_year"] = out["mileage"] / out["age"].clip(lower=1)
    out["condition_score"] = out["condition"].map(CONDITION_SCORE).astype(float)
    for column in CATEGORICAL_FEATURES:
        out[column] = out[column].astype(object)
    return out


def make_linear_preprocessor() -> ColumnTransformer:
    """Median imputation + standardisation for numerics, mode imputation + one-hot for categoricals."""
    numeric = Pipeline([("impute", SimpleImputer(strategy="median")), ("scale", StandardScaler())])
    categorical = Pipeline(
        [("impute", SimpleImputer(strategy="most_frequent")), ("onehot", OneHotEncoder(handle_unknown="ignore"))]
    )
    return ColumnTransformer([("num", numeric, NUMERIC_FEATURES), ("cat", categorical, CATEGORICAL_FEATURES)])


def _target_encoder() -> TargetEncoder:
    # scikit-learn ≥ 1.9 configures shuffling through a CV splitter (random_state is deprecated).
    major, minor = (int(part) for part in sklearn_version.split(".")[:2])
    if (major, minor) >= (1, 9):
        return TargetEncoder(target_type="continuous", cv=KFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE))
    return TargetEncoder(target_type="continuous", random_state=RANDOM_STATE)


def make_tree_preprocessor() -> ColumnTransformer:
    """Trees don't need scaling; high-cardinality categoricals use cross-fitted target encoding."""
    categorical = Pipeline(
        [
            ("impute", SimpleImputer(strategy="most_frequent")),
            ("encode", _target_encoder()),
        ]
    )
    return ColumnTransformer(
        [("num", SimpleImputer(strategy="median"), NUMERIC_FEATURES), ("cat", categorical, CATEGORICAL_FEATURES)]
    )
