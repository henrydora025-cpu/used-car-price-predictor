"""Streamlit front-end for the price predictor.

    streamlit run app/streamlit_app.py
Set API_URL (e.g. http://localhost:8000) to call the FastAPI service instead of loading the model locally.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pandas as pd
import streamlit as st

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from car_price.config import FIGURES_DIR, MODEL_LABELS, REFERENCE_YEAR  # noqa: E402
from car_price.predict import CarPricePredictor  # noqa: E402

API_URL = os.environ.get("API_URL")
BODY_TYPES = ["Sedan", "SUV", "Truck", "Hatchback", "Coupe", "Convertible", "Minivan", "Wagon"]

st.set_page_config(page_title="Used Car Price Predictor", page_icon="🚗", layout="wide")


@st.cache_resource
def load_predictor() -> CarPricePredictor:
    return CarPricePredictor()


predictor = load_predictor()
st.title("🚗 Used Car Price Predictor")
st.caption(f"Serving **{MODEL_LABELS[predictor.model_name]}** · model {predictor.version}")

left, right = st.columns([3, 2], gap="large")
with left:
    make = st.selectbox("Manufacturer", sorted(predictor.catalog))
    model = st.selectbox("Model", predictor.catalog[make])
    with st.form("vehicle"):
        c1, c2 = st.columns(2)
        year = c1.number_input("Model year", min_value=1990, max_value=REFERENCE_YEAR, value=2019)
        mileage = c2.number_input("Mileage (miles)", min_value=0, max_value=1_000_000, value=60_000, step=1_000)
        fuel = c1.selectbox("Fuel type", ["Gasoline", "Diesel", "Hybrid", "Electric"])
        transmission = c2.selectbox("Transmission", ["Automatic", "Manual"])
        with st.expander("Other characteristics (optional)"):
            d1, d2 = st.columns(2)
            body = d1.selectbox("Body type", ["Auto", *BODY_TYPES])
            drive = d2.selectbox("Drivetrain", ["Auto", "FWD", "RWD", "AWD", "4WD"])
            engine = d1.number_input("Engine size (L, 0 = auto)", min_value=0.0, max_value=10.0, value=0.0, step=0.1)
            condition = d2.selectbox("Condition", ["Unknown", "Excellent", "Good", "Fair", "Poor"])
            owners = d1.selectbox("Previous owners", ["Unknown", 1, 2, 3, 4, 5])
            accident = d2.selectbox("Accident history", ["Unknown", "No", "Yes"])
        submitted = st.form_submit_button("Estimate price", type="primary", use_container_width=True)

    if submitted:
        vehicle = {
            "manufacturer": make,
            "model": model,
            "year": int(year),
            "mileage": float(mileage),
            "fuel_type": fuel,
            "transmission": transmission,
            "body_type": None if body == "Auto" else body,
            "drivetrain": None if drive == "Auto" else drive,
            "engine_size": None if engine == 0 else float(engine),
            "condition": None if condition == "Unknown" else condition,
            "owners": None if owners == "Unknown" else int(owners),
            "accident_history": None if accident == "Unknown" else accident == "Yes",
        }
        if API_URL:
            import requests

            response = requests.post(f"{API_URL.rstrip('/')}/predict", json=vehicle, timeout=10)
            response.raise_for_status()
            result = response.json()
        else:
            result = predictor.predict([vehicle])[0]
        st.metric("Estimated market price", f"${result['estimated_price']:,.0f}")
        st.write(f"80% range: **${result['price_range']['low']:,.0f} – ${result['price_range']['high']:,.0f}**")

with right:
    st.subheader("Model comparison")
    table = pd.DataFrame(
        [
            {
                "Model": m["label"],
                "CV RMSE": f"${m['cv_rmse_mean']:,.0f}",
                "Test R²": round(m["test"]["r2"], 3),
                "Test MAE": f"${m['test']['mae']:,.0f}",
                "Test MAPE": f"{m['test']['mape']:.1%}",
            }
            for m in predictor.metrics.values()
        ]
    )
    st.dataframe(table, hide_index=True, use_container_width=True)
    for figure in ("predicted_vs_actual.png", "feature_importance.png", "model_comparison.png"):
        path = FIGURES_DIR / figure
        if path.exists():
            st.image(str(path), use_container_width=True)
