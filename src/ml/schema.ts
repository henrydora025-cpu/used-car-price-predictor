/**
 * Canonical vehicle schema shared by the data pipeline, the models and the API.
 */
export const FUEL_TYPES = ["Gasoline", "Diesel", "Hybrid", "Electric"] as const;
export const TRANSMISSIONS = ["Automatic", "Manual"] as const;
export const BODY_TYPES = ["Sedan", "SUV", "Truck", "Hatchback", "Coupe", "Convertible", "Minivan", "Wagon"] as const;
export const DRIVETRAINS = ["FWD", "RWD", "AWD", "4WD"] as const;
export const CONDITIONS = ["Excellent", "Good", "Fair", "Poor"] as const;

export type FuelType = (typeof FUEL_TYPES)[number];
export type Transmission = (typeof TRANSMISSIONS)[number];
export type BodyType = (typeof BODY_TYPES)[number];
export type Drivetrain = (typeof DRIVETRAINS)[number];
export type Condition = (typeof CONDITIONS)[number];

/** Ordinal encoding of the vehicle condition. */
export const CONDITION_SCORE: Record<Condition, number> = { Excellent: 3, Good: 2, Fair: 1, Poor: 0 };

/** Columns of the raw CSV dataset (data/raw/used_cars.csv). */
export const RAW_COLUMNS = [
  "listing_id",
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

/**
 * A vehicle description as seen by the model. Optional characteristics can be `null`;
 * they are imputed by the feature pipeline with statistics learned on the training split.
 */
export interface VehicleRecord {
  manufacturer: string;
  model: string;
  year: number;
  mileage: number | null;
  fuel_type: FuelType | null;
  transmission: Transmission | null;
  body_type: BodyType | null;
  drivetrain: Drivetrain | null;
  engine_size: number | null;
  condition: Condition | null;
  owners: number | null;
  accident_history: boolean | null;
}

export interface LabeledVehicle extends VehicleRecord {
  price: number;
}

/** A vehicle with every characteristic filled in (after imputation). */
export interface CompleteVehicle {
  manufacturer: string;
  model: string;
  year: number;
  mileage: number;
  fuel_type: FuelType;
  transmission: Transmission;
  body_type: BodyType;
  drivetrain: Drivetrain;
  engine_size: number;
  condition: Condition;
  owners: number;
  accident_history: boolean;
}

export const MODEL_NAMES = ["linear_regression", "random_forest", "gradient_boosting"] as const;
export type ModelName = (typeof MODEL_NAMES)[number];

export const MODEL_LABELS: Record<ModelName, string> = {
  linear_regression: "Linear Regression",
  random_forest: "Random Forest",
  gradient_boosting: "Gradient Boosting",
};
