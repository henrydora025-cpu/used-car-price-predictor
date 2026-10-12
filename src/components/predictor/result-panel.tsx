"use client";

import { ForecastChart, MODEL_COLORS } from "@/components/charts";
import { FIELD_LABELS, formatNumber, formatPercent, formatUsd } from "@/lib/format";
import type { PredictionResult } from "@/ml/predict";
import { MODEL_LABELS, MODEL_NAMES } from "@/ml/schema";

interface Props {
  result: PredictionResult | null;
  payload: Record<string, unknown> | null;
  loading: boolean;
  error: string | null;
  model: { label: string; r2: number; mape: number };
}

function Placeholder({ loading, error, model }: Pick<Props, "loading" | "error" | "model">) {
  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700" role="alert">
          <p className="font-semibold">Could not estimate the price</p>
          <p className="mt-1">{error}</p>
        </div>
      )}
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 p-6 text-white shadow-xl">
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-indigo-500/30 blur-3xl" />
        <p className="text-sm text-slate-300">Estimated market value</p>
        {loading ? (
          <div className="mt-3 h-12 w-48 animate-pulse rounded-xl bg-white/10" />
        ) : (
          <p className="mt-2 text-4xl font-semibold tracking-tight text-white/40">$ —</p>
        )}
        <ul className="mt-6 space-y-3 text-sm text-slate-300">
          <li className="flex gap-3"><span className="text-indigo-300">◆</span>Point estimate from the best of 3 models ({model.label}, test R² {model.r2.toFixed(3)})</li>
          <li className="flex gap-3"><span className="text-indigo-300">◆</span>80% price range calibrated on out-of-fold errors</li>
          <li className="flex gap-3"><span className="text-indigo-300">◆</span>5-year value forecast at your current yearly mileage</li>
        </ul>
      </div>
    </div>
  );
}

export function ResultPanel({ result, payload, loading, error, model }: Props) {
  if (!result) return <Placeholder loading={loading} error={error} model={model} />;

  const { estimated_price: price, price_range: range, vehicle } = result;
  const lo = range.low * 0.85;
  const hi = range.high * 1.1;
  const position = (value: number) => `${Math.min(100, Math.max(0, ((value - lo) / (hi - lo)) * 100))}%`;
  const maxModel = Math.max(...MODEL_NAMES.map((n) => result.model_predictions[n]));
  const forecast = result.depreciation_forecast;
  const inThree = forecast[Math.min(3, forecast.length - 1)];
  const loss = price > 0 ? 1 - inThree.estimated_price / price : 0;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const curl = payload
    ? `curl -X POST ${origin}/api/predict \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(payload)}'`
    : "";

  return (
    <div className={`space-y-4 transition-opacity ${loading ? "opacity-60" : ""}`} aria-live="polite">
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700" role="alert">{error}</div>
      )}
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 p-6 text-white shadow-xl">
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-indigo-500/30 blur-3xl" />
        <div className="absolute -bottom-24 -left-10 h-48 w-48 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="relative">
          <p className="text-sm text-slate-300">Estimated market value</p>
          <p className="mt-1 text-5xl font-semibold tracking-tight">{formatUsd(price)}</p>
          <p className="mt-2 text-sm text-slate-300">
            80% range <span className="font-medium text-white">{formatUsd(range.low)} – {formatUsd(range.high)}</span>
          </p>
          <div className="relative mt-4 h-2 rounded-full bg-white/10">
            <div className="absolute h-2 rounded-full bg-linear-to-r from-indigo-400 to-fuchsia-400" style={{ left: position(range.low), right: `calc(100% - ${position(range.high)})` }} />
            <div className="absolute -top-1 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-slate-900 bg-white" style={{ left: position(price) }} />
          </div>
          <div className="mt-5 flex flex-wrap gap-1.5 text-xs">
            {[
              `${vehicle.year} ${vehicle.manufacturer} ${vehicle.model}`,
              `${formatNumber(vehicle.mileage)} mi`,
              vehicle.fuel_type,
              vehicle.transmission,
              vehicle.drivetrain,
              vehicle.condition,
            ].map((chip) => (
              <span key={chip} className="rounded-full bg-white/10 px-2.5 py-1 text-slate-200">{chip}</span>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-400">
            Served by <span className="text-slate-200">{result.model_label}</span> · model v{result.model_version}
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Model comparison</h3>
        <p className="mt-0.5 text-xs text-slate-500">Each trained model&apos;s estimate for this exact vehicle</p>
        <div className="mt-4 space-y-3">
          {MODEL_NAMES.map((name) => {
            const value = result.model_predictions[name];
            const selected = name === result.model_used;
            return (
              <div key={name}>
                <div className="flex items-center justify-between text-sm">
                  <span className={selected ? "font-semibold text-slate-900" : "text-slate-600"}>
                    {MODEL_LABELS[name]}
                    {selected && <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">selected</span>}
                  </span>
                  <span className={`tabular-nums ${selected ? "font-semibold text-slate-900" : "text-slate-600"}`}>{formatUsd(value)}</span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full" style={{ width: `${(value / maxModel) * 100}%`, backgroundColor: MODEL_COLORS[name] }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Value forecast</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              At ~{formatNumber((forecast[1]?.mileage ?? vehicle.mileage) - vehicle.mileage)} mi/year
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold tabular-nums text-slate-900">{formatUsd(inThree.estimated_price)}</p>
            <p className="text-xs text-rose-600">−{formatPercent(loss, 0)} in {inThree.year - forecast[0].year} years</p>
          </div>
        </div>
        <div className="mt-3">
          <ForecastChart data={forecast} />
        </div>
      </div>

      {(result.imputed_fields.length > 0 || result.warnings.length > 0) && (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm shadow-sm">
          {result.imputed_fields.length > 0 && (
            <div>
              <p className="font-medium text-slate-900">Filled in automatically</p>
              <p className="mt-0.5 text-xs text-slate-500">Imputed from training statistics for this model and age</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {result.imputed_fields.map((field) => (
                  <span key={field} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                    {FIELD_LABELS[field] ?? field}:{" "}
                    <span className="font-medium">
                      {String(
                        field === "accident_history"
                          ? vehicle.accident_history
                            ? "Yes"
                            : "No"
                          : field === "engine_size"
                            ? `${vehicle.engine_size} L`
                            : field === "mileage"
                              ? `${formatNumber(vehicle.mileage)} mi`
                              : vehicle[field as keyof typeof vehicle],
                      )}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}
          {result.warnings.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {result.warnings.map((warning) => (
                <li key={warning} className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">⚠ {warning}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {curl && (
        <details className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900">
            <span className="mr-1 inline-block transition group-open:rotate-90">›</span> Reproduce with the REST API
          </summary>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950 p-3 text-[11.5px] leading-relaxed text-slate-100"><code>{curl}</code></pre>
        </details>
      )}
    </div>
  );
}
