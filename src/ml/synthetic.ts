/**
 * Synthetic used-car market simulator.
 *
 * Generates realistic listings from a hedonic pricing model (brand/model-specific depreciation,
 * mileage, condition, accident history, owners, trims, drivetrain, enthusiast premiums, ...) and
 * then injects the data-quality problems found in real marketplaces: missing values, inconsistent
 * labels, unit/currency strings, typos in prices, impossible values and duplicate listings.
 */
import { BRANDS, type BrandSpec, type ModelSpec } from "./catalog-data";
import type { RawRow } from "./csv";
import { createRng, pick, pickWeighted, randomNormal, randomPoisson, shuffle, type Rng } from "./random";
import type { BodyType, CompleteVehicle, Condition, Drivetrain, FuelType, Transmission } from "./schema";

export interface SyntheticOptions {
  rows: number;
  seed: number;
  referenceYear: number;
  minYear?: number;
  duplicateRate?: number;
}

export interface SyntheticVehicle extends CompleteVehicle {
  price: number;
}

const RELIABLE_BRANDS = new Set(["Toyota", "Honda", "Lexus", "Subaru"]);
const CONDITION_EFFECT: Record<Condition, number> = { Excellent: 0.07, Good: 0, Fair: -0.13, Poor: -0.32 };

const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));

function weighted<K extends string>(weights: Partial<Record<K, number>>): [K, number][] {
  return (Object.entries(weights) as [K, number | undefined][])
    .filter((entry): entry is [K, number] => typeof entry[1] === "number" && entry[1] > 0)
    .map(([key, weight]) => [key, weight]);
}

function simulatePrice(brand: BrandSpec, spec: ModelSpec, v: CompleteVehicle, age: number, engineIndex: number, rng: Rng) {
  const primaryBody = weighted(spec.body).sort((a, b) => b[1] - a[1])[0][0];
  const isTruck = v.body_type === "Truck";
  let lp = Math.log(spec.msrp);
  lp += 0.085 * engineIndex; // bigger engine ↔ higher trim
  lp += randomNormal(rng, 0, 0.06); // unobserved trim & options
  if (v.body_type === "Convertible") lp += 0.06;
  else if (v.body_type === "Coupe") lp += 0.02;
  else if (v.body_type === "Hatchback" && primaryBody !== "Hatchback") lp -= 0.03;
  if (v.drivetrain === "AWD" || v.drivetrain === "4WD") lp += isTruck ? 0.08 : 0.045;

  // Depreciation: first-year hit + brand/model specific yearly rate, flattening for old cars.
  const k = spec.k ?? brand.k;
  let depreciation = age === 0 ? 0.05 : 0.11 + k * age;
  if (age > 12) depreciation -= 0.45 * k * (age - 12);
  if (spec.enthusiast && age > 8) depreciation -= 0.55 * k * (age - 8);
  if (v.fuel_type === "Electric") depreciation += 0.025 * Math.max(0, age - 4); // battery ageing
  lp -= depreciation;

  // Mileage relative to what is expected for the age + a non-linear high-mileage penalty.
  const expected = 12000 * Math.max(age, 0.4);
  const sensitivity = brand.luxury ? 0.042 : RELIABLE_BRANDS.has(brand.name) ? 0.024 : 0.033;
  lp -= sensitivity * clamp((v.mileage - expected) / 10000, -6, 14);
  const high = Math.max(0, v.mileage - 120000) / 100000;
  lp -= 0.2 * high + 0.08 * high * high;

  lp += CONDITION_EFFECT[v.condition];
  if (v.accident_history) lp -= brand.luxury ? 0.15 : 0.09;
  lp -= 0.035 * (v.owners - 1);
  if (v.transmission === "Manual") lp += spec.enthusiast ? 0.07 : -0.06;
  if (v.fuel_type === "Diesel") lp += isTruck ? 0.12 : brand.name === "Volkswagen" ? -0.08 : 0.02;
  if (v.fuel_type === "Hybrid") lp += 0.04;
  lp += randomNormal(rng, 0, 0.07); // negotiation / local market noise

  const raw = Math.exp(lp);
  const floored = Math.sqrt(raw * raw + 1500 * 1500); // scrap-value floor
  let price = Math.round(floored / 50) * 50;
  if (rng() < 0.3) price -= 5; // "charm" pricing such as $17,995
  return price;
}

