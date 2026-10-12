import { describe, expect, it } from "vitest";
import { regressionMetrics } from "@/ml/metrics";
import { fitBoosting, predictBoosting } from "@/ml/models/boosting";
import { fitForest, predictForest } from "@/ml/models/forest";
import { fitLinear, predictLinear, type DesignRow } from "@/ml/models/linear";
import { binValue, computeEdges, makeTreeData } from "@/ml/models/tree";
import { createRng } from "@/ml/random";

function nonLinearData(n: number, seed: number) {
  const rng = createRng(seed);
  const x1 = new Float64Array(n);
  const x2 = new Float64Array(n);
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    x1[i] = rng() * 10;
    x2[i] = rng() * 10;
    y[i] = (x1[i] > 5 ? 10 : 0) + 3 * Math.sin(x2[i]) + (x1[i] > 5 && x2[i] > 5 ? 4 : 0) + (rng() - 0.5) * 0.2;
  }
  return { x1, x2, y };
}

describe("linear regression (normal equations)", () => {
  it("recovers known coefficients", () => {
    const rng = createRng(1);
    const rows: DesignRow[] = [];
    const y: number[] = [];
    for (let i = 0; i < 500; i++) {
      const a = rng() * 10;
      const b = rng() * 5;
      rows.push({ dense: [a, b], hot: [] });
      y.push(3 + 2 * a - 0.5 * b + (rng() - 0.5) * 0.01);
    }
    const model = fitLinear(rows, y, 3, 1e-6);
    expect(model.weights[0]).toBeCloseTo(3, 1);
    expect(model.weights[1]).toBeCloseTo(2, 2);
    expect(model.weights[2]).toBeCloseTo(-0.5, 2);
  });

  it("learns one-hot category effects", () => {
    const effects = [0, 5, -3];
    const rows: DesignRow[] = [];
    const y: number[] = [];
    for (let i = 0; i < 300; i++) {
      const group = i % 3;
      rows.push({ dense: [], hot: [1 + group] });
      y.push(10 + effects[group]);
    }
    const model = fitLinear(rows, y, 4, 1e-3);
    effects.forEach((effect, group) => {
      expect(predictLinear(model, { dense: [], hot: [1 + group] })).toBeCloseTo(10 + effect, 1);
    });
  });
});

describe("histogram binning", () => {
  it("is consistent with raw-value thresholds", () => {
    const rng = createRng(5);
    const values = Float64Array.from({ length: 2000 }, () => Math.round(rng() * 500) / 10);
    const edges = computeEdges(values, 32);
    expect(edges.length).toBeLessThanOrEqual(31);
    for (const x of values) {
      const bin = binValue(edges, x);
      for (let b = 0; b < edges.length; b++) expect(bin <= b).toBe(x <= edges[b]);
    }
  });
});

describe("tree ensembles", () => {
  const train = nonLinearData(2000, 1);
  const test = nonLinearData(500, 2);
  const data = makeTreeData([train.x1, train.x2], 64);
  const testRows = Array.from({ length: 500 }, (_, i) => [test.x1[i], test.x2[i]]);

  it("random forest learns a non-linear function", () => {
    const { model, importance } = fitForest(data, train.y, { nEstimators: 30, maxDepth: 10, minSamplesLeaf: 3, maxFeatures: 1, seed: 7 });
    const pred = testRows.map((x) => predictForest(model, x));
    expect(regressionMetrics(test.y, pred).r2).toBeGreaterThan(0.95);
    expect(importance[0] + importance[1]).toBeCloseTo(1);
  });

  it("gradient boosting fits better as trees are added", () => {
    const { model, curve } = fitBoosting(data, train.y, {
      nEstimators: 150,
      learningRate: 0.1,
      maxDepth: 4,
      minSamplesLeaf: 5,
      subsample: 0.8,
      maxFeatures: 1,
      lambda: 1,
      seed: 3,
    });
    const pred = testRows.map((x) => predictBoosting(model, x));
    expect(regressionMetrics(test.y, pred).r2).toBeGreaterThan(0.97);
    expect(curve[curve.length - 1].train).toBeLessThan(curve[0].train);
  });

  it("is deterministic for a fixed seed", () => {
    const params = { nEstimators: 5, maxDepth: 6, minSamplesLeaf: 3, maxFeatures: 0.5, seed: 11 };
    const a = fitForest(data, train.y, params).model;
    const b = fitForest(data, train.y, params).model;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
