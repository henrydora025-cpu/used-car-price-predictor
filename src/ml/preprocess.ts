/**
 * Feature pipeline: imputation + feature engineering + encodings.
 * All statistics are fitted on the training split only (no leakage) and serialised
 * inside the model artifact so inference applies exactly the same transformations.
 */
import {
  CONDITION_SCORE,
  type BodyType,
  type CompleteVehicle,
  type Condition,
  type Drivetrain,
  type FuelType,
  type LabeledVehicle,
  type Transmission,
  type VehicleRecord,
} from "./schema";
import type { DesignRow } from "./models/linear";

export const IMPUTED_CATEGORICALS = ["fuel_type", "transmission", "body_type", "drivetrain"] as const;
export type ImputedCategorical = (typeof IMPUTED_CATEGORICALS)[number];

/** Numeric features used by the linear model (standardised). */
export const LINEAR_NUMERIC_FEATURES = [
  "age",
  "age_squared",
  "log_mileage",
  "miles_per_year",
  "engine_size",
  "condition_score",
  "owners",
  "accident",
] as const;

/** Categorical features one-hot encoded for the linear model. */
export const ONE_HOT_FIELDS = ["manufacturer", "model", "fuel_type", "transmission", "body_type", "drivetrain"] as const;

/** Feature vector used by the tree ensembles (categoricals use age-adjusted target encoding). */
export const TREE_FEATURES = [
  "age",
  "mileage",
  "miles_per_year",
  "engine_size",
  "condition_score",
  "owners",
  "accident",
  "manufacturer_enc",
  "model_enc",
  "fuel_type_enc",
  "transmission_enc",
  "body_type_enc",
  "drivetrain_enc",
] as const;

export const TREE_FEATURE_LABELS: Record<(typeof TREE_FEATURES)[number], string> = {
  age: "Age",
  mileage: "Mileage",
  miles_per_year: "Miles per year",
  engine_size: "Engine size",
  condition_score: "Condition",
  owners: "Previous owners",
  accident: "Accident history",
  manufacturer_enc: "Manufacturer",
  model_enc: "Model",
  fuel_type_enc: "Fuel type",
  transmission_enc: "Transmission",
  body_type_enc: "Body type",
  drivetrain_enc: "Drivetrain",
};

export interface PreprocessorState {
  referenceYear: number;
  imputation: {
    modeByModel: Record<ImputedCategorical, Record<string, string>>;
    modeByManufacturer: Record<ImputedCategorical, Record<string, string>>;
    modeGlobal: Record<ImputedCategorical, string>;
    engineByModelFuel: Record<string, number>;
    engineByModel: Record<string, number>;
    engineGlobal: number;
    milesPerYear: number;
    newCarMileage: number;
    ownersByAge: Record<string, number>;
    ownersGlobal: number;
    conditionByAgeBand: Record<string, Condition>;
    conditionGlobal: Condition;
    accidentGlobal: boolean;
  };
  scaler: { mean: number[]; std: number[] };
  oneHot: { fields: string[]; levels: string[][]; offsets: number[]; size: number };
  encoding: {
    ageIntercept: number;
    ageSlope: number;
    smoothing: number;
    global: number;
    manufacturer: Record<string, number>;
    model: Record<string, number>;
    fuel_type: Record<string, number>;
    transmission: Record<string, number>;
    body_type: Record<string, number>;
    drivetrain: Record<string, number>;
  };
}

const FALLBACK_CATEGORY: Record<ImputedCategorical, string> = {
  fuel_type: "Gasoline",
  transmission: "Automatic",
  body_type: "Sedan",
  drivetrain: "FWD",
};

export const modelKey = (manufacturer: string, model: string) => `${manufacturer}|${model}`;

export function vehicleAge(referenceYear: number, year: number): number {
  return Math.min(40, Math.max(0, referenceYear - year));
}

const ageBand = (age: number) => String(Math.min(7, Math.floor(age / 3)));

function present<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function mode<T extends string>(values: T[]): T | null {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: T | null = null;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount || (count === bestCount && best !== null && value < best)) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

function medianOrNull(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function groupBy<T>(items: T[], key: (item: T) => string | null): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    if (k === null) continue;
    const list = groups.get(k);
    if (list) list.push(item);
    else groups.set(k, [item]);
  }
  return groups;
}

