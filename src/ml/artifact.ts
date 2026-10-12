/**
 * Shape of the serialised model artifact (models/car_price_model.json).
 */
import type { CleaningReport } from "./cleaning";
import type { TrainingConfig } from "./config";
import type { TrainedModels } from "./ensemble";
import type { RegressionMetrics } from "./metrics";
import type { CurvePoint } from "./models/boosting";
import type { PreprocessorState } from "./preprocess";
import type { ModelName } from "./schema";

export interface MetricSummary {
  mean: number;
  std: number;
}

export interface ModelEvaluation {
  cv: {
    rmse: MetricSummary;
    mae: MetricSummary;
    r2: MetricSummary;
    mape: MetricSummary;
    folds: RegressionMetrics[];
  };
  test: RegressionMetrics;
  trainSeconds: number;
  /** Quantiles of out-of-fold log residuals log(actual) − log(predicted); used for price ranges. */
  residualQuantiles: { q05: number; q10: number; q90: number; q95: number };
  /** Share of held-out test vehicles whose real price falls inside the 80% range. */
  intervalCoverage80: number;
}

export interface FeatureImportance {
  feature: string;
  importance: number;
  share: number;
}

export interface CatalogModel {
  name: string;
  count: number;
  years: [number, number];
  bodyTypes: string[];
  fuelTypes: string[];
  drivetrains: string[];
  transmissions: string[];
  engineSizes: number[];
  medianPrice: number;
}

export interface CatalogManufacturer {
  name: string;
  count: number;
  models: CatalogModel[];
}

export interface CategoryPrice {
  category: string;
  median: number;
  count: number;
}

export interface ArtifactCharts {
  priceHistogram: { label: string; from: number; to: number; count: number }[];
  priceByAge: { age: number; year: number; median: number; mean: number; count: number }[];
  priceByManufacturer: CategoryPrice[];
  priceByFuel: CategoryPrice[];
  priceByBody: CategoryPrice[];
  mileageVsPrice: { mileage: number; price: number; age: number }[];
  predictedVsActual: Record<ModelName, { actual: number; predicted: number }[]>;
  errorDistribution: { label: string; center: number; count: number }[];
  learningCurve: CurvePoint[];
}

export interface DatasetSummary {
  source: string;
  rawRows: number;
  cleanRows: number;
  trainRows: number;
  testRows: number;
  yearRange: [number, number];
  priceRange: [number, number];
  medianPrice: number;
  manufacturers: number;
  models: number;
}

export interface ModelArtifact {
  formatVersion: 1;
  version: string;
  trainedAt: string;
  referenceYear: number;
  trainingSeconds: number;
  config: TrainingConfig;
  dataset: DatasetSummary;
  cleaning: CleaningReport;
  preprocessor: PreprocessorState;
  models: TrainedModels;
  bestModel: ModelName;
  selection: { metric: string; description: string; ranking: { model: ModelName; cvRmse: number }[] };
  evaluation: Record<ModelName, ModelEvaluation>;
  featureImportance: Record<ModelName, FeatureImportance[]>;
  splitImportance: { random_forest: FeatureImportance[]; gradient_boosting: FeatureImportance[] };
  charts: ArtifactCharts;
  catalog: CatalogManufacturer[];
}
