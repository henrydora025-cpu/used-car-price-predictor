/**
 * Trains, compares and saves the models.
 *
 *   npm run train                       # uses data/raw/used_cars.csv
 *   npm run train -- path/to/other.csv  # any CSV with the same columns
 *
 * Outputs:
 *   models/car_price_model.json   – serialised preprocessor + 3 models + metrics (loaded by the API)
 *   reports/metrics.json          – compact metrics for CI / README
 *   reports/training_report.md    – human-readable report
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_TRAINING_CONFIG } from "../src/ml/config";
import { parseCsv } from "../src/ml/csv";
import { trainModels } from "../src/ml/pipeline";
import { metricsSummary, renderTrainingReport } from "../src/ml/report";

function main() {
  const dataPath = process.argv[2] ?? path.join("data", "raw", "used_cars.csv");
  const modelPath = process.env.MODEL_PATH ?? path.join("models", "car_price_model.json");
  if (!fs.existsSync(dataPath)) {
    console.error(`Dataset not found: ${dataPath}. Run "npm run data:generate" first.`);
    process.exit(1);
  }

  const rows = parseCsv(fs.readFileSync(dataPath, "utf8"));
  console.log(`[train] Loaded ${rows.length.toLocaleString("en-US")} rows from ${dataPath}`);
  const artifact = trainModels(rows, DEFAULT_TRAINING_CONFIG, (message) => console.log(`[train] ${message}`), dataPath);

  fs.mkdirSync(path.dirname(modelPath), { recursive: true });
  fs.writeFileSync(modelPath, JSON.stringify(artifact));
  fs.mkdirSync("reports", { recursive: true });
  fs.writeFileSync(path.join("reports", "metrics.json"), JSON.stringify(metricsSummary(artifact), null, 2) + "\n");
  fs.writeFileSync(path.join("reports", "training_report.md"), renderTrainingReport(artifact));

  const sizeMb = fs.statSync(modelPath).size / 1024 / 1024;
  console.log(`[train] Saved ${modelPath} (${sizeMb.toFixed(2)} MB), version ${artifact.version}`);
  console.log(`[train] Finished in ${artifact.trainingSeconds}s`);
}

main();