/** Fills every missing characteristic and reports which fields were imputed. */
export function imputeRecord(
  state: PreprocessorState,
  record: VehicleRecord,
): { vehicle: CompleteVehicle; imputed: string[] } {
  const imp = state.imputation;
  const imputed: string[] = [];
  const key = modelKey(record.manufacturer, record.model);
  const age = vehicleAge(state.referenceYear, record.year);

  const categorical = (field: ImputedCategorical): string => {
    const value = record[field];
    if (present(value)) return value;
    imputed.push(field);
    return imp.modeByModel[field][key] ?? imp.modeByManufacturer[field][record.manufacturer] ?? imp.modeGlobal[field];
  };

  const fuel_type = categorical("fuel_type") as FuelType;
  let transmission = categorical("transmission") as Transmission;
  if (fuel_type === "Electric" && !present(record.transmission)) transmission = "Automatic";
  const body_type = categorical("body_type") as BodyType;
  const drivetrain = categorical("drivetrain") as Drivetrain;

  let engine_size: number;
  if (fuel_type === "Electric") {
    if (!present(record.engine_size)) imputed.push("engine_size");
    engine_size = 0;
  } else if (present(record.engine_size) && record.engine_size > 0) {
    engine_size = record.engine_size;
  } else {
    imputed.push("engine_size");
    engine_size = imp.engineByModelFuel[`${key}|${fuel_type}`] ?? imp.engineByModel[key] ?? imp.engineGlobal;
  }

  let mileage: number;
  if (present(record.mileage)) mileage = record.mileage;
  else {
    imputed.push("mileage");
    mileage = Math.round(age === 0 ? imp.newCarMileage : imp.milesPerYear * age);
  }

  let owners: number;
  if (present(record.owners)) owners = record.owners;
  else {
    imputed.push("owners");
    owners = imp.ownersByAge[String(age)] ?? imp.ownersGlobal;
  }

  let condition: Condition;
  if (present(record.condition)) condition = record.condition;
  else {
    imputed.push("condition");
    condition = imp.conditionByAgeBand[ageBand(age)] ?? imp.conditionGlobal;
  }

  let accident_history: boolean;
  if (present(record.accident_history)) accident_history = record.accident_history;
  else {
    imputed.push("accident_history");
    accident_history = imp.accidentGlobal;
  }

  return {
    vehicle: {
      manufacturer: record.manufacturer,
      model: record.model,
      year: record.year,
      mileage,
      fuel_type,
      transmission,
      body_type,
      drivetrain,
      engine_size,
      condition,
      owners,
      accident_history,
    },
    imputed,
  };
}

/** Raw (unscaled) numeric features for the linear model. */
export function engineeredNumeric(state: PreprocessorState, v: CompleteVehicle): number[] {
  const age = vehicleAge(state.referenceYear, v.year);
  const mileage = Math.max(0, v.mileage);
  return [
    age,
    age * age,
    Math.log1p(mileage),
    mileage / Math.max(age, 1),
    v.engine_size,
    CONDITION_SCORE[v.condition],
    v.owners,
    v.accident_history ? 1 : 0,
  ];
}

function oneHotValue(v: CompleteVehicle, field: string): string {
  if (field === "model") return modelKey(v.manufacturer, v.model);
  return String(v[field as keyof CompleteVehicle]);
}

const lookupCache = new WeakMap<PreprocessorState, Map<string, number>[]>();
function oneHotLookup(state: PreprocessorState): Map<string, number>[] {
  let maps = lookupCache.get(state);
  if (!maps) {
    maps = state.oneHot.levels.map(
      (levels, block) => new Map(levels.map((level, i) => [level, state.oneHot.offsets[block] + i] as [string, number])),
    );
    lookupCache.set(state, maps);
  }
  return maps;
}

export const linearDesignSize = (state: PreprocessorState) => state.oneHot.size;

/** Sparse design row: standardised numerics (indices 1..d) + active one-hot indices. Index 0 is the intercept. */
export function linearDesignRow(state: PreprocessorState, v: CompleteVehicle): DesignRow {
  const raw = engineeredNumeric(state, v);
  const dense = raw.map((x, j) => (x - state.scaler.mean[j]) / state.scaler.std[j]);
  const hot: number[] = [];
  const maps = oneHotLookup(state);
  state.oneHot.fields.forEach((field, block) => {
    const index = maps[block].get(oneHotValue(v, field));
    if (index !== undefined) hot.push(index); // unseen category → baseline (all zeros)
  });
  return { dense, hot };
}

