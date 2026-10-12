"""FastAPI prediction service.

    uvicorn api.main:app --reload        # interactive docs at http://localhost:8000/docs
"""
from __future__ import annotations

import os
from functools import lru_cache
from typing import Literal, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from car_price.config import MODEL_PATH, REFERENCE_YEAR
from car_price.predict import CarPricePredictor

app = FastAPI(
    title="Used Car Price Prediction API",
    version="1.0.0",
    description=(
        "Estimates the market price of a used car. Three models (Linear Regression, Random Forest, "
        "Gradient Boosting) are compared with cross-validation and the best one is served."
    ),
)


class Vehicle(BaseModel):
    model_config = ConfigDict(
        protected_namespaces=(),
        json_schema_extra={
            "examples": [
                {"manufacturer": "Toyota", "model": "RAV4", "year": 2020, "mileage": 45000, "fuel_type": "Hybrid", "transmission": "Automatic", "condition": "Good"}
            ]
        },
    )

    manufacturer: str = Field(min_length=1, max_length=60)
    model: str = Field(min_length=1, max_length=60)
    year: int = Field(ge=1980, le=REFERENCE_YEAR + 1)
    mileage: float = Field(ge=0, le=1_000_000, description="Odometer reading in miles")
    fuel_type: Optional[Literal["Gasoline", "Diesel", "Hybrid", "Electric"]] = None
    transmission: Optional[Literal["Automatic", "Manual"]] = None
    body_type: Optional[Literal["Sedan", "SUV", "Truck", "Hatchback", "Coupe", "Convertible", "Minivan", "Wagon"]] = None
    drivetrain: Optional[Literal["FWD", "RWD", "AWD", "4WD"]] = None
    engine_size: Optional[float] = Field(default=None, ge=0, le=10, description="Litres (0 for electric)")
    condition: Optional[Literal["Excellent", "Good", "Fair", "Poor"]] = None
    owners: Optional[int] = Field(default=None, ge=1, le=10)
    accident_history: Optional[bool] = None


class PriceRange(BaseModel):
    low: float
    high: float
    confidence: float


class Prediction(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    estimated_price: float
    price_range: PriceRange
    currency: str
    model_used: str
    model_version: str


class BatchRequest(BaseModel):
    vehicles: list[Vehicle] = Field(min_length=1, max_length=100)


@lru_cache(maxsize=1)
def get_predictor() -> CarPricePredictor:
    return CarPricePredictor(os.environ.get("CAR_PRICE_MODEL", str(MODEL_PATH)))


def _predictor() -> CarPricePredictor:
    try:
        return get_predictor()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail="Model artifact not found — run `python -m car_price.train` first.") from exc


@app.get("/health", tags=["Monitoring"])
def health() -> dict:
    try:
        predictor = get_predictor()
    except FileNotFoundError:
        return {"status": "degraded", "model_loaded": False}
    return {"status": "ok", "model_loaded": True, "model": predictor.model_name, "version": predictor.version}


@app.get("/model-info", tags=["Model"])
def model_info() -> dict:
    predictor = _predictor()
    return {"model": predictor.model_name, "version": predictor.version, "trained_at": predictor.trained_at, "metrics": predictor.metrics}


@app.post("/predict", response_model=Prediction, tags=["Prediction"])
def predict(vehicle: Vehicle) -> dict:
    return _predictor().predict([vehicle.model_dump()])[0]


@app.post("/predict/batch", response_model=list[Prediction], tags=["Prediction"])
def predict_batch(request: BatchRequest) -> list[dict]:
    return _predictor().predict([v.model_dump() for v in request.vehicles])
