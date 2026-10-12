import { describe, expect, it } from "vitest";
import { fitPreprocessor, imputeRecord, linearDesignRow, TREE_FEATURES, treeFeatureRow } from "@/ml/preprocess";
import type { LabeledVehicle, VehicleRecord } from "@/ml/schema";
import { generateVehicles } from "@/ml/synthetic";

const train: LabeledVehicle[] = generateVehicles({ rows: 3000, seed: 3, referenceYear: 2026 });
const state = fitPreprocessor(train, 2026);

const empty = (manufacturer: string, model: string, year: number): VehicleRecord => ({
  manufacturer,
  model,
  year,
  mileage: null,
  fuel_type: null,
  transmission: null,
  body_type: null,
  drivetrain: null,
  engine_size: null,
  condition: null,
  owners: null,
  accident_history: null,
});

describe("feature pipeline", () => {
  it("imputes missing characteristics from model-level statistics", () => {
    const { vehicle, imputed } = imputeRecord(state, empty("Tesla", "Model 3", 2022));
    expect(vehicle.fuel_type).toBe("Electric");
    expect(vehicle.engine_size).toBe(0);
    expect(vehicle.transmission).toBe("Automatic");
    expect(vehicle.body_type).toBe("Sedan");
    expect(vehicle.mileage).toBeGreaterThan(20000);
    expect(imputed).toEqual(expect.arrayContaining(["mileage", "fuel_type", "engine_size", "condition", "owners"]));
  });

  it("keeps provided values untouched", () => {
    const record: VehicleRecord = {
      ...empty("Ford", "F-150", 2015),
      mileage: 123456,
      fuel_type: "Gasoline",
      engine_size: 5,
      drivetrain: "4WD",
      condition: "Fair",
      owners: 2,
      accident_history: true,
    };
    const { vehicle, imputed } = imputeRecord(state, record);
    expect(vehicle).toMatchObject({ mileage: 123456, engine_size: 5, drivetrain: "4WD", condition: "Fair", owners: 2, accident_history: true });
    expect(imputed).not.toContain("mileage");
    expect(imputed).not.toContain("engine_size");
  });

  it("encodes unseen manufacturers/models without failing", () => {
    const { vehicle } = imputeRecord(state, { ...empty("Lada", "Niva", 2010), mileage: 90000 });
    const tree = treeFeatureRow(state, vehicle);
    const linear = linearDesignRow(state, vehicle);
    expect(tree).toHaveLength(TREE_FEATURES.length);
    expect(tree.every(Number.isFinite)).toBe(true);
    expect(Array.from(linear.dense).every(Number.isFinite)).toBe(true);
    // unseen make & model → no active one-hot column for those blocks
    const knownRow = linearDesignRow(state, imputeRecord(state, { ...empty("Toyota", "Camry", 2010), mileage: 90000 }).vehicle);
    expect(linear.hot.length).toBeLessThan(knownRow.hot.length);
  });

  it("standardises numeric features using training statistics", () => {
    expect(state.scaler.mean).toHaveLength(8);
    expect(state.scaler.std.every((s) => s > 0)).toBe(true);
  });
});
