/**
 * Inference service: validated input → canonical vehicle → imputation → 3 model predictions,
 * calibrated price range and a 5-year depreciation forecast.
 */
import type { ModelArtifact } from "./artifact";
import { predictLogAll, predictLogWith, type FittedPipeline } from "./ensemble";
import {
  cleanText,
  normalizeAccident,
  normalizeBody,
  normalizeCondition,
  normalizeDrivetrain,
  normalizeFuel,
  normalizeTransmission,
  resolveManufacturerAlias,
} from "./normalize";
import { imputeRecord, vehicleAge } from "./preprocess";
import { MODEL_LABELS, MODEL_NAMES, type CompleteVehicle, type ModelName, type VehicleRecord } from "./schema";

export interface PredictionInput {
  manufacturer: string;
  model: string;
  year: number;
  mileage?: number | null;
  fuel_type?: string | null;
  transmission?: string | null;
  body_type?: string | null;
  drivetrain?: string | null;
  engine_size?: number | null;
  condition?: string | null;
  owners?: number | null;
  accident_history?: boolean | string | null;
}

export interface ForecastPoint {
  year: number;
  vehicle_age: number;
  mileage: number;
  estimated_price: number;
}

export interface PredictionResult {
  estimated_price: number;
  currency: "USD";
  price_range: { low: number; high: number; confidence: number };
  model_used: ModelName;
  model_label: string;
  model_version: string;
  model_predictions: Record<ModelName, number>;
  vehicle: CompleteVehicle;
  imputed_fields: string[];
  warnings: string[];
  depreciation_forecast: ForecastPoint[];
}

const roundPrice = (value: number) => Math.max(0, Math.round(value / 50) * 50);

/** Case-insensitive match of make/model against the training catalogue (aliases resolved). */
export function resolveVehicleIdentity(artifact: ModelArtifact, manufacturerInput: string, modelInput: string) {
  const makeText = cleanText(manufacturerInput) ?? "";
  const alias = resolveManufacturerAlias(makeText);
  const wanted = (alias ?? makeText).toLowerCase();
  const make = artifact.catalog.find((m) => m.name.toLowerCase() === wanted);
  const modelText = cleanText(modelInput) ?? "";
  const model = make?.models.find((m) => m.name.toLowerCase() === modelText.toLowerCase());
  return {
    manufacturer: make?.name ?? alias ?? makeText,
    model: model?.name ?? modelText,
    knownManufacturer: Boolean(make),
    knownModel: Boolean(model),
  };
}

export function predictPrice(
  artifact: ModelArtifact,
  input: PredictionInput,
  options: { forecastYears?: number } = {},
): PredictionResult {
  const warnings: string[] = [];
  const identity = resolveVehicleIdentity(artifact, input.manufacturer, input.model);
  if (!identity.knownManufacturer) {
    warnings.push(
      `Manufacturer "${identity.manufacturer}" is not in the training data — the estimate relies on generic vehicle characteristics only.`,
    );
  } else if (!identity.knownModel) {
    warnings.push(`Model "${identity.model}" was not seen for ${identity.manufacturer}; manufacturer-level information is used instead.`);
  }

  const [minYear, maxYear] = artifact.dataset.yearRange;
  if (input.year < minYear) {
    warnings.push(`Model year ${input.year} is older than any vehicle in the training data (${minYear}); treat the estimate as an extrapolation.`);
  } else if (input.year > maxYear) {
    warnings.push(`Model year ${input.year} is newer than the training data (${maxYear}); the estimate assumes a ${maxYear} vehicle.`);
  }
  const mileage = input.mileage ?? null;
  if (mileage !== null && mileage > 300_000) {
    warnings.push("Very high mileage — few comparable listings exist, so the estimate is less certain.");
  }

  const record: VehicleRecord = {
    manufacturer: identity.manufacturer,
    model: identity.model,
    year: Math.round(input.year),
    mileage,
    fuel_type: normalizeFuel(input.fuel_type),
    transmission: normalizeTransmission(input.transmission),
    body_type: normalizeBody(input.body_type),
    drivetrain: normalizeDrivetrain(input.drivetrain),
    engine_size: input.engine_size ?? null,
    condition: normalizeCondition(input.condition),
    owners: input.owners ?? null,
    accident_history: normalizeAccident(input.accident_history),
  };
  if (record.fuel_type === "Electric" && record.engine_size !== null && record.engine_size > 0) {
    warnings.push("Engine size is ignored for electric vehicles.");
    record.engine_size = 0;
  }

  const fitted: FittedPipeline = { preprocessor: artifact.preprocessor, models: artifact.models };
  const { vehicle, imputed } = imputeRecord(fitted.preprocessor, record);
  const logs = predictLogAll(fitted, vehicle);
  const best = artifact.bestModel;
  const point = Math.exp(logs[best]);
  const q = artifact.evaluation[best].residualQuantiles;

  const model_predictions = {} as Record<ModelName, number>;
  for (const name of MODEL_NAMES) model_predictions[name] = roundPrice(Math.exp(logs[name]));

  // What will the car be worth in the coming years if it keeps its current usage pattern?
  const years = options.forecastYears ?? 5;
  const age = vehicleAge(artifact.referenceYear, vehicle.year);
  const annualMiles =
    age >= 1 ? Math.min(30_000, Math.max(4_000, vehicle.mileage / age)) : artifact.preprocessor.imputation.milesPerYear;
  const depreciation_forecast: ForecastPoint[] = [];
  let previous = point;
  for (let k = 0; k <= years; k++) {
    const future: CompleteVehicle = { ...vehicle, year: vehicle.year - k, mileage: Math.round(vehicle.mileage + annualMiles * k) };
    const value = k === 0 ? point : Math.min(previous, Math.exp(predictLogWith(fitted, best, future)));
    previous = value;
    depreciation_forecast.push({
      year: artifact.referenceYear + k,
      vehicle_age: age + k,
      mileage: future.mileage,
      estimated_price: roundPrice(value),
    });
  }

  return {
    estimated_price: roundPrice(point),
    currency: "USD",
    price_range: {
      low: roundPrice(point * Math.exp(q.q10)),
      high: roundPrice(point * Math.exp(q.q90)),
      confidence: 0.8,
    },
    model_used: best,
    model_label: MODEL_LABELS[best],
    model_version: artifact.version,
    model_predictions,
    vehicle: {
      ...vehicle,
      mileage: Math.round(vehicle.mileage),
      engine_size: Math.round(vehicle.engine_size * 10) / 10,
    },
    imputed_fields: imputed,
    warnings,
    depreciation_forecast,
  };
}
