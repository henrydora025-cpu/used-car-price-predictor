# Training report — model 2026.10.12-605e62e

Trained 2026-10-12T10:14:52.964Z in 10.5s on `data/raw/used_cars.csv`.

## Dataset

| Raw rows | Clean rows | Train | Test | Manufacturers | Models | Years | Median price |
|---:|---:|---:|---:|---:|---:|---|---:|
| 12,360 | 11,746 | 9,397 | 2,349 | 20 | 123 | 2004–2026 | $17,250 |

## Data cleaning

| Step | Rows before | Rows after | Removed | Values fixed |
|---|---:|---:|---:|---:|
| Standardize labels & parse values | 12360 | 12360 | 0 | 12760 |
| Drop rows missing price or make/model | 12360 | 12306 | 54 | 0 |
| Remove duplicate listings | 12306 | 11946 | 360 | 0 |
| Drop invalid model years | 11946 | 11911 | 35 | 0 |
| Nullify impossible values | 11911 | 11911 | 0 | 26 |
| Remove implausible prices | 11911 | 11848 | 63 | 0 |
| Remove statistical price outliers | 11848 | 11746 | 102 | 0 |

## Model comparison

| Model | CV RMSE (mean ± std) | CV R² | Test R² | Test MAE | Test RMSE | Test MAPE | 80% range coverage | Fit time |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Linear Regression | $4,485 ± $303 | 0.886 | 0.875 | $2,736 | $4,691 | 14.7% | 79.8% | 0.02s |
| Random Forest | $3,716 ± $297 | 0.922 | 0.918 | $2,273 | $3,786 | 11.9% | 79.5% | 0.23s |
| **Gradient Boosting** ✅ | $2,754 ± $148 | 0.957 | 0.956 | $1,742 | $2,781 | 9.0% | 79.7% | 1.11s |

Selected: **Gradient Boosting** — Lowest mean RMSE (USD) across 5-fold cross-validation on the training split; the test split is only used for the final report.

## Permutation importance (Gradient Boosting)

| Feature | RMSE increase when shuffled | Share |
|---|---:|---:|
| Make & model | $7,566 | 34.2% |
| Year (age) | $6,243 | 28.2% |
| Mileage | $4,060 | 18.4% |
| Condition | $1,648 | 7.5% |
| Engine size | $825 | 3.7% |
| Body type | $707 | 3.2% |
| Drivetrain | $499 | 2.3% |
| Previous owners | $257 | 1.2% |
| Accident history | $195 | 0.9% |
| Fuel type | $82 | 0.4% |
| Transmission | $29 | 0.1% |