/** Clean, ground-truth vehicles. */
export function generateVehicles(options: SyntheticOptions): SyntheticVehicle[] {
  const { rows, seed, referenceYear } = options;
  const minYear = options.minYear ?? 2004;
  const rng = createRng(seed);
  const brandEntries = BRANDS.map((b) => [b, b.popularity] as const);
  const out: SyntheticVehicle[] = [];

  for (let i = 0; i < rows; i++) {
    const brand = pickWeighted(rng, brandEntries);
    const spec = pickWeighted(
      rng,
      brand.models.map((m) => [m, m.popularity ?? 3] as const),
    );
    const [fromYear, toYear] = spec.years ?? [minYear, referenceYear];
    const ages: [number, number][] = [];
    for (let year = Math.max(fromYear, minYear); year <= Math.min(toYear, referenceYear); year++) {
      const age = referenceYear - year;
      ages.push([age, Math.exp(-age / 7) * (age === 0 ? 0.45 : age === 1 ? 0.85 : 1)]);
    }
    const age = pickWeighted(rng, ages);
    const fuel_type = pickWeighted(rng, weighted<FuelType>(spec.fuel));
    const combustion = spec.engines.filter((e) => e > 0);
    const engineIndex =
      fuel_type === "Electric" || combustion.length === 0
        ? 0
        : pickWeighted(
            rng,
            combustion.map((_, idx) => [idx, 1 / (idx + 1)] as const),
          );
    const engine_size = fuel_type === "Electric" ? 0 : combustion[engineIndex] ?? 2.0;
    const manualShare = fuel_type === "Electric" ? 0 : Math.min(0.85, (spec.manual ?? 0) * (1 + 0.06 * age));
    const transmission: Transmission = rng() < manualShare ? "Manual" : "Automatic";
    const body_type = pickWeighted(rng, weighted<BodyType>(spec.body));
    const drivetrain = pickWeighted(rng, weighted<Drivetrain>(spec.drive));

    const annual = 12000 * Math.exp(randomNormal(rng, 0, 0.35));
    const yearsOnRoad = age === 0 ? 0.05 + rng() * 0.7 : age - 0.3 + rng() * 0.8;
    const mileage = Math.round(clamp(annual * yearsOnRoad, 5, 380000));
    const owners = Math.min(6, 1 + randomPoisson(rng, age * 0.16));
    const accident_history = rng() < Math.min(0.38, 0.05 + 0.017 * age);
    const latent = randomNormal(rng) + 0.6 - 0.075 * age - 0.25 * (mileage / 100000) - (accident_history ? 0.45 : 0);
    const condition: Condition = latent > 0.75 ? "Excellent" : latent > -0.5 ? "Good" : latent > -1.4 ? "Fair" : "Poor";

    const vehicle: CompleteVehicle = {
      manufacturer: brand.name,
      model: spec.name,
      year: referenceYear - age,
      mileage,
      fuel_type,
      transmission,
      body_type,
      drivetrain,
      engine_size,
      condition,
      owners,
      accident_history,
    };
    out.push({ ...vehicle, price: simulatePrice(brand, spec, vehicle, age, engineIndex, rng) });
  }
  return out;
}

// ── Data-quality issues ─────────────────────────────────────────────────────────
const FUEL_VARIANTS: Record<FuelType, string[]> = {
  Gasoline: ["Gas", "gasoline", "Petrol", "GASOLINE", "gas"],
  Diesel: ["diesel", "DIESEL"],
  Hybrid: ["hybrid", "HEV", "Hybrid "],
  Electric: ["EV", "electric", "BEV"],
};
const TRANSMISSION_VARIANTS: Record<Transmission, string[]> = {
  Automatic: ["Auto", "automatic", "A/T", "CVT"],
  Manual: ["manual", "M/T", "Stick"],
};
const BODY_VARIANTS: Record<BodyType, string[]> = {
  Sedan: ["sedan", "SEDAN"],
  SUV: ["suv", "Crossover"],
  Truck: ["Pickup", "pickup truck"],
  Hatchback: ["hatchback", "Hatch"],
  Coupe: ["coupe", "Coupé"],
  Convertible: ["convertible", "Cabriolet"],
  Minivan: ["minivan", "Van"],
  Wagon: ["wagon", "Estate"],
};
const DRIVE_VARIANTS: Record<Drivetrain, string[]> = {
  FWD: ["fwd", "Front-Wheel Drive"],
  RWD: ["rwd", "Rear-Wheel Drive"],
  AWD: ["awd", "All-Wheel Drive"],
  "4WD": ["4x4", "Four-Wheel Drive", "4wd"],
};
const CONDITION_VARIANTS: Record<Condition, string[]> = {
  Excellent: ["excellent", "Like New"],
  Good: ["good", "GOOD"],
  Fair: ["fair", "Average"],
  Poor: ["poor", "Salvage"],
};
const MANUFACTURER_ALIASES: Record<string, string[]> = {
  Chevrolet: ["Chevy", "chevy"],
  Volkswagen: ["VW", "vw"],
  "Mercedes-Benz": ["Mercedes", "mercedes benz", "Mercedes Benz"],
};

