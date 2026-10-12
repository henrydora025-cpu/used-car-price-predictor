/**
 * Data cleaning pipeline: label standardisation, type parsing, duplicate removal,
 * validation of impossible values and detection of unusual prices.
 * Every step is recorded in a report that is shipped with the model artifact.
 */
import type { RawRow } from "./csv";
import {
  cleanText,
  normalizeAccident,
  normalizeBody,
  normalizeCondition,
  normalizeDrivetrain,
  normalizeFuel,
  normalizeTransmission,
  parseNumber,
  resolveManufacturerAlias,
} from "./normalize";
import type { BodyType, Condition, Drivetrain, FuelType, LabeledVehicle, Transmission } from "./schema";

export interface CleaningOptions {
  referenceYear: number;
  minYear?: number;
  minPrice?: number;
  maxPrice?: number;
  maxMileage?: number;
  /**
   * Modified z-score threshold for price outliers. The textbook value is 3.5 (Iglewicz & Hoaglin),
   * but legitimate variation inside a peer group (condition, accidents, mileage) is wide, while
   * data-entry typos are off by ~10×, so a conservative 5.0 removes typos without trimming real
   * cheap/expensive cars (validated: 3.5 flagged ~80 genuine listings).
   */
  outlierThreshold?: number;
  /** Minimum size of a peer group before its statistics are trusted. */
  minGroupSize?: number;
}

export interface CleaningStep {
  key: string;
  title: string;
  description: string;
  rowsBefore: number;
  rowsAfter: number;
  rowsRemoved: number;
  valuesChanged: number;
}

export interface CleaningReport {
  rawRows: number;
  cleanRows: number;
  columns: string[];
  steps: CleaningStep[];
  /** Missing or unparseable values per column in the raw file. */
  missingRaw: Record<string, number>;
  /** Missing values that remain after cleaning (imputed later inside the model pipeline). */
  missingAfterCleaning: Record<string, number>;
}

interface ParsedRow {
  listing_id: string | null;
  manufacturer: string | null;
  model: string | null;
  year: number | null;
  mileage: number | null;
  fuel_type: FuelType | null;
  transmission: Transmission | null;
  body_type: BodyType | null;
  drivetrain: Drivetrain | null;
  engine_size: number | null;
  condition: Condition | null;
  owners: number | null;
  accident_history: boolean | null;
  price: number | null;
}

export const CLEANED_COLUMNS = [
  "manufacturer",
  "model",
  "year",
  "mileage",
  "fuel_type",
  "transmission",
  "body_type",
  "drivetrain",
  "engine_size",
  "condition",
  "owners",
  "accident_history",
  "price",
] as const;

function vote(store: Map<string, Map<string, number>>, key: string, spelling: string, weight: number) {
  const votes = store.get(key) ?? new Map<string, number>();
  votes.set(spelling, (votes.get(spelling) ?? 0) + weight);
  store.set(key, votes);
}

function topVote(votes: Map<string, number>): string {
  let best = "";
  let bestCount = -1;
  for (const [spelling, count] of votes) {
    if (count > bestCount || (count === bestCount && spelling < best)) {
      best = spelling;
      bestCount = count;
    }
  }
  return best;
}

