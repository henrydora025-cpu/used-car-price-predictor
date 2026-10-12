/**
 * Random forest regressor: bagging (bootstrap samples) + random feature subsets per split.
 */
import { createRng } from "../random";
import { compactTree, growTree, normalizeImportance, predictTree, type Tree, type TreeData } from "./tree";

export interface ForestParams {
  nEstimators: number;
  maxDepth: number;
  minSamplesLeaf: number;
  maxFeatures: number;
  seed: number;
}

export interface ForestModel {
  type: "random_forest";
  base: number;
  trees: Tree[];
}

export function fitForest(data: TreeData, y: Float64Array, params: ForestParams): { model: ForestModel; importance: number[] } {
  const rng = createRng(params.seed);
  const n = data.n;
  let base = 0;
  for (let i = 0; i < n; i++) base += y[i];
  base /= n;
  // Centering the target keeps the split-gain arithmetic numerically precise.
  const centered = new Float64Array(n);
  for (let i = 0; i < n; i++) centered[i] = y[i] - base;

  const importance = new Float64Array(data.m);
  const sample = new Uint32Array(n);
  const trees: Tree[] = [];
  for (let k = 0; k < params.nEstimators; k++) {
    for (let i = 0; i < n; i++) sample[i] = Math.floor(rng() * n);
    const tree = growTree(
      data,
      centered,
      sample,
      { maxDepth: params.maxDepth, minSamplesLeaf: params.minSamplesLeaf, maxFeatures: params.maxFeatures, lambda: 0 },
      rng,
      importance,
    );
    trees.push(compactTree(tree));
  }
  return { model: { type: "random_forest", base, trees }, importance: normalizeImportance(importance) };
}

export function predictForest(model: ForestModel, x: ArrayLike<number>): number {
  let sum = 0;
  for (const tree of model.trees) sum += predictTree(tree, x);
  return model.base + sum / model.trees.length;
}
