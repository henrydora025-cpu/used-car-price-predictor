"""Matplotlib figures for data exploration and model evaluation (saved to reports/figures/)."""
from __future__ import annotations

from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
from sklearn.inspection import permutation_importance  # noqa: E402

from .config import FEATURES, MODEL_LABELS, RANDOM_STATE  # noqa: E402

INDIGO, EMERALD, AMBER, SLATE = "#6366f1", "#10b981", "#f59e0b", "#94a3b8"


def _save(fig: plt.Figure, path: Path) -> None:
    fig.tight_layout()
    fig.savefig(path, dpi=130)
    plt.close(fig)


def save_figures(df: pd.DataFrame, X_test: pd.DataFrame, y_test: pd.Series, fitted: dict, best_name: str, results: dict, out_dir: Path) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    plt.style.use("seaborn-v0_8-whitegrid")
    paths: list[Path] = []

    fig, axes = plt.subplots(1, 2, figsize=(11, 4))
    axes[0].hist(df["price"], bins=60, color=INDIGO)
    axes[0].set(title="Price distribution", xlabel="Price (USD)", ylabel="Listings")
    axes[1].hist(np.log(df["price"]), bins=60, color=EMERALD)
    axes[1].set(title="log(price) — the modelling target", xlabel="log(price)")
    paths.append(out_dir / "price_distribution.png")
    _save(fig, paths[-1])

    by_age = df.groupby("age")["price"].agg(["median", "mean", "size"])
    by_age = by_age[by_age["size"] >= 5]
    fig, ax = plt.subplots(figsize=(8, 4.5))
    ax.plot(by_age.index, by_age["median"], color=INDIGO, lw=2.5, label="Median")
    ax.plot(by_age.index, by_age["mean"], color=AMBER, lw=2, ls="--", label="Mean")
    ax.set(title="Depreciation curve", xlabel="Vehicle age (years)", ylabel="Price (USD)")
    ax.legend()
    paths.append(out_dir / "depreciation_curve.png")
    _save(fig, paths[-1])

    names = list(results)
    x = np.arange(len(names))
    fig, ax = plt.subplots(figsize=(8, 4.5))
    ax.bar(x - 0.2, [results[n]["cv_rmse_mean"] for n in names], 0.4, yerr=[results[n]["cv_rmse_std"] for n in names], color="#c7d2fe", label="CV RMSE", capsize=4)
    ax.bar(x + 0.2, [results[n]["test"]["mae"] for n in names], 0.4, color=INDIGO, label="Test MAE")
    ax.set_xticks(x, [MODEL_LABELS[n] for n in names])
    ax.set(title="Model comparison (lower is better)", ylabel="USD")
    ax.legend()
    paths.append(out_dir / "model_comparison.png")
    _save(fig, paths[-1])

    best = fitted[best_name]
    pred = best.predict(X_test)
    fig, ax = plt.subplots(figsize=(6, 6))
    ax.scatter(y_test, pred, s=8, alpha=0.35, color=INDIGO)
    lo, hi = 1500, float(max(y_test.max(), pred.max()))
    ax.plot([lo, hi], [lo, hi], color="#f43f5e", ls="--", lw=1.5)
    ax.set(xscale="log", yscale="log", xlim=(lo, hi), ylim=(lo, hi), title=f"Predicted vs actual — {MODEL_LABELS[best_name]}", xlabel="Actual price", ylabel="Predicted price")
    paths.append(out_dir / "predicted_vs_actual.png")
    _save(fig, paths[-1])

    pct_error = np.clip((pred - y_test) / y_test * 100, -60, 60)
    fig, ax = plt.subplots(figsize=(8, 4))
    ax.hist(pct_error, bins=48, color=INDIGO)
    ax.axvline(0, color="#f43f5e", ls="--")
    ax.set(title="Prediction error distribution (test set)", xlabel="Error (%)", ylabel="Vehicles")
    paths.append(out_dir / "error_distribution.png")
    _save(fig, paths[-1])

    sample = X_test.sample(n=min(1500, len(X_test)), random_state=RANDOM_STATE)
    importance = permutation_importance(best, sample, y_test.loc[sample.index], n_repeats=3, random_state=RANDOM_STATE, scoring="neg_root_mean_squared_error")
    order = np.argsort(importance.importances_mean)
    fig, ax = plt.subplots(figsize=(8, 5))
    ax.barh(np.array(FEATURES)[order], importance.importances_mean[order], color=SLATE)
    ax.set(title=f"Permutation importance — {MODEL_LABELS[best_name]}", xlabel="RMSE increase (USD)")
    paths.append(out_dir / "feature_importance.png")
    _save(fig, paths[-1])
    return paths
