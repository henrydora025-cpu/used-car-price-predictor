import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ModelArtifact } from "@/ml/artifact";
import { predictPrice, type PredictionInput } from "@/ml/predict";
import { MODEL_NAMES } from "@/ml/schema";

// Behavioural tests against the saved production artifact.
const artifact = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "models", "car_price_model.json"), "utf8"),
) as ModelArtifact;

const camry: PredictionInput = {
  manufacturer: "Toyota",
  model: "Camry",
  year: 2019,
  mileage: 60000,
  fuel_type: "Gasoline",
  transmission: "Automatic",
  condition: "Good",
  owners: 1,
  accident_history: false,
};
const price = (input: PredictionInput) => predictPrice(artifact, input).estimated_price;

describe("saved model artifact", () => {
  it("has the expected structure", () => {
    expect(artifact.formatVersion).toBe(1);
    expect(MODEL_NAMES).toContain(artifact.bestModel);
    expect(artifact.catalog.length).toBeGreaterThan(10);
  });

  it("returns a plausible estimate with a range that contains it", () => {
    const result = predictPrice(artifact, camry);
    expect(result.estimated_price).toBeGreaterThan(5000);
    expect(result.estimated_price).toBeLessThan(40000);
    expect(result.price_range.low).toBeLessThanOrEqual(result.estimated_price);
    expect(result.price_range.high).toBeGreaterThanOrEqual(result.estimated_price);
    expect(result.model_used).toBe(artifact.bestModel);
    expect(Object.keys(result.model_predictions)).toEqual([...MODEL_NAMES]);
  });

  it("values newer cars above older ones", () => {
    expect(price({ ...camry, year: 2023, mileage: 20000 })).toBeGreaterThan(price({ ...camry, year: 2012, mileage: 130000 }));
  });

  it("lowers the price for higher mileage", () => {
    expect(price({ ...camry, mileage: 20000 })).toBeGreaterThan(price({ ...camry, mileage: 180000 }));
  });

  it("penalises accidents and poor condition", () => {
    expect(price(camry)).toBeGreaterThan(price({ ...camry, condition: "Poor", accident_history: true, owners: 4 }));
  });

  it("prices luxury vehicles above economy cars of the same age", () => {
    const common = { year: 2020, mileage: 50000 };
    expect(price({ manufacturer: "BMW", model: "X5", ...common })).toBeGreaterThan(price({ manufacturer: "Kia", model: "Forte", ...common }));
  });

  it("accepts messy casing and synonyms", () => {
    expect(price({ ...camry, manufacturer: " toyota ", model: "CAMRY", fuel_type: "gas", transmission: "auto" })).toBe(price(camry));
  });

  it("imputes optional fields and reports them", () => {
    const result = predictPrice(artifact, { manufacturer: "Toyota", model: "Camry", year: 2019, mileage: 60000 });
    expect(result.imputed_fields).toEqual(
      expect.arrayContaining(["fuel_type", "transmission", "body_type", "drivetrain", "engine_size", "condition", "owners", "accident_history"]),
    );
  });

  it("warns about vehicles unseen in training", () => {
    const result = predictPrice(artifact, { manufacturer: "Toyota", model: "Supra Mk4", year: 2015, mileage: 80000 });
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.estimated_price).toBeGreaterThan(0);
  });

  it("forecasts a non-increasing value over the next five years", () => {
    const forecast = predictPrice(artifact, camry).depreciation_forecast;
    expect(forecast).toHaveLength(6);
    for (let i = 1; i < forecast.length; i++) {
      expect(forecast[i].estimated_price).toBeLessThanOrEqual(forecast[i - 1].estimated_price);
      expect(forecast[i].mileage).toBeGreaterThan(forecast[i - 1].mileage);
    }
  });
});
