"use client";

import { formatNumber, formatUsd, timeAgo } from "@/lib/format";
import type { RecentPredictions } from "@/lib/prediction-log";
import { MODEL_LABELS, type ModelName } from "@/ml/schema";

export function RecentPredictionsTable({ data, loading }: { data: RecentPredictions | null; loading: boolean }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Recent predictions</h3>
          <p className="mt-1 text-sm text-slate-500">Every request is logged to PostgreSQL for monitoring and future retraining.</p>
        </div>
        {data && data.total > 0 && (
          <div className="flex gap-4 text-sm">
            <span className="text-slate-500">Total <span className="font-semibold text-slate-900">{formatNumber(data.total)}</span></span>
            <span className="text-slate-500">Avg estimate <span className="font-semibold text-slate-900">{formatUsd(data.average_price)}</span></span>
          </div>
        )}
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-4 font-medium">When</th>
              <th className="py-2 pr-4 font-medium">Vehicle</th>
              <th className="py-2 pr-4 font-medium">Mileage</th>
              <th className="py-2 pr-4 font-medium">Fuel · Gearbox</th>
              <th className="py-2 pr-4 text-right font-medium">Estimate</th>
              <th className="py-2 pr-4 font-medium">Model</th>
              <th className="py-2 font-medium">Source</th>
            </tr>
          </thead>
          <tbody>
            {loading && !data && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-slate-400">Loading…</td>
              </tr>
            )}
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-slate-400">No predictions yet — be the first!</td>
              </tr>
            )}
            {data?.items.map((p) => (
              <tr key={p.id} className="border-b border-slate-100 last:border-0">
                <td className="py-2.5 pr-4 whitespace-nowrap text-slate-500">{timeAgo(p.created_at)}</td>
                <td className="py-2.5 pr-4 font-medium text-slate-900">{p.year} {p.manufacturer} {p.model}</td>
                <td className="py-2.5 pr-4 tabular-nums text-slate-600">{formatNumber(p.mileage)} mi</td>
                <td className="py-2.5 pr-4 text-slate-600">{p.fuel_type} · {p.transmission}</td>
                <td className="py-2.5 pr-4 text-right">
                  <span className="font-semibold tabular-nums text-slate-900">{formatUsd(p.estimated_price)}</span>
                  <span className="block text-xs tabular-nums text-slate-400">{formatUsd(p.price_low)} – {formatUsd(p.price_high)}</span>
                </td>
                <td className="py-2.5 pr-4 text-slate-600">{MODEL_LABELS[p.model_name as ModelName] ?? p.model_name}</td>
                <td className="py-2.5">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{p.source}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
