import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


@pytest.fixture(scope="session")
def trained_model(tmp_path_factory):
    """Quick training run on a sample of the real dataset (shared by model + API tests)."""
    from car_price.train import train

    model_path = tmp_path_factory.mktemp("model") / "car_price_model.joblib"
    summary = train(model_path=model_path, fast=True, sample=3000, make_plots=False, verbose=False)
    os.environ["CAR_PRICE_MODEL"] = str(model_path)
    return model_path, summary
