import Link from "next/link";
import { Predictor } from "@/components/predictor/predictor";
import { Stat } from "@/components/ui";
import { formatNumber, formatPercent, formatUsd } from "@/lib/format";
import { getModelArtifact, getModelSummary, getVehicleOptions } from "@/lib/model-store";

const STEPS = [
  {
    title: "1 · Data management",
    text: "12k raw marketplace listings are standardised, de-duplicated and validated; unusual prices are removed with a robust peer-group z-score.",
    href: "/insights#data",
  },
  {
    title: "2 · Machine learning",
    text: "Linear Regression, Random Forest and Gradient Boosting are compared with 5-fold cross-validation; the winner is evaluated once on a held-out test set.",
    href: "/insights#models",
  },
  {
    title: "3 · Prediction API",
    text: "A validated REST API (single & batch) serves the saved model artifact, returns calibrated price ranges and logs every request to PostgreSQL.",
    href: "/docs",
  },
  {
    title: "4 · Testing & deployment",
    text: "Unit + API tests, Dockerfile and CI pipeline — plus a Python reference implementation with pandas, scikit-learn, FastAPI and Streamlit.",
    href: "/docs#deployment",
  },
];

export default function HomePage() {
  const artifact = getModelArtifact();
  const summary = getModelSummary(artifact);
  const options = getVehicleOptions(artifact);
  const best = summary.models.find((m) => m.selected) ?? summary.models[0];

  return (
    <main>
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-indigo-600/30 blur-3xl" />
          <div className="absolute right-0 top-20 h-80 w-80 rounded-full bg-fuchsia-600/20 blur-3xl" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:48px_48px]" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 pb-36 pt-14 sm:px-6 sm:pt-20">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-indigo-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Model {summary.version} · {best.label}
            </span>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-6xl">
              What is your used car{" "}
              <span className="bg-linear-to-r from-indigo-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">really worth?</span>
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-slate-300">
              Instant market-price estimates from machine-learning models trained on{" "}
              {formatNumber(summary.dataset.cleanRows)} cleaned listings across {summary.dataset.manufacturers} manufacturers and{" "}
              {summary.dataset.models} models — with a calibrated price range and a 5-year value forecast.
            </p>
          </div>
          <dl className="mt-10 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat tone="dark" label="Test R²" value={best.test.r2.toFixed(3)} hint="held-out vehicles" />
            <Stat tone="dark" label="Mean abs. error" value={formatUsd(best.test.mae)} hint={`median ${formatUsd(best.test.medianAe)}`} />
            <Stat tone="dark" label="MAPE" value={formatPercent(best.test.mape)} hint="mean % error" />
            <Stat tone="dark" label="80% range hit-rate" value={formatPercent(best.interval_coverage_80)} hint="calibration on test set" />
          </dl>
        </div>
      </section>

      <section className="relative mx-auto -mt-24 max-w-7xl px-4 sm:px-6">
        <Predictor options={options} model={{ label: best.label, r2: best.test.r2, mape: best.test.mape }} />
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">How it works</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">An end-to-end ML system, not just a notebook</h2>
          </div>
          <Link href="/insights" className="text-sm font-semibold text-indigo-600 hover:text-indigo-500">
            Explore the model insights →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <Link
              key={step.title}
              href={step.href}
              className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
            >
              <h3 className="font-semibold text-slate-900 group-hover:text-indigo-700">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.text}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
