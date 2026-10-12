import { describe, expect, it } from "vitest";
import type { ModelArtifact } from "@/ml/artifact";
import { FAST_TRAINING_CONFIG } from "@/ml/config";
import { trainModels } from "@/ml/pipeline";
import { predictPrice } from "@/ml/predict";
import { MODEL_NAMES } from "@/ml/schema";
import { generateRawDataset } from "@/ml/synthetic";

describe("training pipeline (end-to-end)", () => {
  const raw = generateRawDataset({ rows: 4000, seed: 11, referenceYear: 2026 });
  const artifact = trainModels(raw, FAST_TRAINING_CONFIG);

  it("cleans the raw data and records every step", () => {
    expect(artifact.cleaning.rawRows).toBe(raw.length);
    expect(artifact.cleaning.cleanRows).toBeLessThan(raw.length);
    expect(artifact.cleaning.steps.map((s) => s.key)).toEqual([
      "standardize",
      "missing_target",
      "duplicates",
      "invalid_year",
      "impossible_values",
      "price_bounds",
      "price_outliers",
    ]);
    expect(artifact.dataset.trainRows + artifact.dataset.testRows).toBe(artifact.cleaning.cleanRows);
  });

  it("trains, evaluates and selects the best of three models", () => {
    expect(MODEL_NAMES).toContain(artifact.bestModel);
    const ranking = artifact.selection.ranking;
    expect(ranking[0].model).toBe(artifact.bestModel);
    expect(ranking[0].cvRmse).toBeLessThanOrEqual(ranking[ranking.length - 1].cvRmse);
    for (const name of MODEL_NAMES) {
      expect(artifact.evaluation[name].test.r2).toBeGreaterThan(0.6);
      expect(artifact.evaluation[name].cv.folds).toHaveLength(FAST_TRAINING_CONFIG.cvFolds);
    }
    // Boosting captures non-linear, brand-specific depreciation better than the linear baseline.
    expect(artifact.evaluation.gradient_boosting.cv.rmse.mean).toBeLessThan(artifact.evaluation.linear_regression.cv.rmse.mean);
  });

  it("produces a serialisable artifact that predicts identically after a JSON round-trip", () => {
    const restored = JSON.parse(JSON.stringify(artifact)) as ModelArtifact;
    const input = { manufacturer: "Honda", model: "Civic", year: 2019, mileage: 50000 };
    expect(predictPrice(restored, input)).toEqual(predictPrice(artifact, input));
  });
});
