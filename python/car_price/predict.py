"""Inference helper shared by the FastAPI service and the Streamlit app."""
from __future__ import annotations

from pathlib import Path

import joblib
import pandas as pd

from .config import MODEL_PATH
from .data import BODY_MAP, BOOLEAN_MAP, CONDITION_MAP, DRIVETRAIN_MAP, FUEL_MAP, MANUFACTURER_ALIASES, TRANSMISSION_MAP
from .features import add_features

INPUT_COLUMNS = [
    "manufacturer", "model", "year", "mileage", "fuel_type", "transmission",
    "body_type", "drivetrain", "engine_size", "condition", "owners", "accident_history",
]
NUMERIC_INPUTS = ["year", "mileage", "engine_size", "owners", "accident_history"]
LABEL_MAPS = {
    "fuel_type": FUEL_MAP,
    "transmission": TRANSMISSION_MAP,
    "body_type": BODY_MAP,
    "drivetrain": DRIVETRAIN_MAP,
    "condition": CONDITION_MAP,
}


def _round(value: float) -> float:
    return float(round(value / 50) * 50)


class CarPricePredictor:
    def __init__(self, model_path: str | Path = MODEL_PATH):
        bundle = joblib.load(model_path)
        self.model = bundle["model"]
        self.model_name: str = bundle["model_name"]
        self.features: list[str] = bundle["features"]
        self.reference_year: int = bundle["reference_year"]
        self.interval: dict = bundle["interval"]
        self.catalog: dict[str, list[str]] = bundle["catalog"]
        self.metrics: dict = bundle["metrics"]
        self.version: str = bundle["version"]
        self.trained_at: str = bundle["trained_at"]
        self._makes = {make.lower(): make for make in self.catalog}
        self._models = {(make, model.lower()): model for make, models in self.catalog.items() for model in models}

    def _normalize(self, vehicle: dict) -> dict:
        row = {column: vehicle.get(column) for column in INPUT_COLUMNS}
        make = str(row["manufacturer"] or "").strip()
        make = MANUFACTURER_ALIASES.get(make.lower(), self._makes.get(make.lower(), make))
        model = str(row["model"] or "").strip()
        row["manufacturer"] = make
        row["model"] = self._models.get((make, model.lower()), model)
        for column, mapping in LABEL_MAPS.items():
            value = row[column]
            row[column] = mapping.get(str(value).strip().lower()) if value not in (None, "") else None
        accident = row["accident_history"]
        if isinstance(accident, bool):
            row["accident_history"] = float(accident)
        elif accident not in (None, ""):
            row["accident_history"] = BOOLEAN_MAP.get(str(accident).strip().lower())
        return row

    def predict(self, vehicles: list[dict]) -> list[dict]:
        frame = pd.DataFrame([self._normalize(v) for v in vehicles], columns=INPUT_COLUMNS)
        frame[NUMERIC_INPUTS] = frame[NUMERIC_INPUTS].apply(pd.to_numeric, errors="coerce")
        prices = self.model.predict(add_features(frame, self.reference_year)[self.features])
        q10, q90 = self.interval["q10"], self.interval["q90"]
        return [
            {
                "estimated_price": _round(p),
                "price_range": {"low": _round(p * pow(2.718281828459045, q10)), "high": _round(p * pow(2.718281828459045, q90)), "confidence": 0.8},
                "currency": "USD",
                "model_used": self.model_name,
                "model_version": self.version,
            }
            for p in prices
        ]
