import fs from "node:fs";
import path from "node:path";
import type { ModelArtifact } from "@/ml/artifact";
import {
  BODY_TYPES,
  CONDITIONS,
  DRIVETRAINS,
  FUEL_TYPES,
  MODEL_LABELS,
  MODEL_NAMES,
  TRANSMISSIONS,
  type ModelName,
} from "@/ml/schema";

const store = globalThis as typeof globalThis & { __carPriceModel?: ModelArtifact };

function readArtifactFile(): string {
  const custom = process.env.MODEL_PATH;
  if (custom) return fs.readFileSync(/*turbopackIgnore: true*/ custom, "utf8");
  return fs.readFileSync(path.join(/*turbopackIgnore: true*/ process.cwd(), "models", "car_price_model.json"), "utf8");
}

/** Loads the trained artifact once per server process (≈2 MB JSON). Override the location with MODEL_PATH. */
export function getModelArtifact(): ModelArtifact {
  if (!store.__carPriceModel) {
    store.__carPriceModel = JSON.parse(readArtifactFile()) as ModelArtifact;
  }
  return store.__carPriceModel;
}

export function getModelSummary(artifact: ModelArtifact = getModelArtifact()) {
  const best = artifact.bestModel;
  return {
    version: artifact.version,
    trained_at: artifact.trainedAt,
    training_seconds: artifact.trainingSeconds,
    reference_year: artifact.referenceYear,
    best_model: best,
    best_model_label: MODEL_LABELS[best],
    selection: artifact.selection,
    dataset: artifact.dataset,
    models: MODEL_NAMES.map((name: ModelName) => {
      const e = artifact.evaluation[name];
      const hyperparameters: Record<string, number> =
        name === "linear_regression"
          ? { lambda: artifact.config.linear.lambda, coefficients: artifact.models.linear_regression.weights.length }
          : name === "random_forest"
            ? { ...artifact.config.forest }
            : { ...artifact.config.boosting };
      return {
        name,
        label: MODEL_LABELS[name],
        selected: name === best,
        cv: {
          rmse_mean: e.cv.rmse.mean,
          rmse_std: e.cv.rmse.std,
          mae_mean: e.cv.mae.mean,
          r2_mean: e.cv.r2.mean,
          mape_mean: e.cv.mape.mean,
        },
        test: e.test,
        interval_coverage_80: e.intervalCoverage80,
        train_seconds: e.trainSeconds,
        hyperparameters,
      };
    }),
    feature_importance: artifact.featureImportance[best],
  };
}

export type ModelSummary = ReturnType<typeof getModelSummary>;

export function getVehicleOptions(artifact: ModelArtifact = getModelArtifact()) {
  return {
    reference_year: artifact.referenceYear,
    year_range: artifact.dataset.yearRange,
    fuel_types: [...FUEL_TYPES],
    transmissions: [...TRANSMISSIONS],
    body_types: [...BODY_TYPES],
    drivetrains: [...DRIVETRAINS],
    conditions: [...CONDITIONS],
    manufacturers: artifact.catalog,
  };
}

export type VehicleOptions = ReturnType<typeof getVehicleOptions>;
