"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { VehicleOptions } from "@/lib/model-store";
import type { RecentPredictions } from "@/lib/prediction-log";
import type { PredictionResult } from "@/ml/predict";
import { RecentPredictionsTable } from "./recent-predictions";
import { ResultPanel } from "./result-panel";

type TriState = "" | "yes" | "no";

interface FormState {
  manufacturer: string;
  model: string;
  year: string;
  mileage: string;
  fuel_type: string;
  transmission: string;
  body_type: string;
  drivetrain: string;
  engine_size: string;
  condition: string;
  owners: string;
  accident_history: TriState;
}

type Preset = Partial<FormState> & { manufacturer: string; model: string };

const PRESETS: { label: string; values: Preset }[] = [
  { label: "2020 Toyota RAV4 Hybrid", values: { manufacturer: "Toyota", model: "RAV4", year: "2020", mileage: "45000", fuel_type: "Hybrid", transmission: "Automatic", drivetrain: "AWD", condition: "Good", owners: "1", accident_history: "no" } },
  { label: "2016 BMW 3 Series", values: { manufacturer: "BMW", model: "3 Series", year: "2016", mileage: "82000", fuel_type: "Gasoline", transmission: "Automatic", drivetrain: "RWD", engine_size: "2.0", condition: "Fair", owners: "2", accident_history: "yes" } },
  { label: "2022 Tesla Model 3", values: { manufacturer: "Tesla", model: "Model 3", year: "2022", mileage: "28000", fuel_type: "Electric", transmission: "Automatic", condition: "Excellent", owners: "1", accident_history: "no" } },
  { label: "2014 Ford F-150 4x4", values: { manufacturer: "Ford", model: "F-150", year: "2014", mileage: "128000", fuel_type: "Gasoline", transmission: "Automatic", drivetrain: "4WD", engine_size: "3.5", condition: "Fair", owners: "3", accident_history: "no" } },
  { label: "2012 Porsche 911 manual", values: { manufacturer: "Porsche", model: "911", year: "2012", mileage: "54000", fuel_type: "Gasoline", transmission: "Manual", body_type: "Coupe", drivetrain: "RWD", engine_size: "3.8", condition: "Excellent", owners: "2", accident_history: "no" } },
];

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-xs outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-400";

function stateForModel(options: VehicleOptions, manufacturer: string, modelName: string, keep?: Partial<FormState>): FormState {
  const make = options.manufacturers.find((m) => m.name === manufacturer) ?? options.manufacturers[0];
  const model = make.models.find((m) => m.name === modelName) ?? make.models[0];
  const [minYear, maxYear] = model.years;
  const keptYear = Number(keep?.year);
  const year =
    keep?.year && keptYear >= minYear && keptYear <= maxYear
      ? keep.year
      : String(Math.max(minYear, Math.min(maxYear, options.reference_year - 5)));
  const age = Math.max(0, options.reference_year - Number(year));
  return {
    manufacturer: make.name,
    model: model.name,
    year,
    mileage: keep?.mileage ?? String(Math.round((age === 0 ? 3000 : age * 12000) / 1000) * 1000),
    fuel_type: model.fuelTypes[0] ?? "Gasoline",
    transmission: model.transmissions[0] ?? "Automatic",
    body_type: "",
    drivetrain: "",
    engine_size: "",
    condition: keep?.condition ?? "Good",
    owners: keep?.owners ?? "",
    accident_history: keep?.accident_history ?? "",
  };
}

function applyPreset(options: VehicleOptions, preset: Preset): FormState {
  return { ...stateForModel(options, preset.manufacturer, preset.model, preset), ...preset };
}

function toPayload(form: FormState): Record<string, unknown> {
  return {
    manufacturer: form.manufacturer,
    model: form.model,
    year: Number(form.year),
    mileage: Number(form.mileage),
    fuel_type: form.fuel_type || null,
    transmission: form.transmission || null,
    body_type: form.body_type || null,
    drivetrain: form.drivetrain || null,
    engine_size: form.engine_size === "" ? null : Number(form.engine_size),
    condition: form.condition || null,
    owners: form.owners === "" ? null : Number(form.owners),
    accident_history: form.accident_history === "" ? null : form.accident_history === "yes",
  };
}

