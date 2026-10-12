from car_price.predict import CarPricePredictor

BASE = {"manufacturer": "Toyota", "model": "Camry", "year": 2019, "mileage": 60000, "fuel_type": "Gasoline", "transmission": "Automatic"}


def test_three_models_are_compared_and_best_is_selected(trained_model):
    _, summary = trained_model
    models = summary["models"]
    assert set(models) == {"linear_regression", "random_forest", "gradient_boosting"}
    assert models[summary["best_model"]]["cv_rmse_mean"] == min(m["cv_rmse_mean"] for m in models.values())
    for metrics in models.values():
        assert metrics["test"]["r2"] > 0.7


def test_predictions_behave_sensibly(trained_model):
    model_path, _ = trained_model
    predictor = CarPricePredictor(model_path)
    newer = predictor.predict([{**BASE, "year": 2023, "mileage": 20000}])[0]["estimated_price"]
    older = predictor.predict([{**BASE, "year": 2010, "mileage": 150000}])[0]["estimated_price"]
    assert newer > older > 0

    result = predictor.predict([BASE])[0]
    assert result["price_range"]["low"] <= result["estimated_price"] <= result["price_range"]["high"]

    messy = predictor.predict([{**BASE, "manufacturer": " toyota ", "model": "CAMRY", "fuel_type": "gas", "transmission": "auto"}])[0]
    assert messy["estimated_price"] == result["estimated_price"]


def test_missing_optional_fields_are_imputed(trained_model):
    model_path, _ = trained_model
    predictor = CarPricePredictor(model_path)
    result = predictor.predict([{"manufacturer": "Honda", "model": "Civic", "year": 2018, "mileage": 70000}])[0]
    assert result["estimated_price"] > 0
