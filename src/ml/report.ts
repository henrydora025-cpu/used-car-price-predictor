/**
 * Human-readable training report (reports/training_report.md) and a compact metrics JSON.
 */
import type { ModelArtifact } from "./artifact";
import { MODEL_LABELS, MODEL_NAMES } from "./schema";

const usd = (value: number) => `$${Math.round(value).toLocaleString("en-US")}`;
const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

export function metricsSummary(artifact: ModelArtifact) {
  return {
    version: artifact.version,
    trained_at: artifact.trainedAt,
    best_model: artifact.bestModel,
    selection: artifact.selection.description,
    dataset: artifact.dataset,
    models: Object.fromEntries(
      MODEL_NAMES.map((name) => {
        const e = artifact.evaluation[name];
        return [
          name,
          {
            cv_rmse_mean: Math.round(e.cv.rmse.mean),
            cv_rmse_std: Math.round(e.cv.rmse.std),
            cv_r2_mean: Number(e.cv.r2.mean.toFixed(4)),
            test_r2: Number(e.test.r2.toFixed(4)),
            test_mae: Math.round(e.test.mae),
            test_rmse: Math.round(e.test.rmse),
            test_mape: Number(e.test.mape.toFixed(4)),
            test_median_ae: Math.round(e.test.medianAe),
            interval_coverage_80: Number(e.intervalCoverage80.toFixed(3)),
            train_seconds: Number(e.trainSeconds.toFixed(2)),
          },
        ];
      }),
    ),
    cleaning: artifact.cleaning.steps.map((s) => ({
      step: s.title,
      rows_before: s.rowsBefore,
      rows_after: s.rowsAfter,
      rows_removed: s.rowsRemoved,
      values_changed: s.valuesChanged,
    })),
  };
}

export function renderTrainingReport(artifact: ModelArtifact): string {
  const lines: string[] = [];
  const d = artifact.dataset;
  lines.push(`# Training report — model ${artifact.version}`, "");
  lines.push(`Trained ${artifact.trainedAt} in ${artifact.trainingSeconds}s on \`${d.source}\`.`, "");
  lines.push("## Dataset", "");
  lines.push(`| Raw rows | Clean rows | Train | Test | Manufacturers | Models | Years | Median price |`);
  lines.push(`|---:|---:|---:|---:|---:|---:|---|---:|`);
  lines.push(
    `| ${d.rawRows.toLocaleString("en-US")} | ${d.cleanRows.toLocaleString("en-US")} | ${d.trainRows.toLocaleString("en-US")} | ${d.testRows.toLocaleString("en-US")} | ${d.manufacturers} | ${d.models} | ${d.yearRange[0]}–${d.yearRange[1]} | ${usd(d.medianPrice)} |`,
    "",
  );
  lines.push("## Data cleaning", "");
  lines.push("| Step | Rows before | Rows after | Removed | Values fixed |", "|---|---:|---:|---:|---:|");
  for (const s of artifact.cleaning.steps) {
    lines.push(`| ${s.title} | ${s.rowsBefore} | ${s.rowsAfter} | ${s.rowsRemoved} | ${s.valuesChanged} |`);
  }
  lines.push("", "## Model comparison", "");
  lines.push(
    "| Model | CV RMSE (mean ± std) | CV R² | Test R² | Test MAE | Test RMSE | Test MAPE | 80% range coverage | Fit time |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
  );
  for (const name of MODEL_NAMES) {
    const e = artifact.evaluation[name];
    const label = name === artifact.bestModel ? `**${MODEL_LABELS[name]}** ✅` : MODEL_LABELS[name];
    lines.push(
      `| ${label} | ${usd(e.cv.rmse.mean)} ± ${usd(e.cv.rmse.std)} | ${e.cv.r2.mean.toFixed(3)} | ${e.test.r2.toFixed(3)} | ${usd(e.test.mae)} | ${usd(e.test.rmse)} | ${pct(e.test.mape)} | ${pct(e.intervalCoverage80)} | ${e.trainSeconds.toFixed(2)}s |`,
    );
  }
  lines.push("", `Selected: **${MODEL_LABELS[artifact.bestModel]}** — ${artifact.selection.description}`, "");
  lines.push(`## Permutation importance (${MODEL_LABELS[artifact.bestModel]})`, "");
  lines.push("| Feature | RMSE increase when shuffled | Share |", "|---|---:|---:|");
  for (const f of artifact.featureImportance[artifact.bestModel]) {
    lines.push(`| ${f.feature} | ${usd(f.importance)} | ${pct(f.share)} |`);
  }
  lines.push("");
  return lines.join("\n");
}
