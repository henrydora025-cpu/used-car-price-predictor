import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def client(trained_model):
    import api.main as main

    main.get_predictor.cache_clear()
    return TestClient(main.app)


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["model_loaded"] is True


def test_predict(client):
    response = client.post("/predict", json={"manufacturer": "Toyota", "model": "RAV4", "year": 2020, "mileage": 45000, "fuel_type": "Hybrid"})
    assert response.status_code == 200
    body = response.json()
    assert body["estimated_price"] > 0
    assert body["currency"] == "USD"
    assert body["price_range"]["low"] <= body["estimated_price"] <= body["price_range"]["high"]


def test_predict_rejects_invalid_input(client):
    response = client.post("/predict", json={"manufacturer": "Toyota", "model": "Camry", "year": 2099, "mileage": -1, "fuel_type": "steam"})
    assert response.status_code == 422
    fields = {error["loc"][-1] for error in response.json()["detail"]}
    assert {"year", "mileage", "fuel_type"} <= fields


def test_batch_predictions(client):
    vehicles = [
        {"manufacturer": "Toyota", "model": "RAV4", "year": 2020, "mileage": 45000},
        {"manufacturer": "Ford", "model": "F-150", "year": 2015, "mileage": 120000},
    ]
    response = client.post("/predict/batch", json={"vehicles": vehicles})
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_openapi_documentation_is_served(client):
    assert client.get("/openapi.json").status_code == 200
    assert client.get("/docs").status_code == 200
