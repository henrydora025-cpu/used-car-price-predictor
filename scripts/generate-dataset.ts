/**
 * Generates the raw (dirty) used-car dataset: data/raw/used_cars.csv
 *
 *   npm run data:generate                # 12,000 listings + ~3% duplicates
 *   ROWS=50000 SEED=7 npm run data:generate
 */
import fs from "node:fs";
import path from "node:path";
import { REFERENCE_YEAR } from "../src/ml/config";
import { toCsv } from "../src/ml/csv";
import { RAW_COLUMNS } from "../src/ml/schema";
import { generateRawDataset } from "../src/ml/synthetic";

const rows = Number(process.env.ROWS ?? 12000);
const seed = Number(process.env.SEED ?? 2026);
const output = process.argv[2] ?? path.join("data", "raw", "used_cars.csv");

const raw = generateRawDataset({ rows, seed, referenceYear: REFERENCE_YEAR });
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, toCsv(raw, RAW_COLUMNS));
console.log(`Wrote ${raw.length.toLocaleString("en-US")} raw listings to ${output}`);