/** Numeric feature vector for the tree models (see TREE_FEATURES). */
export function treeFeatureRow(state: PreprocessorState, v: CompleteVehicle): number[] {
  const age = vehicleAge(state.referenceYear, v.year);
  const mileage = Math.max(0, v.mileage);
  const enc = state.encoding;
  const makeEnc = enc.manufacturer[v.manufacturer] ?? enc.global;
  const modelEnc = enc.model[modelKey(v.manufacturer, v.model)] ?? makeEnc;
  return [
    age,
    mileage,
    mileage / Math.max(age, 1),
    v.engine_size,
    CONDITION_SCORE[v.condition],
    v.owners,
    v.accident_history ? 1 : 0,
    makeEnc,
    modelEnc,
    enc.fuel_type[v.fuel_type] ?? enc.global,
    enc.transmission[v.transmission] ?? enc.global,
    enc.body_type[v.body_type] ?? enc.global,
    enc.drivetrain[v.drivetrain] ?? enc.global,
  ];
}

/** Learns imputation statistics, scaling parameters and encodings from the training split. */
export function fitPreprocessor(train: LabeledVehicle[], referenceYear: number): PreprocessorState {
  const byModel = groupBy(train, (r) => modelKey(r.manufacturer, r.model));
  const byMake = groupBy(train, (r) => r.manufacturer);

  const modeByModel = {} as Record<ImputedCategorical, Record<string, string>>;
  const modeByManufacturer = {} as Record<ImputedCategorical, Record<string, string>>;
  const modeGlobal = {} as Record<ImputedCategorical, string>;
  for (const field of IMPUTED_CATEGORICALS) {
    modeByModel[field] = {};
    modeByManufacturer[field] = {};
    for (const [key, rows] of byModel) {
      const m = mode(rows.map((r) => r[field] as string | null).filter(present));
      if (m) modeByModel[field][key] = m;
    }
    for (const [key, rows] of byMake) {
      const m = mode(rows.map((r) => r[field] as string | null).filter(present));
      if (m) modeByManufacturer[field][key] = m;
    }
    modeGlobal[field] = mode(train.map((r) => r[field] as string | null).filter(present)) ?? FALLBACK_CATEGORY[field];
  }

  const engineByModel: Record<string, number> = {};
  const engineByModelFuel: Record<string, number> = {};
  for (const [key, rows] of byModel) {
    const combustion = rows.filter((r) => present(r.engine_size) && r.engine_size > 0 && r.fuel_type !== "Electric");
    const med = medianOrNull(combustion.map((r) => r.engine_size as number));
    if (med !== null) engineByModel[key] = med;
    for (const [fuel, fuelRows] of groupBy(combustion, (r) => r.fuel_type)) {
      const m = medianOrNull(fuelRows.map((r) => r.engine_size as number));
      if (m !== null) engineByModelFuel[`${key}|${fuel}`] = m;
    }
  }
  const engineGlobal =
    medianOrNull(train.filter((r) => present(r.engine_size) && r.engine_size > 0).map((r) => r.engine_size as number)) ??
    2.0;

  const withMileage = train.filter((r) => present(r.mileage));
  const milesPerYear =
    medianOrNull(
      withMileage
        .filter((r) => vehicleAge(referenceYear, r.year) >= 1)
        .map((r) => (r.mileage as number) / vehicleAge(referenceYear, r.year)),
    ) ?? 12000;
  const newCarMileage =
    medianOrNull(withMileage.filter((r) => vehicleAge(referenceYear, r.year) === 0).map((r) => r.mileage as number)) ??
    3000;

  const withOwners = train.filter((r) => present(r.owners));
  const ownersByAge: Record<string, number> = {};
  for (const [age, rows] of groupBy(withOwners, (r) => String(vehicleAge(referenceYear, r.year)))) {
    ownersByAge[age] = Math.round(medianOrNull(rows.map((r) => r.owners as number)) ?? 1);
  }
  const ownersGlobal = Math.round(medianOrNull(withOwners.map((r) => r.owners as number)) ?? 1);

  const withCondition = train.filter((r) => present(r.condition));
  const conditionByAgeBand: Record<string, Condition> = {};
  for (const [band, rows] of groupBy(withCondition, (r) => ageBand(vehicleAge(referenceYear, r.year)))) {
    const m = mode(rows.map((r) => r.condition as Condition));
    if (m) conditionByAgeBand[band] = m;
  }
  const conditionGlobal = mode(withCondition.map((r) => r.condition as Condition)) ?? "Good";
  const accidents = train.filter((r) => present(r.accident_history));
  const accidentGlobal = accidents.filter((r) => r.accident_history).length > accidents.length / 2;

  const state: PreprocessorState = {
    referenceYear,
    imputation: {
      modeByModel,
      modeByManufacturer,
      modeGlobal,
      engineByModelFuel,
      engineByModel,
      engineGlobal,
      milesPerYear,
      newCarMileage,
      ownersByAge,
      ownersGlobal,
      conditionByAgeBand,
      conditionGlobal,
      accidentGlobal,
    },
    scaler: { mean: [], std: [] },
    oneHot: { fields: [...ONE_HOT_FIELDS], levels: [], offsets: [], size: 0 },
    encoding: {
      ageIntercept: 0,
      ageSlope: 0,
      smoothing: 20,
      global: 0,
      manufacturer: {},
      model: {},
      fuel_type: {},
      transmission: {},
      body_type: {},
      drivetrain: {},
    },
  };

  const complete = train.map((r) => imputeRecord(state, r).vehicle);

  // Standardisation parameters for the linear model.
  const numeric = complete.map((v) => engineeredNumeric(state, v));
  const d = LINEAR_NUMERIC_FEATURES.length;
  for (let j = 0; j < d; j++) {
    let sum = 0;
    for (const row of numeric) sum += row[j];
    const m = sum / numeric.length;
    let sq = 0;
    for (const row of numeric) sq += (row[j] - m) ** 2;
    const s = Math.sqrt(sq / numeric.length);
    state.scaler.mean.push(m);
    state.scaler.std.push(s > 1e-9 ? s : 1);
  }

  // One-hot vocabularies (index 0 = intercept, 1..d = numerics).
  let offset = 1 + d;
  for (const field of ONE_HOT_FIELDS) {
    const levels = [...new Set(complete.map((v) => oneHotValue(v, field)))].sort();
    state.oneHot.levels.push(levels);
    state.oneHot.offsets.push(offset);
    offset += levels.length;
  }
  state.oneHot.size = offset;

  // Age-adjusted target encoding: categories are encoded by their smoothed mean residual of
  // log(price) after removing the global age trend, so "Model Y" is not rated highly just
  // because every Model Y in the data is young.
  const logPrice = train.map((r) => Math.log(r.price));
  const ages = complete.map((v) => vehicleAge(referenceYear, v.year));
  const meanAge = ages.reduce((a, b) => a + b, 0) / ages.length;
  const meanLog = logPrice.reduce((a, b) => a + b, 0) / logPrice.length;
  let cov = 0;
  let varAge = 0;
  for (let i = 0; i < ages.length; i++) {
    cov += (ages[i] - meanAge) * (logPrice[i] - meanLog);
    varAge += (ages[i] - meanAge) ** 2;
  }
  const slope = varAge > 0 ? cov / varAge : 0;
  const intercept = meanLog - slope * meanAge;
  const residual = logPrice.map((y, i) => y - (intercept + slope * ages[i]));
  const smoothing = state.encoding.smoothing;

  const encode = (keyOf: (v: CompleteVehicle) => string, prior: (v: CompleteVehicle) => number) => {
    const sums = new Map<string, { sum: number; n: number; prior: number }>();
    complete.forEach((v, i) => {
      const k = keyOf(v);
      const entry = sums.get(k) ?? { sum: 0, n: 0, prior: prior(v) };
      entry.sum += residual[i];
      entry.n += 1;
      sums.set(k, entry);
    });
    const out: Record<string, number> = {};
    for (const [k, { sum, n, prior: p }] of sums) out[k] = (sum + smoothing * p) / (n + smoothing);
    return out;
  };

  state.encoding.ageIntercept = intercept;
  state.encoding.ageSlope = slope;
  state.encoding.manufacturer = encode((v) => v.manufacturer, () => 0);
  state.encoding.model = encode(
    (v) => modelKey(v.manufacturer, v.model),
    (v) => state.encoding.manufacturer[v.manufacturer] ?? 0,
  );
  state.encoding.fuel_type = encode((v) => v.fuel_type, () => 0);
  state.encoding.transmission = encode((v) => v.transmission, () => 0);
  state.encoding.body_type = encode((v) => v.body_type, () => 0);
  state.encoding.drivetrain = encode((v) => v.drivetrain, () => 0);
  return state;
}