function describeError(data: unknown): string {
  if (data && typeof data === "object") {
    const d = data as { error?: string; details?: { field: string; message: string }[] };
    if (Array.isArray(d.details) && d.details.length > 0) return d.details.map((x) => `${x.field}: ${x.message}`).join(" · ");
    if (d.error) return d.error;
  }
  return "Prediction failed";
}

function Field({ label, hint, htmlFor, children }: { label: string; hint?: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="text-sm font-medium text-slate-700">{label}</label>
        {hint && <span className="text-xs text-slate-400">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Segmented({ value, onChange, options, available }: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  available?: string[];
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
      {options.map((option) => {
        const active = option.value === value;
        const unusual = available && option.value !== "" && !available.includes(option.value);
        return (
          <button
            key={option.value || "unknown"}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            title={unusual ? "Not seen for this model in the training data" : undefined}
            className={`flex-1 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-medium transition ${
              active ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:text-slate-900"
            } ${unusual && !active ? "opacity-50" : ""}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Predictor({ options, model }: { options: VehicleOptions; model: { label: string; r2: number; mape: number } }) {
  const [form, setForm] = useState<FormState>(() => applyPreset(options, PRESETS[0].values));
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentPredictions | null>(null);
  const [recentLoading, setRecentLoading] = useState(true);

  const make = useMemo(
    () => options.manufacturers.find((m) => m.name === form.manufacturer) ?? options.manufacturers[0],
    [options, form.manufacturer],
  );
  const modelInfo = useMemo(() => make.models.find((m) => m.name === form.model) ?? make.models[0], [make, form.model]);
  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = Math.min(options.reference_year, modelInfo.years[1]); y >= modelInfo.years[0]; y--) list.push(y);
    return list;
  }, [options.reference_year, modelInfo]);

  const refreshRecent = useCallback(async () => {
    try {
      const response = await fetch("/api/predictions?limit=8", { cache: "no-store" });
      if (response.ok) setRecent((await response.json()) as RecentPredictions);
    } catch {
      // monitoring panel is best-effort
    } finally {
      setRecentLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshRecent();
  }, [refreshRecent]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));
  const isElectric = form.fuel_type === "Electric";

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    setLoading(true);
    setError(null);
    const body = toPayload(form);
    try {
      const response = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-client": "web" },
        body: JSON.stringify(body),
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        setError(describeError(data));
        return;
      }
      setResult(data as PredictionResult);
      setPayload(body);
      void refreshRecent();
    } catch {
      setError("Network error — the prediction API could not be reached.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <form onSubmit={submit} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5 sm:p-8 lg:col-span-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">Vehicle details</h2>
            <p className="mt-1 text-sm text-slate-500">The six core inputs are required — everything else is optional and imputed if unknown.</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="self-center text-xs font-medium text-slate-400">Try:</span>
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setForm(applyPreset(options, preset.values))}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <Field label="Manufacturer" htmlFor="manufacturer">
            <select
              id="manufacturer"
              className={inputClass}
              value={form.manufacturer}
              onChange={(e) => {
                const next = options.manufacturers.find((m) => m.name === e.target.value);
                if (next) setForm((prev) => stateForModel(options, next.name, next.models[0].name, prev));
              }}
            >
              {options.manufacturers.map((m) => (
                <option key={m.name} value={m.name}>{m.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Model" htmlFor="model" hint={`${formatCount(modelInfo.count)} listings in training data`}>
            <select
              id="model"
              className={inputClass}
              value={form.model}
              onChange={(e) => setForm((prev) => stateForModel(options, prev.manufacturer, e.target.value, prev))}
            >
              {make.models.map((m) => (
                <option key={m.name} value={m.name}>{m.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Model year" htmlFor="year">
            <select id="year" className={inputClass} value={form.year} onChange={(e) => update("year", e.target.value)}>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </Field>
          <Field label="Mileage" htmlFor="mileage" hint="miles">
            <input
              id="mileage"
              type="number"
              min={0}
              max={1000000}
              step={500}
              required
              className={inputClass}
              value={form.mileage}
              onChange={(e) => update("mileage", e.target.value)}
            />
            <input
              type="range"
              min={0}
              max={300000}
              step={1000}
              aria-label="Mileage slider"
              className="mt-3 w-full accent-indigo-600"
              value={Math.min(300000, Number(form.mileage) || 0)}
              onChange={(e) => update("mileage", e.target.value)}
            />
          </Field>
          <Field label="Fuel type">
            <Segmented
              value={form.fuel_type}
              onChange={(v) => setForm((prev) => ({ ...prev, fuel_type: v, ...(v === "Electric" ? { transmission: "Automatic", engine_size: "" } : {}) }))}
              options={options.fuel_types.map((f) => ({ value: f, label: f }))}
              available={modelInfo.fuelTypes}
            />
          </Field>
          <Field label="Transmission">
            <Segmented
              value={form.transmission}
              onChange={(v) => update("transmission", v)}
              options={options.transmissions.map((t) => ({ value: t, label: t }))}
              available={isElectric ? ["Automatic"] : undefined}
            />
          </Field>
        </div>

        <details open className="group mt-6 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
          <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-slate-800">
            <span>
              Other characteristics <span className="ml-1 font-normal text-slate-500">— optional, improves accuracy</span>
            </span>
            <span className="text-slate-400 transition group-open:rotate-180">▾</span>
          </summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Body type" htmlFor="body_type">
              <select id="body_type" className={inputClass} value={form.body_type} onChange={(e) => update("body_type", e.target.value)}>
                <option value="">Auto ({modelInfo.bodyTypes[0] ?? "most common"})</option>
                {options.body_types.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </Field>
            <Field label="Drivetrain" htmlFor="drivetrain">
              <select id="drivetrain" className={inputClass} value={form.drivetrain} onChange={(e) => update("drivetrain", e.target.value)}>
                <option value="">Auto ({modelInfo.drivetrains[0] ?? "most common"})</option>
                {options.drivetrains.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </Field>
            <Field label="Engine size" htmlFor="engine_size" hint="litres">
              <input
                id="engine_size"
                type="number"
                min={0}
                max={10}
                step={0.1}
                disabled={isElectric}
                className={inputClass}
                placeholder={isElectric ? "Not applicable (electric)" : modelInfo.engineSizes.length ? `Auto · e.g. ${modelInfo.engineSizes.slice(0, 4).join(" / ")}` : "Auto"}
                value={isElectric ? "" : form.engine_size}
                onChange={(e) => update("engine_size", e.target.value)}
              />
            </Field>
            <Field label="Previous owners" htmlFor="owners">
              <select id="owners" className={inputClass} value={form.owners} onChange={(e) => update("owners", e.target.value)}>
                <option value="">Not sure</option>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>{n === 6 ? "6+" : n}</option>
                ))}
              </select>
            </Field>
            <Field label="Condition">
              <Segmented
                value={form.condition}
                onChange={(v) => update("condition", v)}
                options={[{ value: "", label: "Not sure" }, ...options.conditions.map((c) => ({ value: c, label: c }))]}
              />
            </Field>
            <Field label="Accident history">
              <Segmented
                value={form.accident_history}
                onChange={(v) => update("accident_history", v as TriState)}
                options={[
                  { value: "", label: "Not sure" },
                  { value: "no", label: "No accidents" },
                  { value: "yes", label: "Reported" },
                ]}
              />
            </Field>
          </div>
        </details>

        <button
          type="submit"
          disabled={loading}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-200 disabled:cursor-wait disabled:opacity-70"
        >
          {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
          {loading ? "Estimating…" : "Estimate price"}
        </button>
      </form>

      <div className="lg:col-span-5">
        <div className="lg:sticky lg:top-20">
          <ResultPanel result={result} payload={payload} loading={loading} error={error} model={model} />
        </div>
      </div>

      <div className="lg:col-span-12">
        <RecentPredictionsTable data={recent} loading={recentLoading} />
      </div>
    </div>
  );
}

function formatCount(n: number) {
  return new Intl.NumberFormat("en-US").format(n);
}
