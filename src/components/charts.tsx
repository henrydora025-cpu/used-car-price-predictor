"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompactUsd, formatNumber, formatUsd } from "@/lib/format";

const AXIS = { fontSize: 12, fill: "#64748b" };
const GRID = "#e2e8f0";
export const MODEL_COLORS: Record<string, string> = {
  linear_regression: "#94a3b8",
  random_forest: "#0ea5e9",
  gradient_boosting: "#6366f1",
};
const usdTooltip = (value: unknown) => formatUsd(Number(value));
const compactTick = (value: unknown) => formatCompactUsd(Number(value));

function ModelTabs({ value, onChange, labels }: { value: string; onChange: (v: string) => void; labels: Record<string, string> }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
      {Object.entries(labels).map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            value === key ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function ForecastChart({ data }: { data: { year: number; estimated_price: number; mileage: number }[] }) {
  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="forecastFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="year" tick={AXIS} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={compactTick} tick={AXIS} tickLine={false} axisLine={false} width={52} domain={["auto", "auto"]} />
          <Tooltip formatter={usdTooltip} labelFormatter={(label) => `Year ${String(label)}`} />
          <Area type="monotone" dataKey="estimated_price" name="Estimated value" stroke="#6366f1" strokeWidth={2.5} fill="url(#forecastFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ModelErrorChart({ data }: { data: { label: string; cvRmse: number; rmse: number; mae: number }[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={compactTick} tick={AXIS} tickLine={false} axisLine={false} width={52} />
          <Tooltip formatter={usdTooltip} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="cvRmse" name="CV RMSE" fill="#c7d2fe" radius={[6, 6, 0, 0]} />
          <Bar dataKey="rmse" name="Test RMSE" fill="#6366f1" radius={[6, 6, 0, 0]} />
          <Bar dataKey="mae" name="Test MAE" fill="#10b981" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const LOG_TICKS = [2000, 5000, 10000, 20000, 50000, 100000];

export function PredictedVsActualChart({
  data,
  labels,
  best,
}: {
  data: Record<string, { actual: number; predicted: number }[]>;
  labels: Record<string, string>;
  best: string;
}) {
  const [model, setModel] = useState(best);
  const points = data[model] ?? [];
  const max = Math.max(150000, ...points.map((p) => Math.max(p.actual, p.predicted)));
  return (
    <div>
      <ModelTabs value={model} onChange={setModel} labels={labels} />
      <div className="mt-4 h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
            <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
            <XAxis type="number" dataKey="actual" name="Actual" scale="log" domain={[1500, max]} ticks={LOG_TICKS} tickFormatter={compactTick} tick={AXIS} allowDataOverflow />
            <YAxis type="number" dataKey="predicted" name="Predicted" scale="log" domain={[1500, max]} ticks={LOG_TICKS} tickFormatter={compactTick} tick={AXIS} width={52} allowDataOverflow />
            <Tooltip formatter={usdTooltip} cursor={{ strokeDasharray: "3 3" }} />
            <ReferenceLine segment={[{ x: 1500, y: 1500 }, { x: max, y: max }]} stroke="#f43f5e" strokeDasharray="5 5" />
            <Scatter data={points} fill={MODEL_COLORS[model] ?? "#6366f1"} fillOpacity={0.55} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-slate-500">Log–log scale, 400 random held-out vehicles. Points on the dashed line are perfect predictions.</p>
    </div>
  );
}

export function ErrorDistributionChart({ data }: { data: { label: string; center: number; count: number }[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ ...AXIS, fontSize: 10 }} tickLine={false} axisLine={false} interval={1} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={40} />
          <Tooltip formatter={(value) => [`${formatNumber(Number(value))} vehicles`, "Count"]} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((d) => (
              <Cell key={d.label} fill={Math.abs(d.center) <= 10 ? "#6366f1" : Math.abs(d.center) <= 20 ? "#a5b4fc" : "#e2e8f0"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FeatureImportanceChart({
  data,
  labels,
  best,
}: {
  data: Record<string, { feature: string; share: number; importance: number }[]>;
  labels: Record<string, string>;
  best: string;
}) {
  const [model, setModel] = useState(best);
  const rows = (data[model] ?? []).map((d) => ({ ...d, percent: Number((d.share * 100).toFixed(1)) }));
  return (
    <div>
      <ModelTabs value={model} onChange={setModel} labels={labels} />
      <div className="mt-4 h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid stroke={GRID} strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={AXIS} tickFormatter={(v) => `${String(v)}%`} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="feature" tick={AXIS} width={120} tickLine={false} axisLine={false} />
            <Tooltip formatter={(value) => [`${String(value)}%`, "Share of RMSE increase"]} />
            <Bar dataKey="percent" fill={MODEL_COLORS[model] ?? "#6366f1"} radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function LearningCurveChart({ data }: { data: { iteration: number; train: number; valid: number | null }[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="iteration" tick={AXIS} tickLine={false} axisLine={false} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={48} domain={[0, "auto"]} tickFormatter={(v) => Number(v).toFixed(2)} />
          <Tooltip formatter={(value) => Number(value).toFixed(4)} labelFormatter={(label) => `${String(label)} trees`} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="train" name="Train RMSE (log price)" stroke="#a5b4fc" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="valid" name="Test RMSE (log price)" stroke="#6366f1" strokeWidth={2.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PriceHistogramChart({ data }: { data: { label: string; count: number }[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ ...AXIS, fontSize: 10 }} tickLine={false} axisLine={false} interval={3} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={40} />
          <Tooltip formatter={(value) => [`${formatNumber(Number(value))} listings`, "Count"]} />
          <Bar dataKey="count" fill="#818cf8" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DepreciationChart({ data }: { data: { age: number; median: number; mean: number; count: number }[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="age" tick={AXIS} tickLine={false} axisLine={false} label={{ value: "Vehicle age (years)", position: "insideBottom", offset: -2, fontSize: 11, fill: "#94a3b8" }} height={36} />
          <YAxis tickFormatter={compactTick} tick={AXIS} tickLine={false} axisLine={false} width={52} />
          <Tooltip formatter={usdTooltip} labelFormatter={(label) => `${String(label)} years old`} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="median" name="Median price" stroke="#6366f1" strokeWidth={2.5} dot={false} />
          <Line type="monotone" dataKey="mean" name="Mean price" stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="5 4" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryPriceChart({ data, height = 320, color = "#6366f1" }: { data: { category: string; median: number; count: number }[]; height?: number; color?: string }) {
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tickFormatter={compactTick} tick={AXIS} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="category" tick={AXIS} width={110} tickLine={false} axisLine={false} interval={0} />
          <Tooltip formatter={usdTooltip} />
          <Bar dataKey="median" name="Median price" fill={color} radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const AGE_GROUPS = [
  { name: "0–3 years", min: 0, max: 3, color: "#6366f1" },
  { name: "4–8 years", min: 4, max: 8, color: "#10b981" },
  { name: "9–14 years", min: 9, max: 14, color: "#f59e0b" },
  { name: "15+ years", min: 15, max: 99, color: "#f43f5e" },
];

export function MileageScatterChart({ data }: { data: { mileage: number; price: number; age: number }[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
          <XAxis type="number" dataKey="mileage" name="Mileage" tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} tick={AXIS} />
          <YAxis type="number" dataKey="price" name="Price" scale="log" domain={[1500, "auto"]} ticks={LOG_TICKS} tickFormatter={compactTick} tick={AXIS} width={52} allowDataOverflow />
          <Tooltip formatter={(value, name) => (name === "Price" ? formatUsd(Number(value)) : `${formatNumber(Number(value))} mi`)} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {AGE_GROUPS.map((group) => (
            <Scatter
              key={group.name}
              name={group.name}
              data={data.filter((d) => d.age >= group.min && d.age <= group.max)}
              fill={group.color}
              fillOpacity={0.5}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MissingValuesChart({ data }: { data: { column: string; raw: number; remaining: number }[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="column" tick={{ ...AXIS, fontSize: 10 }} tickLine={false} axisLine={false} interval={0} angle={-25} textAnchor="end" height={56} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={40} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="raw" name="Missing / unparseable in raw file" fill="#fda4af" radius={[4, 4, 0, 0]} />
          <Bar dataKey="remaining" name="Left for model-time imputation" fill="#818cf8" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
