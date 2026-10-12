/**
 * Histogram-based regression tree (the core of LightGBM / sklearn's HistGradientBoosting),
 * shared by the random forest and the gradient boosting implementations.
 *
 * Features are pre-binned into ≤ 255 quantile bins, so finding the best split of a node costs
 * O(samples × features + bins × features) instead of sorting at every node.
 * Trees are stored in pre-order: the left child of node i is i + 1, the right child is r[i];
 * leaves have f[i] = -1 and their value in t[i].
 */
import type { Rng } from "../random";

export interface Tree {
  f: number[];
  t: number[];
  r: number[];
}

export interface TreeData {
  n: number;
  m: number;
  columns: Float64Array[];
  binned: Uint8Array[];
  edges: Float64Array[];
}

export interface TreeParams {
  maxDepth: number;
  minSamplesLeaf: number;
  /** Fraction of features considered at each split */
  maxFeatures: number;
  /** L2 regularisation of leaf values (0 → plain mean) */
  lambda: number;
  minGain?: number;
}

/** Split thresholds: midpoints between distinct values, quantile-spaced when there are many. */
export function computeEdges(values: ArrayLike<number>, maxBins: number): Float64Array {
  const sorted = Float64Array.from(values).sort();
  const unique: number[] = [];
  const counts: number[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0 || sorted[i] !== sorted[i - 1]) {
      unique.push(sorted[i]);
      counts.push(1);
    } else counts[counts.length - 1]++;
  }
  if (unique.length <= 1) return new Float64Array(0);
  if (unique.length <= maxBins) {
    const edges = new Float64Array(unique.length - 1);
    for (let i = 0; i < unique.length - 1; i++) edges[i] = (unique[i] + unique[i + 1]) / 2;
    return edges;
  }
  const step = sorted.length / maxBins;
  const edges: number[] = [];
  let target = step;
  let cumulative = 0;
  for (let u = 0; u < unique.length - 1 && edges.length < maxBins - 1; u++) {
    cumulative += counts[u];
    if (cumulative >= target) {
      edges.push((unique[u] + unique[u + 1]) / 2);
      while (target <= cumulative) target += step;
    }
  }
  return Float64Array.from(edges);
}

