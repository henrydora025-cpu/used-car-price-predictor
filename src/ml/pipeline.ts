/**
 * End-to-end training pipeline:
 *   raw rows → cleaning → train/test split → K-fold CV of 3 models → model selection
 *   → final fit → held-out evaluation → permutation importance → artifact.
 */
import type {
  ArtifactCharts,
  CatalogManufacturer,
  CategoryPrice,
  FeatureImportance,
  MetricSummary,
  ModelArtifact,
  ModelEvaluation,
} from "./artifact";
import { cleanDataset } from "./cleaning";
import { DEFAULT_TRAINING_CONFIG, type TrainingConfig } from "./config";
import type { RawRow } from "./csv";
import { predictLogBatch, type FittedPipeline } from "./ensemble";
import { mean, median, quantile, regressionMetrics, rmse, std, type RegressionMetrics } from "./metrics";
import { fitBoosting, type CurvePoint } from "./models/boosting";
import { fitForest } from "./models/forest";
import { fitLinear } from "./models/linear";
import { makeTreeData } from "./models/tree";
import {
  fitPreprocessor,
  imputeRecord,
  linearDesignRow,
  linearDesignSize,
  TREE_FEATURE_LABELS,
  TREE_FEATURES,
  treeFeatureRow,
  vehicleAge,
} from "./preprocess";
import { createRng, shuffle, type Rng } from "./random";
import { MODEL_LABELS, MODEL_NAMES, type CompleteVehicle, type LabeledVehicle, type ModelName } from "./schema";

export interface FitResult {
  fitted: FittedPipeline;
  seconds: Record<ModelName, number>;
  curve: CurvePoint[];
  splitImportance: { random_forest: number[]; gradient_boosting: number[] };
}

function toColumns(rows: number[][], m: number): Float64Array[] {
  const columns = Array.from({ length: m }, () => new Float64Array(rows.length));
  rows.forEach((row, i) => {
    for (let j = 0; j < m; j++) columns[j][i] = row[j];
  });
  return columns;
}

const expAll = (values: ArrayLike<number>) => Array.from(values, (v) => Math.exp(v));

/** Fits the preprocessor and all three models on `train` (target = log(price)). */
export function fitPipeline(
  train: LabeledVehicle[],
  config: TrainingConfig,
  seed: number,
  evalSet?: LabeledVehicle[],
): FitResult {
  const preprocessor = fitPreprocessor(train, config.referenceYear);
  const vehicles = train.map((r) => imputeRecord(preprocessor, r).vehicle);
  const y = Float64Array.from(train, (r) => Math.log(r.price));
  const seconds = {} as Record<ModelName, number>;
  const m = TREE_FEATURES.length;

  let start = performance.now();
  const linear = fitLinear(
    vehicles.map((v) => linearDesignRow(preprocessor, v)),
    y,
    linearDesignSize(preprocessor),
    config.linear.lambda,
  );
  seconds.linear_regression = (performance.now() - start) / 1000;

  const data = makeTreeData(
    toColumns(
      vehicles.map((v) => treeFeatureRow(preprocessor, v)),
      m,
    ),
    config.maxBins,
  );

  start = performance.now();
  const forest = fitForest(data, y, { ...config.forest, seed });
  seconds.random_forest = (performance.now() - start) / 1000;

  let valid: { columns: Float64Array[]; y: Float64Array } | undefined;
  if (evalSet && evalSet.length > 0) {
    const evalVehicles = evalSet.map((r) => imputeRecord(preprocessor, r).vehicle);
    valid = {
      columns: toColumns(
        evalVehicles.map((v) => treeFeatureRow(preprocessor, v)),
        m,
      ),
      y: Float64Array.from(evalSet, (r) => Math.log(r.price)),
    };
  }
  start = performance.now();
  const boosting = fitBoosting(data, y, { ...config.boosting, seed: seed + 7 }, valid);
  seconds.gradient_boosting = (performance.now() - start) / 1000;

  return {
    fitted: {
      preprocessor,
      models: { linear_regression: linear, random_forest: forest.model, gradient_boosting: boosting.model },
    },
    seconds,
    curve: boosting.curve,
    splitImportance: { random_forest: forest.importance, gradient_boosting: boosting.importance },
  };
}

