# Python reference implementation

The same workflow as the production TypeScript app, built with the classic data-science stack:
**pandas · NumPy · scikit-learn · Matplotlib · FastAPI · Streamlit · pytest · Docker**.

| File | Purpose |
|---|---|
| `car_price/data.py` | Load the raw CSV and clean it (labels, parsing, duplicates, invalid values, robust outlier removal) |
| `car_price/features.py` | Feature engineering + `ColumnTransformer` pipelines (one-hot for linear, target encoding for trees) |
| `car_price/train.py` | 5-fold CV of Linear Regression / Random Forest / HistGradientBoosting → select → evaluate → save |
| `car_price/plots.py` | Matplotlib figures → `reports/figures/` |
| `car_price/predict.py` | `CarPricePredictor` used by the API and the UI |
| `api/main.py` | FastAPI service (`/predict`, `/predict/batch`, `/model-info`, `/health`, Swagger UI at `/docs`) |
| `app/streamlit_app.py` | Streamlit interface (calls the API when `API_URL` is set) |
| `tests/` | pytest suite (cleaning, models, API) |

```bash
pip install -r requirements.txt
python -m car_price.train            # ~15 s: metrics → models/metrics.json, figures → reports/figures/
pytest -q
uvicorn api.main:app --reload        # http://localhost:8000/docs
streamlit run app/streamlit_app.py   # http://localhost:8501

# or, from this folder:
docker compose up --build
```

Results on the shared dataset (test split, 2,350 vehicles):

| Model | CV RMSE | Test R² | Test MAE | Test MAPE |
|---|---:|---:|---:|---:|
| Linear Regression | $4,226 | 0.906 | $2,304 | 13.2 % |
| Random Forest | $4,171 | 0.913 | $2,232 | 12.6 % |
| **Gradient Boosting** | **$3,372** | **0.943** | **$1,860** | **10.0 %** |
