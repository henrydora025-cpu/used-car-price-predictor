import type { Metadata } from "next";
import {
  CategoryPriceChart,
  DepreciationChart,
  ErrorDistributionChart,
  FeatureImportanceChart,
  LearningCurveChart,
  MileageScatterChart,
  MissingValuesChart,
  ModelErrorChart,
  PredictedVsActualChart,
  PriceHistogramChart,
} from "@/components/charts";
import { Badge, Card, SectionHeading, Stat } from "@/components/ui";
import { formatNumber, formatPercent, formatUsd } from "@/lib/format";
import { getModelArtifact } from "@/lib/model-store";
import { MODEL_LABELS, MODEL_NAMES } from "@/ml/schema";

export const metadata: Metadata = { title: "Model insights" };

const HYPERPARAMETER_LABELS: Record<string, string> = {
  lambda: "L2 penalty (λ)",
  coefficients: "Coefficients",
  nEstimators: "Trees",
  maxDepth: "Max depth",
  minSamplesLeaf: "Min samples / leaf",
  maxFeatures: "Features per split",
  learningRate: "Learning rate",
  subsample: "Row subsample",
};

export default function InsightsPage() {
  const a = getModelArtifact();
  const best = a.bestModel;
  const bestEval = a.evaluation[best];
  const labels: Record<string, string> = Object.fromEntries(MODEL_NAMES.map((n) => [n, MODEL_LABELS[n]]));
  const removed = a.cleaning.rawRows - a.cleaning.cleanRows;

  const missing = Object.keys(a.cleaning.missingRaw)
    .map((column) => ({
      column,
      raw: a.cleaning.missingRaw[column] ?? 0,
      remaining: a.cleaning.missingAfterCleaning[column] ?? 0,
    }))
    .filter((d) => d.raw > 0 || d.remaining > 0);

  const errorData = MODEL_NAMES.map((n) => ({
    label: MODEL_LABELS[n],
    cvRmse: Math.round(a.evaluation[n].cv.rmse.mean),
    rmse: Math.round(a.evaluation[n].test.rmse),
    mae: Math.round(a.evaluation[n].test.mae),
  }));

  const sample = a.charts.predictedVsActual[best];
  const within10 = sample.filter((p) => Math.abs(p.predicted - p.actual) / p.actual <= 0.1).length / Math.max(1, sample.length);

  const hyperparameters: Record<string, Record<string, number>> = {
    linear_regression: { lambda: a.config.linear.lambda, coefficients: a.models.linear_regression.weights.length },
    random_forest: { ...a.config.forest },
    gradient_boosting: { ...a.config.boosting },
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <header className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">Model insights</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">From messy listings to a production model</h1>
        <p className="mt-3 text-slate-600">
          Every number on this page is produced by the training pipeline (<code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm">npm run train</code>) and
          shipped inside the model artifact, so the dashboard always matches the model that serves predictions.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone="indigo">Model v{a.version}</Badge>
          <Badge>Trained {new Date(a.trainedAt).toISOString().slice(0, 10)}</Badge>
          <Badge>Pipeline runtime {a.trainingSeconds}s</Badge>
          <Badge>Market snapshot {a.referenceYear}</Badge>
        </div>
      </header>

      <dl className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Stat label="Raw listings" value={formatNumber(a.cleaning.rawRows)} />
        <Stat label="Clean listings" value={formatNumber(a.cleaning.cleanRows)} hint={`−${formatNumber(removed)} rows (${formatPercent(removed / a.cleaning.rawRows)})`} />
        <Stat label="Selected model" value={MODEL_LABELS[best]} />
        <Stat label="Test R²" value={bestEval.test.r2.toFixed(3)} />
        <Stat label="Test MAE" value={formatUsd(bestEval.test.mae)} />
        <Stat label="Test MAPE" value={formatPercent(bestEval.test.mape)} />
      </dl>

      <section id="data" className="mt-16 scroll-mt-24">
        <SectionHeading
          eyebrow="1 · Data management"
          title="Cleaning pipeline"
          description="The raw export contains inconsistent labels, currency strings, impossible values, duplicate listings and price typos. Each step is logged with the rows it removed or values it fixed."
        />
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4 font-medium">Step</th>
                  <th className="py-2 pr-4 text-right font-medium">Rows in → out</th>
                  <th className="py-2 pr-4 text-right font-medium">Removed</th>
                  <th className="py-2 pr-4 text-right font-medium">Values fixed</th>
                  <th className="w-40 py-2 font-medium">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {a.cleaning.steps.map((step) => (
                  <tr key={step.key} className="border-b border-slate-100 align-top last:border-0">
                    <td className="py-3 pr-4">
                      <p className="font-medium text-slate-900">{step.title}</p>
                      <p className="mt-0.5 max-w-xl text-xs leading-relaxed text-slate-500">{step.description}</p>
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums text-slate-600">
                      {formatNumber(step.rowsBefore)} → {formatNumber(step.rowsAfter)}
                    </td>
                    <td className={`py-3 pr-4 text-right tabular-nums ${step.rowsRemoved > 0 ? "font-semibold text-rose-600" : "text-slate-400"}`}>
                      {step.rowsRemoved > 0 ? `−${formatNumber(step.rowsRemoved)}` : "—"}
                    </td>
                    <td className={`py-3 pr-4 text-right tabular-nums ${step.valuesChanged > 0 ? "font-semibold text-indigo-600" : "text-slate-400"}`}>
                      {step.valuesChanged > 0 ? formatNumber(step.valuesChanged) : "—"}
                    </td>
                    <td className="py-3">
                      <div className="mt-1.5 h-2 rounded-full bg-slate-100">
                        <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${(step.rowsAfter / a.cleaning.rawRows) * 100}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card title="Missing values" subtitle="Rows are kept; gaps are imputed inside the model pipeline with statistics learned on training folds only (mode per model, age-based mileage, median engine size per model & fuel).">
            <MissingValuesChart data={missing} />
          </Card>
          <Card title="Price distribution" subtitle={`Right-skewed (median ${formatUsd(a.dataset.medianPrice)}), which is why the models learn log(price).`}>
            <PriceHistogramChart data={a.charts.priceHistogram} />
          </Card>
          <Card title="Depreciation curve" subtitle="Median and mean listing price by vehicle age.">
            <DepreciationChart data={a.charts.priceByAge} />
          </Card>
          <Card title="Mileage vs price" subtitle="600 random listings, coloured by age (log price axis).">
            <MileageScatterChart data={a.charts.mileageVsPrice} />
          </Card>
          <Card title="Median price by manufacturer" className="lg:row-span-2">
            <CategoryPriceChart data={a.charts.priceByManufacturer} height={560} />
          </Card>
          <Card title="Median price by fuel type">
            <CategoryPriceChart data={a.charts.priceByFuel} height={190} color="#10b981" />
          </Card>
          <Card title="Median price by body type">
            <CategoryPriceChart data={a.charts.priceByBody} height={260} color="#f59e0b" />
          </Card>
        </div>
      </section>

      <section id="models" className="mt-16 scroll-mt-24">
        <SectionHeading
          eyebrow="2 · Machine learning"
          title="Three models, one winner"
          description={`Models are compared with ${a.config.cvFolds}-fold cross-validation on the training split (${formatNumber(a.dataset.trainRows)} vehicles). The selected model is then evaluated once on ${formatNumber(a.dataset.testRows)} held-out vehicles.`}
        />
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4 font-medium">Model</th>
                  <th className="py-2 pr-4 text-right font-medium">CV RMSE (mean ± sd)</th>
                  <th className="py-2 pr-4 text-right font-medium">CV R²</th>
                  <th className="py-2 pr-4 text-right font-medium">Test R²</th>
                  <th className="py-2 pr-4 text-right font-medium">Test MAE</th>
                  <th className="py-2 pr-4 text-right font-medium">Test RMSE</th>
                  <th className="py-2 pr-4 text-right font-medium">Test MAPE</th>
                  <th className="py-2 pr-4 text-right font-medium">80% range coverage</th>
                  <th className="py-2 text-right font-medium">Fit time</th>
                </tr>
              </thead>
              <tbody>
                {MODEL_NAMES.map((name) => {
                  const e = a.evaluation[name];
                  const selected = name === best;
                  return (
                    <tr key={name} className={`border-b border-slate-100 last:border-0 ${selected ? "bg-indigo-50/60" : ""}`}>
                      <td className="py-3 pr-4 font-medium text-slate-900">
                        {MODEL_LABELS[name]} {selected && <Badge tone="indigo">Selected</Badge>}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums">{formatUsd(e.cv.rmse.mean)} ± {formatUsd(e.cv.rmse.std)}</td>
                      <td className="py-3 pr-4 text-right tabular-nums">{e.cv.r2.mean.toFixed(3)}</td>
                      <td className="py-3 pr-4 text-right tabular-nums font-semibold">{e.test.r2.toFixed(3)}</td>
                      <td className="py-3 pr-4 text-right tabular-nums">{formatUsd(e.test.mae)}</td>
                      <td className="py-3 pr-4 text-right tabular-nums">{formatUsd(e.test.rmse)}</td>
                      <td className="py-3 pr-4 text-right tabular-nums">{formatPercent(e.test.mape)}</td>
                      <td className="py-3 pr-4 text-right tabular-nums">{formatPercent(e.intervalCoverage80)}</td>
                      <td className="py-3 text-right tabular-nums text-slate-500">{e.trainSeconds.toFixed(2)}s</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-slate-500">{a.selection.description}</p>
        </Card>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card title="Error comparison" subtitle="Lower is better. CV RMSE drives model selection; test metrics are the final, unbiased report.">
            <ModelErrorChart data={errorData} />
          </Card>
          <Card title="Predicted vs actual price" subtitle="Held-out test vehicles">
            <PredictedVsActualChart data={a.charts.predictedVsActual} labels={labels} best={best} />
          </Card>
          <Card
            title={`Error distribution — ${MODEL_LABELS[best]}`}
            subtitle={`Percentage error on the test set. ${formatPercent(within10, 0)} of sampled estimates are within ±10% of the real price.`}
          >
            <ErrorDistributionChart data={a.charts.errorDistribution} />
          </Card>
          <Card title="Permutation feature importance" subtitle="RMSE increase on the test set when one input is randomly shuffled (model-agnostic).">
            <FeatureImportanceChart data={a.featureImportance} labels={labels} best={best} />
          </Card>
          <Card title="Gradient boosting learning curve" subtitle="RMSE of log(price) as trees are added — the test curve flattening shows no overfitting at the chosen size.">
            <LearningCurveChart data={a.charts.learningCurve} />
          </Card>
          <Card title="Cross-validation folds" subtitle="RMSE (USD) per fold — stability matters as much as the mean.">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-3 text-left font-medium">Fold</th>
                    {MODEL_NAMES.map((n) => (
                      <th key={n} className="py-2 pr-3 text-right font-medium">{MODEL_LABELS[n]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {a.evaluation[best].cv.folds.map((_, fold) => (
                    <tr key={fold} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 pr-3 text-slate-500">#{fold + 1}</td>
                      {MODEL_NAMES.map((n) => (
                        <td key={n} className={`py-2 pr-3 text-right tabular-nums ${n === best ? "font-semibold text-indigo-700" : ""}`}>
                          {formatUsd(a.evaluation[n].cv.folds[fold].rmse)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {MODEL_NAMES.map((n) => (
                <div key={n} className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-700">{MODEL_LABELS[n]}</p>
                  <dl className="mt-2 space-y-1 text-xs">
                    {Object.entries(hyperparameters[n]).map(([key, value]) => (
                      <div key={key} className="flex justify-between gap-2">
                        <dt className="text-slate-500">{HYPERPARAMETER_LABELS[key] ?? key}</dt>
                        <dd className="font-medium tabular-nums text-slate-800">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      <section id="method" className="mt-16 scroll-mt-24">
        <SectionHeading eyebrow="3 · Methodology" title="Design decisions" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[
            ["Log-price target", "Prices are right-skewed and depreciation is multiplicative, so models learn log(price); predictions are exponentiated back and metrics are reported in dollars."],
            ["No data leakage", "Imputation statistics, scaling and category encodings are fitted inside every CV fold on training rows only — and the test split is touched exactly once."],
            ["Model-specific encodings", "One-hot encoding + standardised numerics for the linear model; age-adjusted target encoding (smoothed) for the tree ensembles."],
            ["Robust outlier removal", "Domain bounds catch placeholders ($1, $999,999); a modified z-score on log(price) inside peer groups (make, model, age band) catches ×10 / ÷10 typos."],
            ["Calibrated uncertainty", "The 80% price range uses quantiles of out-of-fold residuals; its hit-rate on the untouched test set validates the calibration."],
            ["From-scratch implementations", "Linear regression (Cholesky normal equations), histogram-based CART, random forest and gradient boosting are implemented in TypeScript; a scikit-learn reference lives in /python."],
          ].map(([title, text]) => (
            <div key={title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="font-semibold text-slate-900">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