/** Smallest bin b with x <= edges[b] (or edges.length when x is above every edge). */
export function binValue(edges: Float64Array, x: number): number {
  let lo = 0;
  let hi = edges.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (x <= edges[mid]) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

export function makeTreeData(columns: Float64Array[], maxBins = 255): TreeData {
  const bins = Math.min(255, Math.max(2, maxBins));
  const edges = columns.map((col) => computeEdges(col, bins));
  const binned = columns.map((col, j) => {
    const out = new Uint8Array(col.length);
    for (let i = 0; i < col.length; i++) out[i] = binValue(edges[j], col[i]);
    return out;
  });
  return { n: columns[0]?.length ?? 0, m: columns.length, columns, binned, edges };
}

/**
 * Grows one tree on `target` using the samples in `sampleIdx` (duplicates allowed → bootstrap).
 * Leaf value = sum(target) / (count + lambda). Split gain is the reduction in squared error.
 */
export function growTree(
  data: TreeData,
  target: Float64Array,
  sampleIdx: Uint32Array,
  params: TreeParams,
  rng: Rng,
  importance: Float64Array,
): Tree {
  const idx = Uint32Array.from(sampleIdx);
  const f: number[] = [];
  const t: number[] = [];
  const r: number[] = [];
  const maxBins = data.edges.reduce((m, e) => Math.max(m, e.length + 1), 2);
  const histSum = new Float64Array(maxBins);
  const histCount = new Float64Array(maxBins);
  const featurePool = Array.from({ length: data.m }, (_, i) => i);
  const featuresPerSplit = Math.max(1, Math.min(data.m, Math.round(params.maxFeatures * data.m)));
  const minGain = params.minGain ?? 1e-9;
  const lambda = params.lambda;
  const minLeaf = Math.max(1, params.minSamplesLeaf);

  const build = (start: number, end: number, depth: number): number => {
    const node = f.length;
    f.push(-1);
    t.push(0);
    r.push(0);
    const count = end - start;
    let sum = 0;
    for (let q = start; q < end; q++) sum += target[idx[q]];
    const leafValue = sum / (count + lambda);
    if (depth >= params.maxDepth || count < 2 * minLeaf) {
      t[node] = leafValue;
      return node;
    }

    if (featuresPerSplit < data.m) {
      for (let i = 0; i < featuresPerSplit; i++) {
        const j = i + Math.floor(rng() * (data.m - i));
        const tmp = featurePool[i];
        featurePool[i] = featurePool[j];
        featurePool[j] = tmp;
      }
    }

    const parentScore = (sum * sum) / (count + lambda);
    let bestGain = minGain;
    let bestFeature = -1;
    let bestBin = -1;
    for (let c = 0; c < featuresPerSplit; c++) {
      const feature = featurePool[c];
      const nBins = data.edges[feature].length + 1;
      if (nBins < 2) continue;
      histSum.fill(0, 0, nBins);
      histCount.fill(0, 0, nBins);
      const bins = data.binned[feature];
      for (let q = start; q < end; q++) {
        const i = idx[q];
        const b = bins[i];
        histSum[b] += target[i];
        histCount[b] += 1;
      }
      let leftSum = 0;
      let leftCount = 0;
      for (let b = 0; b < nBins - 1; b++) {
        leftSum += histSum[b];
        leftCount += histCount[b];
        if (leftCount < minLeaf) continue;
        const rightCount = count - leftCount;
        if (rightCount < minLeaf) break;
        const rightSum = sum - leftSum;
        const gain =
          (leftSum * leftSum) / (leftCount + lambda) + (rightSum * rightSum) / (rightCount + lambda) - parentScore;
        if (gain > bestGain) {
          bestGain = gain;
          bestFeature = feature;
          bestBin = b;
        }
      }
    }

    if (bestFeature < 0) {
      t[node] = leafValue;
      return node;
    }

    const bins = data.binned[bestFeature];
    let lo = start;
    let hi = end - 1;
    while (lo <= hi) {
      if (bins[idx[lo]] <= bestBin) lo++;
      else {
        const tmp = idx[lo];
        idx[lo] = idx[hi];
        idx[hi] = tmp;
        hi--;
      }
    }
    importance[bestFeature] += bestGain;
    f[node] = bestFeature;
    t[node] = data.edges[bestFeature][bestBin];
    build(start, lo, depth + 1);
    r[node] = build(lo, end, depth + 1);
    return node;
  };

  build(0, idx.length, 0);
  return { f, t, r };
}

export function predictTree(tree: Tree, x: ArrayLike<number>): number {
  let i = 0;
  for (;;) {
    const feature = tree.f[i];
    if (feature < 0) return tree.t[i];
    i = x[feature] <= tree.t[i] ? i + 1 : tree.r[i];
  }
}

export function predictTreeColumns(tree: Tree, columns: Float64Array[], row: number): number {
  let i = 0;
  for (;;) {
    const feature = tree.f[i];
    if (feature < 0) return tree.t[i];
    i = columns[feature][row] <= tree.t[i] ? i + 1 : tree.r[i];
  }
}

/** Rounds numbers to keep the serialised artifact small (thresholds keep 10 significant digits). */
export function compactTree(tree: Tree): Tree {
  return {
    f: tree.f,
    r: tree.r,
    t: tree.t.map((v, i) => Number(v.toPrecision(tree.f[i] < 0 ? 7 : 10))),
  };
}

export function normalizeImportance(values: Float64Array): number[] {
  const total = values.reduce((a, b) => a + b, 0);
  return Array.from(values, (v) => (total > 0 ? v / total : 0));
}
