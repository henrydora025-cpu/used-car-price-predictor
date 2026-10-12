/**
 * Label normalisation shared by the cleaning pipeline (training) and the API (inference),
 * so "gas", "Petrol" and "GASOLINE" all map to the same canonical category.
 */
import type { BodyType, Condition, Drivetrain, FuelType, Transmission } from "./schema";

const NULL_TOKENS = new Set(["", "na", "n/a", "nan", "null", "unknown", "-", "--", "?"]);

/** Trims/collapses whitespace and maps placeholder tokens ("N/A", "null", ...) to null. */
export function cleanText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/\s+/g, " ").trim();
  return NULL_TOKENS.has(text.toLowerCase()) ? null : text;
}

const MANUFACTURER_ALIASES: Record<string, string> = {
  chevy: "Chevrolet",
  chevrolet: "Chevrolet",
  vw: "Volkswagen",
  volkswagen: "Volkswagen",
  mercedes: "Mercedes-Benz",
  "mercedes benz": "Mercedes-Benz",
  "mercedes-benz": "Mercedes-Benz",
  benz: "Mercedes-Benz",
  bmw: "BMW",
  gmc: "GMC",
  ram: "Ram",
  "dodge ram": "Ram",
};

/** Returns the canonical manufacturer for well-known aliases ("Chevy" → "Chevrolet"), else null. */
export function resolveManufacturerAlias(value: string): string | null {
  const key = value.toLowerCase().replace(/\s+/g, " ").trim();
  return Object.prototype.hasOwnProperty.call(MANUFACTURER_ALIASES, key) ? MANUFACTURER_ALIASES[key] : null;
}

const FUEL: Record<string, FuelType> = {
  gasoline: "Gasoline",
  gas: "Gasoline",
  petrol: "Gasoline",
  unleaded: "Gasoline",
  flex: "Gasoline",
  "flex fuel": "Gasoline",
  diesel: "Diesel",
  tdi: "Diesel",
  hybrid: "Hybrid",
  hev: "Hybrid",
  phev: "Hybrid",
  "plug-in hybrid": "Hybrid",
  electric: "Electric",
  ev: "Electric",
  bev: "Electric",
  "battery electric": "Electric",
};

const TRANSMISSION: Record<string, Transmission> = {
  automatic: "Automatic",
  auto: "Automatic",
  "a/t": "Automatic",
  at: "Automatic",
  cvt: "Automatic",
  dct: "Automatic",
  "dual-clutch": "Automatic",
  manual: "Manual",
  "m/t": "Manual",
  mt: "Manual",
  stick: "Manual",
  "stick shift": "Manual",
  standard: "Manual",
};

const BODY: Record<string, BodyType> = {
  sedan: "Sedan",
  saloon: "Sedan",
  suv: "SUV",
  crossover: "SUV",
  "sport utility": "SUV",
  truck: "Truck",
  pickup: "Truck",
  "pickup truck": "Truck",
  "pick-up": "Truck",
  hatchback: "Hatchback",
  hatch: "Hatchback",
  coupe: "Coupe",
  "coupé": "Coupe",
  convertible: "Convertible",
  cabriolet: "Convertible",
  roadster: "Convertible",
  minivan: "Minivan",
  van: "Minivan",
  "mini-van": "Minivan",
  wagon: "Wagon",
  estate: "Wagon",
};

const DRIVETRAIN: Record<string, Drivetrain> = {
  fwd: "FWD",
  "front-wheel drive": "FWD",
  "front wheel drive": "FWD",
  rwd: "RWD",
  "rear-wheel drive": "RWD",
  "rear wheel drive": "RWD",
  awd: "AWD",
  "all-wheel drive": "AWD",
  "all wheel drive": "AWD",
  "4wd": "4WD",
  "4x4": "4WD",
  "four-wheel drive": "4WD",
  "four wheel drive": "4WD",
};

const CONDITION: Record<string, Condition> = {
  excellent: "Excellent",
  "like new": "Excellent",
  good: "Good",
  "very good": "Good",
  fair: "Fair",
  average: "Fair",
  poor: "Poor",
  salvage: "Poor",
  rough: "Poor",
};

const BOOLEAN: Record<string, boolean> = {
  yes: true,
  y: true,
  true: true,
  "1": true,
  no: false,
  n: false,
  false: false,
  "0": false,
  none: false,
};

function lookup<T>(map: Record<string, T>, value: unknown): T | null {
  const text = cleanText(value);
  if (text === null) return null;
  const key = text.toLowerCase();
  return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : null;
}

export const normalizeFuel = (value: unknown): FuelType | null => lookup(FUEL, value);
export const normalizeTransmission = (value: unknown): Transmission | null => lookup(TRANSMISSION, value);
export const normalizeBody = (value: unknown): BodyType | null => lookup(BODY, value);
export const normalizeDrivetrain = (value: unknown): Drivetrain | null => lookup(DRIVETRAIN, value);
export const normalizeCondition = (value: unknown): Condition | null => lookup(CONDITION, value);

export function normalizeAccident(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  return lookup(BOOLEAN, value);
}

/** Parses "$18,450", "45,000 mi", "2.0L" or plain numbers. Returns null when unparseable. */
export function parseNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = cleanText(value);
  if (text === null) return null;
  const match = text.replace(/[$€£,\s]/g, "").match(/^-?\d+(\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}