const IMPORTANCE_GROUPS: { feature: string; fields: (keyof CompleteVehicle)[] }[] = [
  { feature: "Make & model", fields: ["manufacturer", "model"] },
  { feature: "Year (age)", fields: ["year"] },
  { feature: "Mileage", fields: ["mileage"] },
  { feature: "Fuel type", fields: ["fuel_type"] },
  { feature: "Transmission", fields: ["transmission"] },
  { feature: "Body type", fields: ["body_type"] },
  { feature: "Drivetrain", fields: ["drivetrain"] },
  { feature: "Engine size", fields: ["engine_size"] },
  { feature: "Condition", fields: ["condition"] },
  { feature: "Previous owners", fields: ["owners"] },
  { feature: "Accident history", fields: ["accident_history"] },
];

/** Model-agnostic permutation importance: RMSE increase when one input is shuffled. */
export function permutationImportance(
  fitted: FittedPipeline,
  vehicles: CompleteVehicle[],
  actual: number[],
  repeats: number,
  seed: number,
): Record<ModelName, FeatureImportance[]> {
  const rng = createRng(seed);
  const base = predictLogBatch(fitted, vehicles);
  const baseRmse = {} as Record<ModelName, number>;
  const totals = {} as Record<ModelName, number[]>;
  for (const name of MODEL_NAMES) {
    baseRmse[name] = rmse(actual, expAll(base[name]));
    totals[name] = IMPORTANCE_GROUPS.map(() => 0);
  }
  IMPORTANCE_GROUPS.forEach((group, g) => {
    for (let rep = 0; rep < repeats; rep++) {
      const permutation = shuffle(
        vehicles.map((_, i) => i),
        rng,
      );
      const permuted = vehicles.map((vehicle, i) => {
        const copy: Record<string, unknown> = { ...vehicle };
        const source = vehicles[permutation[i]];
        for (const field of group.fields) copy[field] = source[field];
        return copy as unknown as CompleteVehicle;
      });
      const preds = predictLogBatch(fitted, permuted);
      for (const name of MODEL_NAMES) totals[name][g] += (rmse(actual, expAll(preds[name])) - baseRmse[name]) / repeats;
    }
  });
  const out = {} as Record<ModelName, FeatureImportance[]>;
  for (const name of MODEL_NAMES) {
    const positive = totals[name].map((v) => Math.max(0, v));
    const sum = positive.reduce((a, b) => a + b, 0) || 1;
    out[name] = IMPORTANCE_GROUPS.map((group, g) => ({
      feature: group.feature,
      importance: Math.round(totals[name][g]),
      share: positive[g] / sum,
    })).sort((a, b) => b.importance - a.importance);
  }
  return out;
}

function labelSplitImportance(values: number[]): FeatureImportance[] {
  return TREE_FEATURES.map((name, j) => ({ feature: TREE_FEATURE_LABELS[name], importance: values[j], share: values[j] })).sort(
    (a, b) => b.share - a.share,
  );
}

function groupPrices(data: LabeledVehicle[], key: (r: LabeledVehicle) => string | null): Map<string, number[]> {
  const groups = new Map<string, number[]>();
  for (const r of data) {
    const k = key(r);
    if (k === null) continue;
    const list = groups.get(k);
    if (list) list.push(r.price);
    else groups.set(k, [r.price]);
  }
  return groups;
}

function categoryPrices(groups: Map<string, number[]>): CategoryPrice[] {
  return [...groups.entries()]
    .map(([category, prices]) => ({ category, median: Math.round(median(prices)), count: prices.length }))
    .sort((a, b) => b.median - a.median);
}

