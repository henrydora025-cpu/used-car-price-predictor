/**
 * A fitted pipeline = preprocessor + the three trained models. Predictions are in log(price).
 */
import { predictBoosting, type BoostingModel } from "./models/boosting";
import { predictForest, type ForestModel } from "./models/forest";
import { predictLinear, type LinearModel } from "./models/linear";
import { linearDesignRow, treeFeatureRow, type PreprocessorState } from "./preprocess";
import { MODEL_NAMES, type CompleteVehicle, type ModelName } from "./schema";

export interface TrainedModels {
  linear_regression: LinearModel;
  random_forest: ForestModel;
  gradient_boosting: BoostingModel;
}

export interface FittedPipeline {
  preprocessor: PreprocessorState;
  models: TrainedModels;
}

export function predictLogWith(fitted: FittedPipeline, name: ModelName, vehicle: CompleteVehicle): number {
  switch (name) {
    case "linear_regression":
      return predictLinear(fitted.models.linear_regression, linearDesignRow(fitted.preprocessor, vehicle));
    case "random_forest":
      return predictForest(fitted.models.random_forest, treeFeatureRow(fitted.preprocessor, vehicle));
    case "gradient_boosting":
      return predictBoosting(fitted.models.gradient_boosting, treeFeatureRow(fitted.preprocessor, vehicle));
  }
}

export function predictLogAll(fitted: FittedPipeline, vehicle: CompleteVehicle): Record<ModelName, number> {
  const treeRow = treeFeatureRow(fitted.preprocessor, vehicle);
  return {
    linear_regression: predictLinear(fitted.models.linear_regression, linearDesignRow(fitted.preprocessor, vehicle)),
    random_forest: predictForest(fitted.models.random_forest, treeRow),
    gradient_boosting: predictBoosting(fitted.models.gradient_boosting, treeRow),
  };
}

export function predictLogBatch(fitted: FittedPipeline, vehicles: CompleteVehicle[]): Record<ModelName, Float64Array> {
  const out = {} as Record<ModelName, Float64Array>;
  for (const name of MODEL_NAMES) out[name] = new Float64Array(vehicles.length);
  vehicles.forEach((vehicle, i) => {
    const p = predictLogAll(fitted, vehicle);
    for (const name of MODEL_NAMES) out[name][i] = p[name];
  });
  return out;
}
