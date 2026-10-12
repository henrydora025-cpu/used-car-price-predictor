/**
 * Gradient boosting regressor (squared loss) with shrinkage, row subsampling,
 * column subsampling and L2-regularised leaves.
 */
import { rmse } from "../metrics";
import { createRng } from "../random";
import {
  compactTree,
  growTree,
  normalizeImportance,
  predictTree,
  predictTreeColumns,
  type Tree,
  type TreeData,
} from "./tree";

export interface BoostingParams {
  nEstimators: number;
  learningRate: number;
  maxDepth: number;
  minSamplesLeaf: number;
  subsample: number;
  maxFeatures: number;
  lambda: number;
  seed: number;
}

export interface BoostingModel {
  type: "gradient_boosting";
  base: number;
  learningRate: number;
  /** Leaf values are already multiplied by the learning rate. */
  trees: Tree[];
}

export interface CurvePoint {
  iteration: number;
  train: number;
  valid: number | null;
}

export function fitBoosting(
  data: TreeData,
  y: Float64Array,
  params: BoostingParams,
  valid?: { columns: Float64Array[]; y: Float64Array },
): { model: BoostingModel; importance: number[]; curve: CurvePoint[] } {
  const rng = createRng(params.seed);
  const n = data.n;
  let base = 0;
  for (let i = 0; i < n; i++) base += y[i];
  base /= n;

  const pred = new Float64Array(n).fill(base);
  const residual = new Float64Array(n);
  const order = new Uint32Array(n);
  for (let i = 0; i < n; i++) order[i] = i;
  const sampleSize = Math.max(1, Math.min(n, Math.floor(params.subsample * n)));
  const validPred = valid ? new Float64Array(valid.y.length).fill(base) : null;
  const importance = new Float64Array(data.m);
  const trees: Tree[] = [];
  const curve: CurvePoint[] = [];

  for (let it = 0; it < params.nEstimators; it++) {
    for (let i = 0; i < n; i++) residual[i] = y[i] - pred[i];
    if (sampleSize < n) {
      for (let i = 0; i < sampleSize; i++) {
        const j = i + Math.floor(rng() * (n - i));
        const tmp = order[i];
        order[i] = order[j];
        order[j] = tmp;
      }
    }
    const grown = growTree(
      data,
      residual,
      order.subarray(0, sampleSize),
      {
        maxDepth: params.maxDepth,
        minSamplesLeaf: params.minSamplesLeaf,
        maxFeatures: params.maxFeatures,
        lambda: params.lambda,
      },
      rng,
      importance,
    );
    for (let j = 0; j < grown.f.length; j++) if (grown.f[j] < 0) grown.t[j] *= params.learningRate;
    const tree = compactTree(grown);
    trees.push(tree);
    for (let i = 0; i < n; i++) pred[i] += predictTreeColumns(tree, data.columns, i);
    if (valid && validPred) {
      for (let i = 0; i < validPred.length; i++) validPred[i] += predictTreeColumns(tree, valid.columns, i);
    }
    if ((it + 1) % 10 === 0 || it === params.nEstimators - 1) {
      curve.push({
        iteration: it + 1,
        train: rmse(y, pred),
        valid: valid && validPred ? rmse(valid.y, validPred) : null,
      });
    }
  }

  return {
    model: { type: "gradient_boosting", base, learningRate: params.learningRate, trees },
    importance: normalizeImportance(importance),
    curve,
  };
}

export function predictBoosting(model: BoostingModel, x: ArrayLike<number>): number {
  let sum = model.base;
  for (const tree of model.trees) sum += predictTree(tree, x);
  return sum;
}