function sampleIndices(n: number, k: number, rng: Rng): number[] {
  return shuffle(
    Array.from({ length: n }, (_, i) => i),
    rng,
  ).slice(0, Math.min(n, k));
}

function buildCharts(
  data: LabeledVehicle[],
  referenceYear: number,
  testActual: number[],
  testLog: Record<ModelName, Float64Array>,
  best: ModelName,
  curve: CurvePoint[],
  rng: Rng,
): ArtifactCharts {
  const width = 2500;
  const maxEdge = 80000;
  const priceHistogram: ArtifactCharts["priceHistogram"] = [];
  for (let from = 0; from < maxEdge; from += width) {
    priceHistogram.push({ label: `$${from / 1000}k`, from, to: from + width, count: 0 });
  }
  const maxPrice = data.reduce((m, r) => Math.max(m, r.price), 0);
  priceHistogram.push({ label: `$${maxEdge / 1000}k+`, from: maxEdge, to: maxPrice, count: 0 });
  for (const r of data) priceHistogram[Math.min(priceHistogram.length - 1, Math.floor(r.price / width))].count++;

  const priceByAge = [...groupPrices(data, (r) => String(vehicleAge(referenceYear, r.year))).entries()]
    .map(([age, prices]) => ({
      age: Number(age),
      year: referenceYear - Number(age),
      median: Math.round(median(prices)),
      mean: Math.round(mean(prices)),
      count: prices.length,
    }))
    .filter((p) => p.count >= 5)
    .sort((a, b) => a.age - b.age);

  const priceByManufacturer = categoryPrices(groupPrices(data, (r) => r.manufacturer));
  const priceByFuel = categoryPrices(groupPrices(data, (r) => r.fuel_type));
  const priceByBody = categoryPrices(groupPrices(data, (r) => r.body_type));

  const withMileage = data.filter((r) => r.mileage !== null);
  const mileageVsPrice = sampleIndices(withMileage.length, 600, rng).map((i) => ({
    mileage: withMileage[i].mileage as number,
    price: withMileage[i].price,
    age: vehicleAge(referenceYear, withMileage[i].year),
  }));

  const picked = sampleIndices(testActual.length, 400, rng);
  const predictedVsActual = {} as ArtifactCharts["predictedVsActual"];
  for (const name of MODEL_NAMES) {
    predictedVsActual[name] = picked.map((i) => ({ actual: testActual[i], predicted: Math.round(Math.exp(testLog[name][i])) }));
  }

  const errorDistribution: ArtifactCharts["errorDistribution"] = [];
  for (let c = -50; c <= 50; c += 5) errorDistribution.push({ label: `${c > 0 ? "+" : ""}${c}%`, center: c, count: 0 });
  testActual.forEach((actual, i) => {
    const pct = ((Math.exp(testLog[best][i]) - actual) / actual) * 100;
    const index = Math.min(errorDistribution.length - 1, Math.max(0, Math.round((pct + 50) / 5)));
    errorDistribution[index].count++;
  });

  return {
    priceHistogram,
    priceByAge,
    priceByManufacturer,
    priceByFuel,
    priceByBody,
    mileageVsPrice,
    predictedVsActual,
    errorDistribution,
    learningCurve: curve.map((p) => ({
      iteration: p.iteration,
      train: Number(p.train.toFixed(5)),
      valid: p.valid === null ? null : Number(p.valid.toFixed(5)),
    })),
  };
}

function rankedValues(values: (string | null)[]): string[] {
  const counts = new Map<string, number>();
  for (const v of values) if (v !== null) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([v]) => v);
}

