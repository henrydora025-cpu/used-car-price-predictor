import { describe, expect, it } from "vitest";
import { median, quantile, regressionMetrics } from "@/ml/metrics";

describe("regressionMetrics", () => {
  it("computes R², MAE, RMSE and MAPE", () => {
    const m = regressionMetrics([100, 200, 300, 400], [110, 190, 330, 370]);
    expect(m.mae).toBeCloseTo(20);
    expect(m.rmse).toBeCloseTo(Math.sqrt(500));
    expect(m.mape).toBeCloseTo((0.1 + 0.05 + 0.1 + 0.075) / 4);
    expect(m.r2).toBeCloseTo(1 - 2000 / 50000);
  });

  it("gives a perfect score for perfect predictions", () => {
    const m = regressionMetrics([5, 10, 15], [5, 10, 15]);
    expect(m.r2).toBe(1);
    expect(m.mae).toBe(0);
    expect(m.rmse).toBe(0);
  });

  it("rejects mismatched inputs", () => {
    expect(() => regressionMetrics([1, 2], [1])).toThrow();
    expect(() => regressionMetrics([], [])).toThrow();
  });
});

describe("statistics helpers", () => {
  it("interpolates quantiles and medians", () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantile([1, 2, 3, 4], 0)).toBe(1);
    expect(quantile([1, 2, 3, 4], 1)).toBe(4);
    expect(median([9, 1, 5])).toBe(5);
  });
});
