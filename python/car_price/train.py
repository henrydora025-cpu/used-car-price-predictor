"""Train, compare and persist the three regression models.

    python -m car_price.train              # full run → models/ + reports/figures/
    python -m car_price.train --fast       # quick run (fewer trees, 3 folds)
"""
from __future__ import annotations

import argparse
import json
import time
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import TransformedTargetRegressor
from sklearn.ensemble import HistGradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_absolute_percentage_error, r2_score, root_mean_squared_error
from sklearn.model_selection import KFold, cross_validate, train_test_split
from sklearn.pipeline import Pipeline

from .config import FEATURES, FIGURES_DIR, MODEL_LABELS, MODEL_PATH, RANDOM_STATE, RAW_DATA_PATH, REFERENCE_YEAR, TARGET, TEST_SIZE
from .data import CleaningReport, clean, load_raw
from .features import add_features, make_linear_preprocessor, make_tree_preprocessor


def _log_target(pipeline: Pipeline) -> TransformedTargetRegressor:
    # Prices are right-skewed and depreciation is multiplicative → learn log(price).
    return TransformedTargetRegressor(regressor=pipeline, func=np.log, inverse_func=np.exp)


def build_models(fast: bool = False) -> dict[str, TransformedTargetRegressor]:
    return {
        "linear_regression": _log_target(Pipeline([("prep", make_linear_preprocessor()), ("model", LinearRegression())])),
        "random_forest": _log_target(
            Pipeline(
                [
                    ("prep", make_tree_preprocessor()),
                    ("model", RandomForestRegressor(n_estimators=40 if fast else 200, min_samples_leaf=2, max_features=0.6, n_jobs=-1, random_state=RANDOM_STATE)),
                ]
            )
        ),
        "gradient_boosting": _log_target(
            Pipeline(
                [
                    ("prep", make_tree_preprocessor()),
                    (
                        "model",
                        HistGradientBoostingRegressor(
                            max_iter=150 if fast else 600,
                            learning_rate=0.1 if fast else 0.05,
                            max_leaf_nodes=31,
                            min_samples_leaf=10,
                            l2_regularization=1.0,
                            random_state=RANDOM_STATE,
                        ),
                    ),
                ]
            )
        ),
    }


def regression_metrics(y_true, y_pred) -> dict[str, float]:
    return {
        "r2": float(r2_score(y_true, y_pred)),
        "mae": float(mean_absolute_error(y_true, y_pred)),
        "rmse": float(root_mean_squared_error(y_true, y_pred)),
        "mape": float(mean_absolute_percentage_error(y_true, y_pred)),
    }


def prepare_dataset(data_path: str | Path = RAW_DATA_PATH, sample: int | None = None) -> tuple[pd.DataFrame, CleaningReport]:
    df, report = clean(load_raw(data_path))
    if sample and len(df) > sample:
        df = df.sample(n=sample, random_state=RANDOM_STATE).reset_index(drop=True)
    return add_features(df), report


def train(
    data_path: str | Path = RAW_DATA_PATH,
    model_path: str | Path = MODEL_PATH,
    fast: bool = False,
    sample: int | None = None,
    make_plots: bool = True,
    verbose: bool = True,
) -> dict:
    started = time.perf_counter()
    df, report = prepare_dataset(data_path, sample)
    X, y = df[FEATURES], df[TARGET]
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=TEST_SIZE, random_state=RANDOM_STATE)
    cv = KFold(n_splits=3 if fast else 5, shuffle=True, random_state=RANDOM_STATE)
    if verbose:
        print(f"Clean rows: {len(df):,} (raw {report.raw_rows:,}) → train {len(X_train):,} / test {len(X_test):,}")

    results: dict[str, dict] = {}
    fitted: dict[str, TransformedTargetRegressor] = {}
    for name, model in build_models(fast).items():
        t0 = time.perf_counter()
        scores = cross_validate(model, X_train, y_train, cv=cv, scoring={"rmse": "neg_root_mean_squared_error", "mae": "neg_mean_absolute_error", "r2": "r2"})
        model.fit(X_train, y_train)
        results[name] = {
            "label": MODEL_LABELS[name],
            "cv_rmse_mean": float(-scores["test_rmse"].mean()),
            "cv_rmse_std": float(scores["test_rmse"].std()),
            "cv_mae_mean": float(-scores["test_mae"].mean()),
            "cv_r2_mean": float(scores["test_r2"].mean()),
            "test": regression_metrics(y_test, model.predict(X_test)),
            "seconds": round(time.perf_counter() - t0, 2),
        }
        fitted[name] = model
        if verbose:
            t = results[name]["test"]
            print(f"{MODEL_LABELS[name]:<18} CV RMSE ${results[name]['cv_rmse_mean']:>7,.0f} | test R² {t['r2']:.4f} | MAE ${t['mae']:,.0f} | MAPE {t['mape']:.1%}")

    best_name = min(results, key=lambda n: results[n]["cv_rmse_mean"])
    best = fitted[best_name]
    log_residuals = np.log(y_test) - np.log(best.predict(X_test))
    q10, q90 = np.quantile(log_residuals, [0.1, 0.9])
    version = datetime.now(timezone.utc).strftime("%Y.%m.%d-py")
    catalog = {make: sorted(group["model"].unique().tolist()) for make, group in df.groupby("manufacturer")}

    model_path = Path(model_path)
    model_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(
        {
            "model": best,
            "model_name": best_name,
            "features": FEATURES,
            "reference_year": REFERENCE_YEAR,
            "interval": {"q10": float(q10), "q90": float(q90)},
            "catalog": catalog,
            "metrics": results,
            "version": version,
            "trained_at": datetime.now(timezone.utc).isoformat(),
        },
        model_path,
        compress=3,
    )
    summary = {
        "best_model": best_name,
        "version": version,
        "selection": "lowest mean cross-validated RMSE on the training split",
        "dataset": {"raw_rows": report.raw_rows, "clean_rows": report.clean_rows, "train_rows": len(X_train), "test_rows": len(X_test)},
        "cleaning": report.steps,
        "models": results,
        "seconds": round(time.perf_counter() - started, 1),
    }
    model_path.with_name("metrics.json").write_text(json.dumps(summary, indent=2) + "\n")

    if make_plots:
        from .plots import save_figures

        save_figures(df, X_test, y_test, fitted, best_name, results, FIGURES_DIR)
    if verbose:
        print(f"Selected: {MODEL_LABELS[best_name]} → saved {model_path} ({summary['seconds']}s)")
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description="Train and compare used-car price models")
    parser.add_argument("--data", default=str(RAW_DATA_PATH))
    parser.add_argument("--out", default=str(MODEL_PATH))
    parser.add_argument("--fast", action="store_true", help="fewer trees and 3-fold CV")
    parser.add_argument("--sample", type=int, default=None, help="train on a random subset")
    parser.add_argument("--no-plots", action="store_true")
    args = parser.parse_args()
    train(args.data, args.out, fast=args.fast, sample=args.sample, make_plots=not args.no_plots)


if __name__ == "__main__":
    main()