/** Manufacturer → model catalogue used to drive the web form. */
export function buildCatalog(data: LabeledVehicle[]): CatalogManufacturer[] {
  const byMake = new Map<string, Map<string, LabeledVehicle[]>>();
  for (const r of data) {
    const models = byMake.get(r.manufacturer) ?? new Map<string, LabeledVehicle[]>();
    const rows = models.get(r.model) ?? [];
    rows.push(r);
    models.set(r.model, rows);
    byMake.set(r.manufacturer, models);
  }
  return [...byMake.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, models]) => ({
      name,
      count: [...models.values()].reduce((sum, rows) => sum + rows.length, 0),
      models: [...models.entries()]
        .sort((a, b) => a[0].localeCompare(b[0], "en", { numeric: true }))
        .map(([modelName, rows]) => {
          const engineCounts = new Map<number, number>();
          for (const r of rows) {
            if (r.engine_size !== null && r.engine_size > 0) {
              engineCounts.set(r.engine_size, (engineCounts.get(r.engine_size) ?? 0) + 1);
            }
          }
          const years = rows.map((r) => r.year);
          return {
            name: modelName,
            count: rows.length,
            years: [Math.min(...years), Math.max(...years)] as [number, number],
            bodyTypes: rankedValues(rows.map((r) => r.body_type)),
            fuelTypes: rankedValues(rows.map((r) => r.fuel_type)),
            drivetrains: rankedValues(rows.map((r) => r.drivetrain)),
            transmissions: rankedValues(rows.map((r) => r.transmission)),
            engineSizes: [...engineCounts.entries()]
              .filter(([, count]) => count >= 2)
              .map(([size]) => size)
              .sort((a, b) => a - b),
            medianPrice: Math.round(median(rows.map((r) => r.price))),
          };
        }),
    }));
}

function shortHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0").slice(0, 7);
}

