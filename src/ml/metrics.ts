/**
 * Regression metrics and small statistics helpers.
 */
export interface RegressionMetrics {
  /** Coefficient of determination */
  r2: number;
  /** Mean absolute error (USD) */
  mae: number;
  /** Root mean squared error (USD) */
  rmse: number;
  /** Mean absolute percentage error (0.1 = 10%) */
  mape: number;
  /** Median absolute error (USD) */
  medianAe: number;
}

export function mean(values: ArrayLike<number>): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < values.length; i++) sum += values[i];
  return sum / values.length;
}

export function std(values: ArrayLike<number>): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  let sum = 0;
  for (let i = 0; i < values.length; i++) sum += (values[i] - m) ** 2;
  return Math.sqrt(sum / (values.length - 1));
}

/** Linear-interpolated quantile of an ascending-sorted array. */
export function quantile(sorted: ArrayLike<number>, q: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * Math.min(1, Math.max(0, q));
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function median(values: ArrayLike<number>): number {
  const sorted = Float64Array.from(values).sort();
  return quantile(sorted, 0.5);
}

export function rmse(actual: ArrayLike<number>, predicted: ArrayLike<number>): number {
  let sse = 0;
  for (let i = 0; i < actual.length; i++) sse += (actual[i] - predicted[i]) ** 2;
  return Math.sqrt(sse / Math.max(1, actual.length));
}

export function regressionMetrics(actual: ArrayLike<number>, predicted: ArrayLike<number>): RegressionMetrics {
  const n = actual.length;
  if (n === 0 || n !== predicted.length) throw new Error("actual and predicted must be non-empty and of equal length");
  const m = mean(actual);
  let sse = 0;
  let sst = 0;
  let sae = 0;
  let sape = 0;
  const absErrors = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const error = actual[i] - predicted[i];
    sse += error * error;
    sst += (actual[i] - m) ** 2;
    sae += Math.abs(error);
    sape += actual[i] !== 0 ? Math.abs(error / actual[i]) : 0;
    absErrors[i] = Math.abs(error);
  }
  return {
    r2: sst === 0 ? 0 : 1 - sse / sst,
    mae: sae / n,
    rmse: Math.sqrt(sse / n),
    mape: sape / n,
    medianAe: median(absErrors),
  };
}