function medianOf(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const hasFormatting = (raw: string | undefined) => /[^0-9.\-]/.test((raw ?? "").trim());

export function cleanDataset(
  rows: RawRow[],
  options: CleaningOptions,
): { data: LabeledVehicle[]; report: CleaningReport } {
  const opts = {
    minYear: 1990,
    minPrice: 500,
    maxPrice: 500_000,
    maxMileage: 600_000,
    outlierThreshold: 5,
    minGroupSize: 8,
    ...options,
  };
  const steps: CleaningStep[] = [];
  const addStep = (key: string, title: string, description: string, before: number, after: number, changed = 0) =>
    steps.push({ key, title, description, rowsBefore: before, rowsAfter: after, rowsRemoved: before - after, valuesChanged: changed });

  // ── 1. Standardise labels & parse values ─────────────────────────────────────
  // Canonical spellings are learned from the data: the most frequent spelling of a
  // case-insensitive group wins (known aliases such as "Chevy" are resolved first).
  const makeVotes = new Map<string, Map<string, number>>();
  const makeKeys = rows.map((row) => {
    const text = cleanText(row.manufacturer);
    if (!text) return null;
    const alias = resolveManufacturerAlias(text);
    const spelling = alias ?? text;
    vote(makeVotes, spelling.toLowerCase(), spelling, alias ? 1_000_000 : 1);
    return spelling.toLowerCase();
  });
  const canonicalMake = new Map<string, string>();
  for (const [key, votes] of makeVotes) canonicalMake.set(key, topVote(votes));

  const modelVotes = new Map<string, Map<string, number>>();
  const modelKeys = rows.map((row, i) => {
    const makeKey = makeKeys[i];
    const text = cleanText(row.model);
    if (!makeKey || !text) return null;
    const key = `${canonicalMake.get(makeKey)}|${text.toLowerCase()}`;
    vote(modelVotes, key, text, 1);
    return key;
  });
  const canonicalModel = new Map<string, string>();
  for (const [key, votes] of modelVotes) canonicalModel.set(key, topVote(votes));

  const missingRaw: Record<string, number> = {};
  for (const column of CLEANED_COLUMNS) missingRaw[column] = 0;
  let changed = 0;
  const trackLabel = (raw: string | undefined, value: string | null) => {
    if (value !== null && (raw ?? "").trim() !== value) changed++;
  };
  const trackNumber = (raw: string | undefined, value: number | null) => {
    if (value !== null && hasFormatting(raw)) changed++;
  };

  const parsed: ParsedRow[] = rows.map((row, i) => {
    const makeKey = makeKeys[i];
    const modelKey = modelKeys[i];
    const out: ParsedRow = {
      listing_id: cleanText(row.listing_id),
      manufacturer: makeKey ? canonicalMake.get(makeKey) ?? null : null,
      model: modelKey ? canonicalModel.get(modelKey) ?? null : null,
      year: parseNumber(row.year),
      mileage: parseNumber(row.mileage),
      fuel_type: normalizeFuel(row.fuel_type),
      transmission: normalizeTransmission(row.transmission),
      body_type: normalizeBody(row.body_type),
      drivetrain: normalizeDrivetrain(row.drivetrain),
      engine_size: parseNumber(row.engine_size),
      condition: normalizeCondition(row.condition),
      owners: parseNumber(row.owners),
      accident_history: normalizeAccident(row.accident_history),
      price: parseNumber(row.price),
    };
    if (out.year !== null) out.year = Math.round(out.year);
    if (out.owners !== null) out.owners = Math.round(out.owners);

    trackLabel(row.manufacturer, out.manufacturer);
    trackLabel(row.model, out.model);
    trackLabel(row.fuel_type, out.fuel_type);
    trackLabel(row.transmission, out.transmission);
    trackLabel(row.body_type, out.body_type);
    trackLabel(row.drivetrain, out.drivetrain);
    trackLabel(row.condition, out.condition);
    trackLabel(row.accident_history, out.accident_history === null ? null : out.accident_history ? "Yes" : "No");
    trackNumber(row.mileage, out.mileage);
    trackNumber(row.engine_size, out.engine_size);
    trackNumber(row.price, out.price);

    for (const column of CLEANED_COLUMNS) if (out[column] === null) missingRaw[column]++;
    return out;
  });
  addStep(
    "standardize",
    "Standardize labels & parse values",
    "Trimmed whitespace, unified casing and synonyms ('Gas' → 'Gasoline', 'Chevy' → 'Chevrolet', '4x4' → '4WD') and parsed currency/unit strings ('$18,450', '45,000 mi', '2.0L') into numbers.",
    rows.length,
    parsed.length,
    changed,
  );

  // ── 2. Drop rows without target or identifiers ───────────────────────────────
  let current = parsed.filter((r) => r.price !== null && r.manufacturer !== null && r.model !== null);
  addStep(
    "missing_target",
    "Drop rows missing price or make/model",
    "A listing without a price cannot be used for supervised learning; make and model are required identifiers.",
    parsed.length,
    current.length,
  );

  // ── 3. Remove duplicates ─────────────────────────────────────────────────────
  const before3 = current.length;
  const seenIds = new Set<string>();
  const seenSignatures = new Set<string>();
  current = current.filter((r) => {
    const signature = JSON.stringify(CLEANED_COLUMNS.map((c) => r[c]));
    if ((r.listing_id && seenIds.has(r.listing_id)) || seenSignatures.has(signature)) return false;
    if (r.listing_id) seenIds.add(r.listing_id);
    seenSignatures.add(signature);
    return true;
  });
  addStep(
    "duplicates",
    "Remove duplicate listings",
    "Removed re-posted listings (same listing id) and rows that are identical after normalisation.",
    before3,
    current.length,
  );

  // ── 4. Invalid model years ───────────────────────────────────────────────────
  const before4 = current.length;
  current = current.filter((r) => r.year !== null && r.year >= opts.minYear && r.year <= opts.referenceYear + 1);
  addStep(
    "invalid_year",
    "Drop invalid model years",
    `Model year must be between ${opts.minYear} and ${opts.referenceYear + 1} (typos such as 1900 or 2099 are removed).`,
    before4,
    current.length,
  );

  // ── 5. Impossible values → missing ───────────────────────────────────────────
  let fixed = 0;
  for (const r of current) {
    if (r.mileage !== null && (r.mileage < 0 || r.mileage > opts.maxMileage)) {
      r.mileage = null;
      fixed++;
    }
    if (r.engine_size !== null && (r.engine_size < 0 || r.engine_size > 8.5)) {
      r.engine_size = null;
      fixed++;
    }
    if (r.fuel_type === "Electric" && r.engine_size !== null && r.engine_size > 0) {
      r.engine_size = 0;
      fixed++;
    }
    if (r.owners !== null && (r.owners < 1 || r.owners > 10)) {
      r.owners = null;
      fixed++;
    }
  }
  addStep(
    "impossible_values",
    "Nullify impossible values",
    `Negative or absurd mileage (> ${opts.maxMileage.toLocaleString("en-US")} mi), engine sizes outside 0–8.5 L and owner counts outside 1–10 are set to missing and imputed later.`,
    current.length,
    current.length,
    fixed,
  );

  // ── 6. Domain bounds on price ────────────────────────────────────────────────
  const before6 = current.length;
  current = current.filter((r) => (r.price as number) >= opts.minPrice && (r.price as number) <= opts.maxPrice);
  addStep(
    "price_bounds",
    "Remove implausible prices",
    `Prices below $${opts.minPrice} or above $${opts.maxPrice.toLocaleString("en-US")} are placeholders or typos (e.g. $1, $999,999).`,
    before6,
    current.length,
  );

  // ── 7. Statistical outliers within comparable vehicles ───────────────────────
  // Modified z-score on log(price) inside peer groups (same make/model, 3-year age band),
  // falling back to make-level groups. Catches "extra zero" or "missing zero" typos.
  const before7 = current.length;
  const ageBand = (year: number) => Math.floor(Math.max(0, opts.referenceYear - year) / 3);
  const groups = new Map<string, number[]>();
  const keysFor = (r: ParsedRow) => [
    `${r.manufacturer}|${r.model}|${ageBand(r.year as number)}`,
    `${r.manufacturer}|${ageBand(r.year as number)}`,
  ];
  for (const r of current) {
    const logPrice = Math.log(r.price as number);
    for (const key of keysFor(r)) {
      const list = groups.get(key) ?? [];
      list.push(logPrice);
      groups.set(key, list);
    }
  }
  const stats = new Map<string, { median: number; mad: number }>();
  for (const [key, values] of groups) {
    if (values.length < opts.minGroupSize) continue;
    const med = medianOf(values);
    stats.set(key, { median: med, mad: medianOf(values.map((v) => Math.abs(v - med))) });
  }
  current = current.filter((r) => {
    const group = keysFor(r)
      .map((key) => stats.get(key))
      .find((s) => s !== undefined);
    if (!group) return true;
    const z = (0.6745 * (Math.log(r.price as number) - group.median)) / Math.max(group.mad, 0.05);
    return Math.abs(z) <= opts.outlierThreshold;
  });
  addStep(
    "price_outliers",
    "Remove statistical price outliers",
    `Modified z-score of log(price) within comparable vehicles (same make & model, 3-year age band); |z| > ${opts.outlierThreshold} is flagged.`,
    before7,
    current.length,
  );

  const data: LabeledVehicle[] = current.map((r) => ({
    manufacturer: r.manufacturer as string,
    model: r.model as string,
    year: r.year as number,
    mileage: r.mileage,
    fuel_type: r.fuel_type,
    transmission: r.transmission,
    body_type: r.body_type,
    drivetrain: r.drivetrain,
    engine_size: r.engine_size,
    condition: r.condition,
    owners: r.owners,
    accident_history: r.accident_history,
    price: r.price as number,
  }));

  const missingAfterCleaning: Record<string, number> = {};
  for (const column of CLEANED_COLUMNS) missingAfterCleaning[column] = data.filter((r) => r[column] === null).length;

  return {
    data,
    report: {
      rawRows: rows.length,
      cleanRows: data.length,
      columns: rows.length > 0 ? Object.keys(rows[0]) : [],
      steps,
      missingRaw,
      missingAfterCleaning,
    },
  };
}
