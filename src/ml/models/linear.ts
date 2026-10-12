/**
 * Linear regression solved with the normal equations (XᵀX + λI)w = Xᵀy via Cholesky.
 * Rows are sparse (dense numerics + one-hot indices), so XᵀX is accumulated in O(nnz²) per row.
 * The intercept (index 0) is never penalised.
 */
export interface DesignRow {
  /** Values for weight indices 1..dense.length */
  dense: ArrayLike<number>;
  /** Absolute weight indices of active one-hot features (value 1) */
  hot: ArrayLike<number>;
}

export interface LinearModel {
  type: "linear_regression";
  weights: number[];
  lambda: number;
}

export function choleskySolve(A: Float64Array, b: Float64Array, n: number): Float64Array {
  const L = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = A[i * n + j];
      for (let k = 0; k < j; k++) sum -= L[i * n + k] * L[j * n + k];
      if (i === j) L[i * n + i] = Math.sqrt(Math.max(sum, 1e-12));
      else L[i * n + j] = sum / L[j * n + j];
    }
  }
  const z = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let sum = b[i];
    for (let k = 0; k < i; k++) sum -= L[i * n + k] * z[k];
    z[i] = sum / L[i * n + i];
  }
  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let sum = z[i];
    for (let k = i + 1; k < n; k++) sum -= L[k * n + i] * x[k];
    x[i] = sum / L[i * n + i];
  }
  return x;
}

export function fitLinear(rows: DesignRow[], y: ArrayLike<number>, size: number, lambda: number): LinearModel {
  const A = new Float64Array(size * size);
  const b = new Float64Array(size);
  const idx: number[] = [];
  const val: number[] = [];
  rows.forEach((row, r) => {
    idx.length = 0;
    val.length = 0;
    idx.push(0);
    val.push(1);
    for (let j = 0; j < row.dense.length; j++) {
      idx.push(1 + j);
      val.push(row.dense[j]);
    }
    for (let j = 0; j < row.hot.length; j++) {
      idx.push(row.hot[j]);
      val.push(1);
    }
    const target = y[r];
    for (let a = 0; a < idx.length; a++) {
      const offset = idx[a] * size;
      b[idx[a]] += val[a] * target;
      for (let c = 0; c < idx.length; c++) A[offset + idx[c]] += val[a] * val[c];
    }
  });
  for (let j = 1; j < size; j++) A[j * size + j] += lambda;
  const weights = choleskySolve(A, b, size);
  return { type: "linear_regression", weights: Array.from(weights, (w) => Number(w.toPrecision(10))), lambda };
}

export function predictLinear(model: LinearModel, row: DesignRow): number {
  const w = model.weights;
  let sum = w[0];
  for (let j = 0; j < row.dense.length; j++) sum += w[1 + j] * row.dense[j];
  for (let j = 0; j < row.hot.length; j++) sum += w[row.hot[j]];
  return sum;
}
