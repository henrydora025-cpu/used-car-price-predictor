import numpy as np
import pandas as pd

from car_price.data import DRIVETRAIN_MAP, FUEL_MAP, TRANSMISSION_MAP, clean, load_raw, map_labels, parse_number

BASE = {
    "listing_id": "L0", "manufacturer": "Toyota", "model": "Corolla", "year": "2018", "mileage": "60000",
    "fuel_type": "Gasoline", "transmission": "Automatic", "body_type": "Sedan", "drivetrain": "FWD",
    "engine_size": "1.8", "condition": "Good", "owners": "1", "accident_history": "No", "price": "15000",
}


def frame(rows: list[tuple[int, dict]]) -> pd.DataFrame:
    return pd.DataFrame([{**BASE, "listing_id": f"L{i}", **overrides} for i, overrides in rows])


def test_parse_number_handles_currency_and_units():
    out = parse_number(pd.Series(["$18,450", "45,000 mi", "2.0L", "abc", ""]))
    assert out.iloc[:3].tolist() == [18450, 45000, 2.0]
    assert np.isnan(out.iloc[3]) and np.isnan(out.iloc[4])


def test_label_synonyms_are_normalised():
    assert map_labels(pd.Series(["petrol", " EV "]), FUEL_MAP).tolist() == ["Gasoline", "Electric"]
    assert map_labels(pd.Series(["Stick", "CVT"]), TRANSMISSION_MAP).tolist() == ["Manual", "Automatic"]
    assert map_labels(pd.Series(["4x4"]), DRIVETRAIN_MAP).tolist() == ["4WD"]
    assert pd.isna(map_labels(pd.Series(["rocket fuel"]), FUEL_MAP).iloc[0])


def test_aliases_and_casing_are_unified():
    df, _ = clean(frame([
        (1, {"manufacturer": "Chevy", "model": "Malibu", "mileage": "10000"}),
        (2, {"manufacturer": "Chevrolet", "model": "Malibu", "mileage": "11000"}),
        (3, {"manufacturer": " toyota ", "model": "corolla", "mileage": "12000"}),
        (4, {"mileage": "13000"}),
        (5, {"mileage": "14000"}),
    ]))
    assert set(df["manufacturer"]) == {"Chevrolet", "Toyota"}
    assert set(df.loc[df["manufacturer"] == "Toyota", "model"]) == {"Corolla"}


def test_duplicates_missing_targets_and_invalid_rows_are_removed():
    df, report = clean(frame([
        (1, {"mileage": "10000"}),
        (1, {"mileage": "10000"}),
        (99, {"mileage": "10000", "manufacturer": "TOYOTA"}),
        (2, {"mileage": "20000", "price": ""}),
        (3, {"mileage": "30000", "year": "1900"}),
        (4, {"mileage": "40000", "price": "1"}),
        (5, {"mileage": "50000", "price": "$14,500"}),
    ]))
    assert len(df) == 2
    assert report.step("duplicates")["rows_removed"] == 2
    assert report.step("missing_target")["rows_removed"] == 1
    assert report.step("invalid_year")["rows_removed"] == 1
    assert report.step("price_bounds")["rows_removed"] == 1
    assert df.loc[df["mileage"] == 50000, "price"].item() == 14500


def test_price_typos_are_flagged_as_outliers():
    rows = [(i, {"mileage": str(50000 + i * 1000), "price": str(15000 + (i % 7) * 300)}) for i in range(30)]
    rows += [(100, {"mileage": "91500", "price": "152000"}), (101, {"mileage": "92500", "price": "1520"})]
    df, report = clean(frame(rows))
    assert report.step("price_outliers")["rows_removed"] == 2
    assert df["price"].between(10000, 20000).all()


def test_real_dataset_cleaning():
    raw = load_raw()
    df, report = clean(raw)
    assert report.raw_rows == len(raw)
    assert 0.9 * len(raw) < len(df) < len(raw)
    assert df["price"].between(500, 500_000).all()
    assert not df.duplicated().any()
    assert set(df["fuel_type"].dropna()) <= {"Gasoline", "Diesel", "Hybrid", "Electric"}
