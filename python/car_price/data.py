"""Loading and cleaning of the raw used-car listings (mirrors src/ml/cleaning.ts).

Steps: standardise labels & parse values → drop rows without target/identifiers →
remove duplicates → drop invalid years → nullify impossible values → price domain bounds →
robust peer-group outlier removal (modified z-score of log price).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import pandas as pd

from .config import RAW_DATA_PATH, REFERENCE_YEAR

NULL_TOKENS = {"", "na", "n/a", "nan", "null", "unknown", "-", "--", "?"}

MANUFACTURER_ALIASES = {
    "chevy": "Chevrolet", "chevrolet": "Chevrolet",
    "vw": "Volkswagen", "volkswagen": "Volkswagen",
    "mercedes": "Mercedes-Benz", "mercedes benz": "Mercedes-Benz", "mercedes-benz": "Mercedes-Benz", "benz": "Mercedes-Benz",
    "bmw": "BMW", "gmc": "GMC", "ram": "Ram", "dodge ram": "Ram",
}
FUEL_MAP = {
    "gasoline": "Gasoline", "gas": "Gasoline", "petrol": "Gasoline", "unleaded": "Gasoline", "flex": "Gasoline", "flex fuel": "Gasoline",
    "diesel": "Diesel", "tdi": "Diesel",
    "hybrid": "Hybrid", "hev": "Hybrid", "phev": "Hybrid", "plug-in hybrid": "Hybrid",
    "electric": "Electric", "ev": "Electric", "bev": "Electric", "battery electric": "Electric",
}
TRANSMISSION_MAP = {
    "automatic": "Automatic", "auto": "Automatic", "a/t": "Automatic", "at": "Automatic", "cvt": "Automatic", "dct": "Automatic", "dual-clutch": "Automatic",
    "manual": "Manual", "m/t": "Manual", "mt": "Manual", "stick": "Manual", "stick shift": "Manual", "standard": "Manual",
}
BODY_MAP = {
    "sedan": "Sedan", "saloon": "Sedan", "suv": "SUV", "crossover": "SUV", "sport utility": "SUV",
    "truck": "Truck", "pickup": "Truck", "pickup truck": "Truck", "pick-up": "Truck",
    "hatchback": "Hatchback", "hatch": "Hatchback", "coupe": "Coupe", "coupé": "Coupe",
    "convertible": "Convertible", "cabriolet": "Convertible", "roadster": "Convertible",
    "minivan": "Minivan", "van": "Minivan", "mini-van": "Minivan", "wagon": "Wagon", "estate": "Wagon",
}
DRIVETRAIN_MAP = {
    "fwd": "FWD", "front-wheel drive": "FWD", "front wheel drive": "FWD",
    "rwd": "RWD", "rear-wheel drive": "RWD", "rear wheel drive": "RWD",
    "awd": "AWD", "all-wheel drive": "AWD", "all wheel drive": "AWD",
    "4wd": "4WD", "4x4": "4WD", "four-wheel drive": "4WD", "four wheel drive": "4WD",
}
CONDITION_MAP = {
    "excellent": "Excellent", "like new": "Excellent", "good": "Good", "very good": "Good",
    "fair": "Fair", "average": "Fair", "poor": "Poor", "salvage": "Poor", "rough": "Poor",
}
BOOLEAN_MAP = {"yes": 1.0, "y": 1.0, "true": 1.0, "1": 1.0, "no": 0.0, "n": 0.0, "false": 0.0, "0": 0.0, "none": 0.0}
CONDITION_SCORE = {"Excellent": 3, "Good": 2, "Fair": 1, "Poor": 0}

FEATURE_COLUMNS = [
    "manufacturer", "model", "year", "mileage", "fuel_type", "transmission",
    "body_type", "drivetrain", "engine_size", "condition", "owners", "accident_history",
]


@dataclass
class CleaningReport:
    raw_rows: int
    clean_rows: int = 0
    steps: list[dict] = field(default_factory=list)

    def add(self, key: str, title: str, before: int, after: int, changed: int = 0) -> None:
        self.steps.append(
            {"key": key, "step": title, "rows_before": before, "rows_after": after, "rows_removed": before - after, "values_changed": changed}
        )

    def step(self, key: str) -> dict:
        return next(s for s in self.steps if s["key"] == key)


def load_raw(path: str | Path = RAW_DATA_PATH) -> pd.DataFrame:
    """Reads the raw CSV with every column as text (parsing happens in `clean`)."""
    return pd.read_csv(path, dtype=str, keep_default_na=False)


def clean_text(series: pd.Series) -> pd.Series:
    text = series.fillna("").astype(str).str.replace(r"\s+", " ", regex=True).str.strip()
    return text.mask(text.str.lower().isin(NULL_TOKENS)).astype(object)


def map_labels(series: pd.Series, mapping: dict) -> pd.Series:
    return clean_text(series).str.lower().map(mapping)


def parse_number(series: pd.Series) -> pd.Series:
    """Parses '$18,450', '45,000 mi', '2.0L' or plain numbers; unparseable → NaN."""
    text = clean_text(series)
    extracted = text.str.replace(r"[$€£,\s]", "", regex=True).str.extract(r"^(-?\d+(?:\.\d+)?)", expand=False)
    return pd.to_numeric(extracted, errors="coerce")


def canonical_spelling(keys: pd.Series, spellings: pd.Series) -> pd.Series:
    """Most frequent spelling of every case-insensitive key ('toyota', 'TOYOTA' → 'Toyota')."""
    frame = pd.DataFrame({"key": keys, "spelling": spellings}).dropna()
    counts = frame.value_counts(["key", "spelling"]).reset_index(name="n")
    counts = counts.sort_values(["key", "n", "spelling"], ascending=[True, False, True]).drop_duplicates("key")
    return keys.map(dict(zip(counts["key"], counts["spelling"])))


def clean(
    raw: pd.DataFrame,
    reference_year: int = REFERENCE_YEAR,
    outlier_threshold: float = 5.0,
    min_group_size: int = 8,
) -> tuple[pd.DataFrame, CleaningReport]:
    report = CleaningReport(raw_rows=len(raw))

    # 1. Standardise labels & parse values
    df = pd.DataFrame(index=raw.index)
    make_text = clean_text(raw["manufacturer"])
    alias = make_text.str.lower().map(MANUFACTURER_ALIASES)
    spelling = alias.fillna(make_text)
    df["manufacturer"] = alias.fillna(canonical_spelling(spelling.str.lower(), spelling))
    model_text = clean_text(raw["model"])
    df["model"] = canonical_spelling(df["manufacturer"].str.cat(model_text.str.lower(), sep="|"), model_text)
    df["year"] = parse_number(raw["year"]).round()
    df["mileage"] = parse_number(raw["mileage"])
    df["fuel_type"] = map_labels(raw["fuel_type"], FUEL_MAP)
    df["transmission"] = map_labels(raw["transmission"], TRANSMISSION_MAP)
    df["body_type"] = map_labels(raw["body_type"], BODY_MAP)
    df["drivetrain"] = map_labels(raw["drivetrain"], DRIVETRAIN_MAP)
    df["engine_size"] = parse_number(raw["engine_size"])
    df["condition"] = map_labels(raw["condition"], CONDITION_MAP)
    df["owners"] = parse_number(raw["owners"]).round()
    df["accident_history"] = map_labels(raw["accident_history"], BOOLEAN_MAP).astype(float)
    df["price"] = parse_number(raw["price"])
    listing_id = clean_text(raw["listing_id"]) if "listing_id" in raw else pd.Series(np.nan, index=raw.index, dtype=object)
    report.add("standardize", "Standardize labels & parse values", len(raw), len(df))

    # 2. Rows without target or identifiers
    before = len(df)
    df = df.dropna(subset=["price", "manufacturer", "model"])
    report.add("missing_target", "Drop rows missing price or make/model", before, len(df))

    # 3. Duplicates (same listing id, or identical after normalisation)
    before = len(df)
    ids = listing_id.loc[df.index]
    duplicated = df.duplicated(subset=FEATURE_COLUMNS + ["price"]) | (ids.notna() & ids.duplicated())
    df = df[~duplicated]
    report.add("duplicates", "Remove duplicate listings", before, len(df))

    # 4. Invalid model years
    before = len(df)
    df = df[df["year"].between(1990, reference_year + 1)].copy()
    report.add("invalid_year", "Drop invalid model years", before, len(df))

    # 5. Impossible values → NaN (imputed later inside the model pipeline)
    changed = 0
    for column, invalid in (
        ("mileage", (df["mileage"] < 0) | (df["mileage"] > 600_000)),
        ("engine_size", (df["engine_size"] < 0) | (df["engine_size"] > 8.5)),
        ("owners", (df["owners"] < 1) | (df["owners"] > 10)),
    ):
        changed += int(invalid.sum())
        df.loc[invalid, column] = np.nan
    electric_with_engine = (df["fuel_type"] == "Electric") & (df["engine_size"] > 0)
    changed += int(electric_with_engine.sum())
    df.loc[electric_with_engine, "engine_size"] = 0.0
    report.add("impossible_values", "Nullify impossible values", len(df), len(df), changed)

    # 6. Domain bounds on price
    before = len(df)
    df = df[df["price"].between(500, 500_000)]
    report.add("price_bounds", "Remove implausible prices", before, len(df))

    # 7. Robust outliers: modified z-score of log(price) within peer groups
    before = len(df)
    log_price = np.log(df["price"])
    band = ((reference_year - df["year"]).clip(lower=0) // 3).astype(int)
    z = pd.Series(np.nan, index=df.index)
    for keys in (["manufacturer", "model"], ["manufacturer"]):
        groups = [df[k] for k in keys] + [band]
        grouped = log_price.groupby(groups)
        size = grouped.transform("size")
        median = grouped.transform("median")
        mad = (log_price - median).abs().groupby(groups).transform("median")
        candidate = 0.6745 * (log_price - median) / mad.clip(lower=0.05)
        z = z.fillna(candidate.where(size >= min_group_size))
    df = df[~(z.abs() > outlier_threshold)]
    report.add("price_outliers", "Remove statistical price outliers", before, len(df))

    df = df.reset_index(drop=True)
    report.clean_rows = len(df)
    return df, report