export function trainModels(
  rawRows: RawRow[],
  config: TrainingConfig = DEFAULT_TRAINING_CONFIG,
  log: (message: string) => void = () => undefined,
  source = "data/raw/used_cars.csv",
): ModelArtifact {
  const started = performance.now();
  const { data, report } = cleanDataset(rawRows, { referenceYear: config.referenceYear });
  log(`Cleaning: ${report.rawRows} raw rows → ${report.cleanRows} clean rows`);
  for (const step of report.steps) {
    log(`  • ${step.title}: −${step.rowsRemoved} rows${step.valuesChanged ? `, ${step.valuesChanged} values fixed` : ""}`);
  }

  const rng = createRng(config.seed);
  const shuffled = shuffle([...data], rng);
  const testCount = Math.round(shuffled.length * config.testSize);
  const test = shuffled.slice(0, testCount);
  const train = shuffled.slice(testCount);
  log(`Split: ${train.length} train / ${test.length} test (held out until the very end)`);

  // K-fold cross-validation on the training split → model selection + calibrated ranges.
  const folds = { linear_regression: [], random_forest: [], gradient_boosting: [] } as Record<ModelName, RegressionMetrics[]>;
  const oofResiduals = { linear_regression: [], random_forest: [], gradient_boosting: [] } as Record<ModelName, number[]>;
  for (let k = 0; k < config.cvFolds; k++) {
    const foldTrain = train.filter((_, i) => i % config.cvFolds !== k);
    const foldValid = train.filter((_, i) => i % config.cvFolds === k);
    const { fitted } = fitPipeline(foldTrain, config, config.seed + 101 * (k + 1));
    const preds = predictLogBatch(
      fitted,
      foldValid.map((r) => imputeRecord(fitted.preprocessor, r).vehicle),
    );
    const actual = foldValid.map((r) => r.price);
    for (const name of MODEL_NAMES) {
      folds[name].push(regressionMetrics(actual, expAll(preds[name])));
      foldValid.forEach((r, i) => oofResiduals[name].push(Math.log(r.price) - preds[name][i]));
    }
    log(
      `CV fold ${k + 1}/${config.cvFolds}: ` +
        MODEL_NAMES.map((n) => `${MODEL_LABELS[n]} RMSE $${Math.round(folds[n][k].rmse)}`).join(" | "),
    );
  }

  // Final fit on the whole training split, evaluated once on the untouched test split.
  const final = fitPipeline(train, config, config.seed, test);
  const testVehicles = test.map((r) => imputeRecord(final.fitted.preprocessor, r).vehicle);
  const testActual = test.map((r) => r.price);
  const testLog = predictLogBatch(final.fitted, testVehicles);

  const evaluation = {} as Record<ModelName, ModelEvaluation>;
  for (const name of MODEL_NAMES) {
    const sorted = Float64Array.from(oofResiduals[name]).sort();
    const q = {
      q05: quantile(sorted, 0.05),
      q10: quantile(sorted, 0.1),
      q90: quantile(sorted, 0.9),
      q95: quantile(sorted, 0.95),
    };
    let covered = 0;
    test.forEach((r, i) => {
      const residual = Math.log(r.price) - testLog[name][i];
      if (residual >= q.q10 && residual <= q.q90) covered++;
    });
    const summary = (key: keyof RegressionMetrics): MetricSummary => ({
      mean: mean(folds[name].map((f) => f[key])),
      std: std(folds[name].map((f) => f[key])),
    });
    evaluation[name] = {
      cv: { rmse: summary("rmse"), mae: summary("mae"), r2: summary("r2"), mape: summary("mape"), folds: folds[name] },
      test: regressionMetrics(testActual, expAll(testLog[name])),
      trainSeconds: final.seconds[name],
      residualQuantiles: q,
      intervalCoverage80: test.length ? covered / test.length : 0,
    };
    const t = evaluation[name].test;
    log(
      `Test ${MODEL_LABELS[name]}: R² ${t.r2.toFixed(4)} | MAE $${Math.round(t.mae)} | RMSE $${Math.round(t.rmse)} | MAPE ${(t.mape * 100).toFixed(1)}% | fit ${final.seconds[name].toFixed(2)}s`,
    );
  }

  const ranking = MODEL_NAMES.map((model) => ({ model, cvRmse: evaluation[model].cv.rmse.mean })).sort(
    (a, b) => a.cvRmse - b.cvRmse,
  );
  const bestModel = ranking[0].model;
  log(`Selected model: ${MODEL_LABELS[bestModel]} (lowest mean ${config.cvFolds}-fold CV RMSE)`);

  const featureImportance = permutationImportance(
    final.fitted,
    testVehicles,
    testActual,
    config.permutationRepeats,
    config.seed + 999,
  );
  const charts = buildCharts(data, config.referenceYear, testActual, testLog, bestModel, final.curve, createRng(config.seed + 7));
  const catalog = buildCatalog(data);
  const prices = data.map((r) => r.price);
  const years = data.map((r) => r.year);

  return {
    formatVersion: 1,
    version: `${new Date().toISOString().slice(0, 10).replace(/-/g, ".")}-${shortHash(JSON.stringify(ranking))}`,
    trainedAt: new Date().toISOString(),
    referenceYear: config.referenceYear,
    trainingSeconds: Number(((performance.now() - started) / 1000).toFixed(1)),
    config,
    dataset: {
      source,
      rawRows: report.rawRows,
      cleanRows: report.cleanRows,
      trainRows: train.length,
      testRows: test.length,
      yearRange: [Math.min(...years), Math.max(...years)],
      priceRange: [Math.min(...prices), Math.max(...prices)],
      medianPrice: Math.round(median(prices)),
      manufacturers: catalog.length,
      models: catalog.reduce((sum, m) => sum + m.models.length, 0),
    },
    cleaning: report,
    preprocessor: final.fitted.preprocessor,
    models: final.fitted.models,
    bestModel,
    selection: {
      metric: "cv_rmse",
      description: `Lowest mean RMSE (USD) across ${config.cvFolds}-fold cross-validation on the training split; the test split is only used for the final report.`,
      ranking,
    },
    evaluation,
    featureImportance,
    splitImportance: {
      random_forest: labelSplitImportance(final.splitImportance.random_forest),
      gradient_boosting: labelSplitImportance(final.splitImportance.gradient_boosting),
    },
    charts,
    catalog,
  };
}