const withCommas = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

function caseVariant(text: string, rng: Rng): string {
  return pick(rng, [text.toLowerCase(), text.toUpperCase(), `  ${text} `, `${text} `]);
}

function categorical(value: string, variants: string[], rng: Rng, missingRate: number, variantRate: number): string {
  const r = rng();
  if (r < missingRate) return "";
  if (r < missingRate + variantRate) return pick(rng, variants);
  return value;
}

function formatPrice(price: number, rng: Rng): string {
  const r = rng();
  if (r < 0.18) return `$${withCommas(price)}`;
  if (r < 0.23) return `${price}.00`;
  return String(price);
}

function toDirtyRow(v: SyntheticVehicle, listingId: string, rng: Rng): RawRow {
  const r = () => rng();
  let manufacturer = v.manufacturer;
  const m = r();
  if (m < 0.05) manufacturer = caseVariant(v.manufacturer, rng);
  else if (m < 0.08 && MANUFACTURER_ALIASES[v.manufacturer]) manufacturer = pick(rng, MANUFACTURER_ALIASES[v.manufacturer]);

  let mileage: string;
  const mr = r();
  if (mr < 0.035) mileage = "";
  else if (mr < 0.038) mileage = pick(rng, ["-1", "-250", "9999999", "1500000"]);
  else if (mr < 0.07) mileage = withCommas(v.mileage);
  else if (mr < 0.09) mileage = `${v.mileage} mi`;
  else mileage = String(v.mileage);

  let price: string;
  const pr = r();
  if (pr < 0.005) price = "";
  else if (pr < 0.017) {
    price = pickWeighted(rng, [
      ["0", 1],
      ["1", 1],
      ["100", 1],
      ["999999", 1],
      [String(v.price * 10), 3],
      [String(Math.round(v.price / 10)), 3],
    ] as const);
  } else price = formatPrice(v.price, rng);

  const er = r();
  const engine = er < 0.025 ? "" : er < 0.06 ? `${v.engine_size.toFixed(1)}L` : v.engine_size.toFixed(1);
  const yr = r();
  const year = yr < 0.0025 ? pick(rng, ["", "1900", "2099", "0"]) : String(v.year);
  const accident = categorical(
    v.accident_history ? "Yes" : "No",
    v.accident_history ? ["yes", "Y", "TRUE", "1"] : ["no", "N", "FALSE", "0", "None"],
    rng,
    0.02,
    0.1,
  );

  return {
    listing_id: listingId,
    manufacturer,
    model: r() < 0.04 ? caseVariant(v.model, rng) : v.model,
    year,
    mileage,
    fuel_type: categorical(v.fuel_type, FUEL_VARIANTS[v.fuel_type], rng, 0.03, 0.15),
    transmission: categorical(v.transmission, TRANSMISSION_VARIANTS[v.transmission], rng, 0.03, 0.12),
    body_type: categorical(v.body_type, BODY_VARIANTS[v.body_type], rng, 0.015, 0.1),
    drivetrain: categorical(v.drivetrain, DRIVE_VARIANTS[v.drivetrain], rng, 0.02, 0.12),
    engine_size: engine,
    condition: categorical(v.condition, CONDITION_VARIANTS[v.condition], rng, 0.025, 0.12),
    owners: r() < 0.03 ? "" : String(v.owners),
    accident_history: accident,
    price,
  };
}

/** Raw marketplace export with realistic data-quality problems (see module docs). */
export function generateRawDataset(options: SyntheticOptions): RawRow[] {
  const vehicles = generateVehicles(options);
  const rng = createRng(options.seed + 1000);
  const rows = vehicles.map((v, i) => toDirtyRow(v, `UC-${100001 + i}`, rng));
  const duplicates = Math.round(rows.length * (options.duplicateRate ?? 0.03));
  for (let d = 0; d < duplicates; d++) {
    const source = rows[Math.floor(rng() * vehicles.length)];
    const copy: RawRow = { ...source };
    if (rng() < 0.5) {
      copy.manufacturer = caseVariant(source.manufacturer.trim(), rng);
      copy.model = caseVariant(source.model.trim(), rng);
    }
    rows.push(copy);
  }
  return shuffle(rows, rng);
}
