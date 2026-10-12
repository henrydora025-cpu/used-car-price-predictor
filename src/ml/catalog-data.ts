/**
 * Vehicle specifications used by the synthetic market simulator (scripts/generate-dataset.ts).
 * MSRPs are approximate US prices for a new vehicle; `k` is the annual depreciation rate
 * (in log space) – lower means the vehicle holds its value better.
 */
import type { BodyType, Drivetrain, FuelType } from "./schema";

export interface ModelSpec {
  name: string;
  msrp: number;
  body: Partial<Record<BodyType, number>>;
  fuel: Partial<Record<FuelType, number>>;
  drive: Partial<Record<Drivetrain, number>>;
  /** Engine displacement options in litres (smaller = base trim). Electric variants use 0. */
  engines: number[];
  /** Share of manual transmissions for a new car (grows for older model years). */
  manual?: number;
  years?: [number, number];
  /** Model-specific depreciation rate, overrides the brand rate. */
  k?: number;
  /** Enthusiast cars: manual premium and value stabilises with age. */
  enthusiast?: boolean;
  popularity?: number;
}

export interface BrandSpec {
  name: string;
  k: number;
  luxury?: boolean;
  popularity: number;
  models: ModelSpec[];
}

const GAS = { Gasoline: 1 };
const EV = { Electric: 1 };
const FWD = { FWD: 1 };
const RWD = { RWD: 1 };
const AWD = { AWD: 1 };
const FOUR = { "4WD": 1 };

export const BRANDS: BrandSpec[] = [
  {
    name: "Toyota",
    k: 0.085,
    popularity: 14,
    models: [
      { name: "Corolla", msrp: 23000, body: { Sedan: 85, Hatchback: 15 }, fuel: { Gasoline: 85, Hybrid: 15 }, drive: FWD, engines: [1.8, 2.0], manual: 0.04, popularity: 10 },
      { name: "Camry", msrp: 28000, body: { Sedan: 1 }, fuel: { Gasoline: 80, Hybrid: 20 }, drive: { FWD: 90, AWD: 10 }, engines: [2.5, 3.5], popularity: 10 },
      { name: "RAV4", msrp: 31000, body: { SUV: 1 }, fuel: { Gasoline: 70, Hybrid: 30 }, drive: { FWD: 40, AWD: 60 }, engines: [2.5], popularity: 11 },
      { name: "Highlander", msrp: 40000, body: { SUV: 1 }, fuel: { Gasoline: 80, Hybrid: 20 }, drive: { FWD: 30, AWD: 70 }, engines: [2.4, 3.5], popularity: 6 },
      { name: "Tacoma", msrp: 33000, body: { Truck: 1 }, fuel: GAS, drive: { RWD: 30, "4WD": 70 }, engines: [2.7, 3.5], manual: 0.12, k: 0.06, enthusiast: true, popularity: 7 },
      { name: "Tundra", msrp: 42000, body: { Truck: 1 }, fuel: GAS, drive: { RWD: 30, "4WD": 70 }, engines: [3.5, 4.6, 5.7], k: 0.075, popularity: 4 },
      { name: "Prius", msrp: 28000, body: { Hatchback: 1 }, fuel: { Hybrid: 1 }, drive: { FWD: 90, AWD: 10 }, engines: [1.8, 2.0], popularity: 5 },
      { name: "Sienna", msrp: 39000, body: { Minivan: 1 }, fuel: { Gasoline: 60, Hybrid: 40 }, drive: { FWD: 70, AWD: 30 }, engines: [2.5, 3.5], popularity: 3 },
      { name: "4Runner", msrp: 41000, body: { SUV: 1 }, fuel: GAS, drive: { RWD: 20, "4WD": 80 }, engines: [4.0], k: 0.06, enthusiast: true, popularity: 4 },
    ],
  },
  {
    name: "Honda",
    k: 0.09,
    popularity: 12,
    models: [
      { name: "Civic", msrp: 25000, body: { Sedan: 65, Hatchback: 25, Coupe: 10 }, fuel: GAS, drive: FWD, engines: [1.5, 2.0], manual: 0.15, popularity: 11 },
      { name: "Accord", msrp: 29000, body: { Sedan: 1 }, fuel: { Gasoline: 80, Hybrid: 20 }, drive: FWD, engines: [1.5, 2.0], manual: 0.04, popularity: 9 },
      { name: "CR-V", msrp: 31000, body: { SUV: 1 }, fuel: { Gasoline: 80, Hybrid: 20 }, drive: { FWD: 40, AWD: 60 }, engines: [1.5, 2.4], popularity: 10 },
      { name: "Pilot", msrp: 40000, body: { SUV: 1 }, fuel: GAS, drive: { FWD: 30, AWD: 70 }, engines: [3.5], popularity: 5 },
      { name: "Odyssey", msrp: 39000, body: { Minivan: 1 }, fuel: GAS, drive: FWD, engines: [3.5], popularity: 3 },
      { name: "HR-V", msrp: 25000, body: { SUV: 1 }, fuel: GAS, drive: { FWD: 60, AWD: 40 }, engines: [1.8, 2.0], years: [2016, 2026], popularity: 4 },
      { name: "Ridgeline", msrp: 40000, body: { Truck: 1 }, fuel: GAS, drive: AWD, engines: [3.5], popularity: 2 },
    ],
  },
  {
    name: "Ford",
    k: 0.115,
    popularity: 13,
    models: [
      { name: "F-150", msrp: 38000, body: { Truck: 1 }, fuel: { Gasoline: 90, Hybrid: 10 }, drive: { RWD: 30, "4WD": 70 }, engines: [2.7, 3.5, 5.0], k: 0.095, popularity: 12 },
      { name: "Escape", msrp: 30000, body: { SUV: 1 }, fuel: { Gasoline: 80, Hybrid: 20 }, drive: { FWD: 50, AWD: 50 }, engines: [1.5, 2.0], popularity: 7 },
      { name: "Explorer", msrp: 39000, body: { SUV: 1 }, fuel: GAS, drive: { RWD: 30, AWD: 70 }, engines: [2.3, 3.0], popularity: 6 },
      { name: "Mustang", msrp: 32000, body: { Coupe: 75, Convertible: 25 }, fuel: GAS, drive: RWD, engines: [2.3, 5.0], manual: 0.3, enthusiast: true, popularity: 5 },
      { name: "Focus", msrp: 20000, body: { Hatchback: 50, Sedan: 50 }, fuel: GAS, drive: FWD, engines: [2.0], manual: 0.15, years: [2004, 2018], k: 0.13, popularity: 5 },
      { name: "Fusion", msrp: 25000, body: { Sedan: 1 }, fuel: { Gasoline: 80, Hybrid: 20 }, drive: { FWD: 80, AWD: 20 }, engines: [1.5, 2.0, 2.5], years: [2006, 2020], popularity: 5 },
      { name: "Bronco", msrp: 40000, body: { SUV: 1 }, fuel: GAS, drive: FOUR, engines: [2.3, 2.7], manual: 0.25, years: [2021, 2026], k: 0.07, enthusiast: true, popularity: 3 },
      { name: "Mustang Mach-E", msrp: 45000, body: { SUV: 1 }, fuel: EV, drive: { RWD: 40, AWD: 60 }, engines: [0], years: [2021, 2026], k: 0.17, popularity: 2 },
      { name: "Ranger", msrp: 33000, body: { Truck: 1 }, fuel: GAS, drive: { RWD: 40, "4WD": 60 }, engines: [2.3], years: [2019, 2026], popularity: 3 },
    ],
  },
  {
    name: "Chevrolet",
    k: 0.12,
    popularity: 12,
    models: [
      { name: "Silverado 1500", msrp: 40000, body: { Truck: 1 }, fuel: { Gasoline: 90, Diesel: 10 }, drive: { RWD: 30, "4WD": 70 }, engines: [2.7, 5.3, 6.2], k: 0.1, popularity: 11 },
      { name: "Malibu", msrp: 25000, body: { Sedan: 1 }, fuel: GAS, drive: FWD, engines: [1.5, 2.0], popularity: 7 },
      { name: "Equinox", msrp: 29000, body: { SUV: 1 }, fuel: GAS, drive: { FWD: 50, AWD: 50 }, engines: [1.5, 2.0], popularity: 8 },
      { name: "Tahoe", msrp: 58000, body: { SUV: 1 }, fuel: GAS, drive: { RWD: 30, "4WD": 70 }, engines: [5.3, 6.2], k: 0.1, popularity: 4 },
      { name: "Camaro", msrp: 33000, body: { Coupe: 80, Convertible: 20 }, fuel: GAS, drive: RWD, engines: [2.0, 3.6, 6.2], manual: 0.25, years: [2010, 2024], enthusiast: true, popularity: 3 },
      { name: "Bolt EV", msrp: 27000, body: { Hatchback: 1 }, fuel: EV, drive: FWD, engines: [0], years: [2017, 2023], k: 0.17, popularity: 2 },
      { name: "Traverse", msrp: 38000, body: { SUV: 1 }, fuel: GAS, drive: { FWD: 50, AWD: 50 }, engines: [2.5, 3.6], popularity: 4 },
      { name: "Colorado", msrp: 32000, body: { Truck: 1 }, fuel: { Gasoline: 90, Diesel: 10 }, drive: { RWD: 40, "4WD": 60 }, engines: [2.5, 2.7, 3.6], popularity: 3 },
      { name: "Corvette", msrp: 68000, body: { Coupe: 70, Convertible: 30 }, fuel: GAS, drive: RWD, engines: [6.2], manual: 0.3, k: 0.07, enthusiast: true, popularity: 2 },
    ],
  },
  {
    name: "Nissan",
    k: 0.13,
    popularity: 8,
    models: [
      { name: "Altima", msrp: 27000, body: { Sedan: 1 }, fuel: GAS, drive: { FWD: 80, AWD: 20 }, engines: [2.0, 2.5], popularity: 9 },
      { name: "Sentra", msrp: 21000, body: { Sedan: 1 }, fuel: GAS, drive: FWD, engines: [1.8, 2.0], manual: 0.05, popularity: 7 },
      { name: "Rogue", msrp: 30000, body: { SUV: 1 }, fuel: { Gasoline: 90, Hybrid: 10 }, drive: { FWD: 50, AWD: 50 }, engines: [1.5, 2.5], popularity: 9 },
      { name: "Pathfinder", msrp: 38000, body: { SUV: 1 }, fuel: GAS, drive: { FWD: 40, AWD: 60 }, engines: [3.5], popularity: 4 },
      { name: "Frontier", msrp: 32000, body: { Truck: 1 }, fuel: GAS, drive: { RWD: 40, "4WD": 60 }, engines: [2.5, 3.8, 4.0], manual: 0.1, popularity: 3 },
      { name: "Leaf", msrp: 29000, body: { Hatchback: 1 }, fuel: EV, drive: FWD, engines: [0], years: [2011, 2026], k: 0.2, popularity: 3 },
      { name: "Maxima", msrp: 39000, body: { Sedan: 1 }, fuel: GAS, drive: FWD, engines: [3.5], years: [2004, 2023], k: 0.15, popularity: 2 },
      { name: "370Z", msrp: 32000, body: { Coupe: 1 }, fuel: GAS, drive: RWD, engines: [3.7], manual: 0.4, years: [2009, 2020], enthusiast: true, popularity: 1 },
    ],
  },
  {
    name: "Hyundai",
    k: 0.12,
    popularity: 7,
    models: [
      { name: "Elantra", msrp: 22000, body: { Sedan: 1 }, fuel: { Gasoline: 90, Hybrid: 10 }, drive: FWD, engines: [1.6, 2.0], manual: 0.05, popularity: 9 },
      { name: "Sonata", msrp: 27000, body: { Sedan: 1 }, fuel: { Gasoline: 80, Hybrid: 20 }, drive: FWD, engines: [1.6, 2.4, 2.5], popularity: 7 },
      { name: "Tucson", msrp: 29000, body: { SUV: 1 }, fuel: { Gasoline: 80, Hybrid: 20 }, drive: { FWD: 50, AWD: 50 }, engines: [2.0, 2.4, 2.5], popularity: 7 },
      { name: "Santa Fe", msrp: 33000, body: { SUV: 1 }, fuel: { Gasoline: 90, Hybrid: 10 }, drive: { FWD: 40, AWD: 60 }, engines: [2.4, 2.5, 3.3], popularity: 6 },
      { name: "Kona", msrp: 25000, body: { SUV: 1 }, fuel: { Gasoline: 80, Electric: 20 }, drive: { FWD: 60, AWD: 40 }, engines: [1.6, 2.0], years: [2018, 2026], popularity: 3 },
      { name: "Ioniq 5", msrp: 43000, body: { SUV: 1 }, fuel: EV, drive: { RWD: 40, AWD: 60 }, engines: [0], years: [2022, 2026], k: 0.18, popularity: 2 },
      { name: "Palisade", msrp: 38000, body: { SUV: 1 }, fuel: GAS, drive: { FWD: 40, AWD: 60 }, engines: [3.8], years: [2020, 2026], popularity: 3 },
    ],
  },
  {
    name: "Kia",
    k: 0.12,
    popularity: 7,
    models: [
      { name: "Forte", msrp: 21000, body: { Sedan: 1 }, fuel: GAS, drive: FWD, engines: [1.6, 2.0], manual: 0.05, popularity: 6 },
      { name: "Optima", msrp: 26000, body: { Sedan: 1 }, fuel: { Gasoline: 90, Hybrid: 10 }, drive: FWD, engines: [2.0, 2.4], years: [2004, 2020], popularity: 4 },
      { name: "K5", msrp: 27000, body: { Sedan: 1 }, fuel: GAS, drive: { FWD: 80, AWD: 20 }, engines: [1.6, 2.5], years: [2021, 2026], popularity: 3 },
      { name: "Sportage", msrp: 28000, body: { SUV: 1 }, fuel: { Gasoline: 90, Hybrid: 10 }, drive: { FWD: 50, AWD: 50 }, engines: [2.0, 2.4, 2.5], popularity: 6 },
      { name: "Sorento", msrp: 33000, body: { SUV: 1 }, fuel: { Gasoline: 90, Hybrid: 10 }, drive: { FWD: 40, AWD: 60 }, engines: [2.4, 2.5, 3.3, 3.5], popularity: 6 },
      { name: "Telluride", msrp: 37000, body: { SUV: 1 }, fuel: GAS, drive: { FWD: 30, AWD: 70 }, engines: [3.8], years: [2020, 2026], k: 0.07, popularity: 4 },
      { name: "Soul", msrp: 21000, body: { Hatchback: 1 }, fuel: { Gasoline: 90, Electric: 10 }, drive: FWD, engines: [1.6, 2.0], popularity: 4 },
      { name: "EV6", msrp: 43000, body: { SUV: 1 }, fuel: EV, drive: { RWD: 40, AWD: 60 }, engines: [0], years: [2022, 2026], k: 0.18, popularity: 2 },
    ],
  },
  {
    name: "Volkswagen",
    k: 0.13,
    popularity: 5,
    models: [
      { name: "Jetta", msrp: 22000, body: { Sedan: 1 }, fuel: { Gasoline: 85, Diesel: 15 }, drive: FWD, engines: [1.4, 1.8, 2.0], manual: 0.15, popularity: 7 },
      { name: "Golf", msrp: 25000, body: { Hatchback: 1 }, fuel: { Gasoline: 80, Diesel: 20 }, drive: FWD, engines: [1.8, 2.0], manual: 0.25, years: [2004, 2021], popularity: 4 },
      { name: "GTI", msrp: 32000, body: { Hatchback: 1 }, fuel: GAS, drive: FWD, engines: [2.0], manual: 0.45, k: 0.1, enthusiast: true, popularity: 3 },
      { name: "Passat", msrp: 27000, body: { Sedan: 1 }, fuel: { Gasoline: 80, Diesel: 20 }, drive: FWD, engines: [1.8, 2.0, 3.6], years: [2004, 2022], popularity: 4 },
      { name: "Tiguan", msrp: 29000, body: { SUV: 1 }, fuel: GAS, drive: { FWD: 50, AWD: 50 }, engines: [2.0], popularity: 6 },
      { name: "Atlas", msrp: 38000, body: { SUV: 1 }, fuel: GAS, drive: { FWD: 40, AWD: 60 }, engines: [2.0, 3.6], years: [2018, 2026], popularity: 3 },
      { name: "ID.4", msrp: 41000, body: { SUV: 1 }, fuel: EV, drive: { RWD: 60, AWD: 40 }, engines: [0], years: [2021, 2026], k: 0.19, popularity: 2 },
    ],
  },
  {
    name: "Subaru",
    k: 0.09,
    popularity: 6,
    models: [
      { name: "Impreza", msrp: 23000, body: { Sedan: 50, Hatchback: 50 }, fuel: GAS, drive: AWD, engines: [2.0], manual: 0.15, popularity: 5 },
      { name: "Outback", msrp: 30000, body: { Wagon: 1 }, fuel: GAS, drive: AWD, engines: [2.4, 2.5, 3.6], popularity: 8 },
      { name: "Forester", msrp: 29000, body: { SUV: 1 }, fuel: GAS, drive: AWD, engines: [2.0, 2.5], manual: 0.08, popularity: 7 },
      { name: "Crosstrek", msrp: 26000, body: { SUV: 1 }, fuel: { Gasoline: 90, Hybrid: 10 }, drive: AWD, engines: [2.0, 2.5], manual: 0.15, years: [2013, 2026], k: 0.08, popularity: 6 },
      { name: "WRX", msrp: 33000, body: { Sedan: 1 }, fuel: GAS, drive: AWD, engines: [2.0, 2.4, 2.5], manual: 0.6, k: 0.09, enthusiast: true, popularity: 3 },
      { name: "Ascent", msrp: 36000, body: { SUV: 1 }, fuel: GAS, drive: AWD, engines: [2.4], years: [2019, 2026], popularity: 2 },
    ],
  },
  {
    name: "Mazda",
    k: 0.11,
    popularity: 5,
    models: [
      { name: "Mazda3", msrp: 24000, body: { Sedan: 50, Hatchback: 50 }, fuel: GAS, drive: { FWD: 80, AWD: 20 }, engines: [2.0, 2.5], manual: 0.12, popularity: 6 },
      { name: "Mazda6", msrp: 27000, body: { Sedan: 1 }, fuel: GAS, drive: FWD, engines: [2.5], years: [2004, 2021], popularity: 3 },
      { name: "CX-5", msrp: 29000, body: { SUV: 1 }, fuel: GAS, drive: { FWD: 40, AWD: 60 }, engines: [2.5], years: [2013, 2026], popularity: 7 },
      { name: "CX-9", msrp: 38000, body: { SUV: 1 }, fuel: GAS, drive: { FWD: 40, AWD: 60 }, engines: [2.5, 3.7], years: [2007, 2023], popularity: 3 },
      { name: "MX-5 Miata", msrp: 30000, body: { Convertible: 1 }, fuel: GAS, drive: RWD, engines: [2.0], manual: 0.6, k: 0.07, enthusiast: true, popularity: 2 },
      { name: "CX-30", msrp: 25000, body: { SUV: 1 }, fuel: GAS, drive: { FWD: 50, AWD: 50 }, engines: [2.5], years: [2020, 2026], popularity: 3 },
    ],
  },
  {
    name: "Jeep",
    k: 0.12,
    popularity: 6,
    models: [
      { name: "Wrangler", msrp: 33000, body: { SUV: 1 }, fuel: { Gasoline: 90, Hybrid: 10 }, drive: FOUR, engines: [3.6, 2.0], manual: 0.2, k: 0.065, enthusiast: true, popularity: 8 },
      { name: "Grand Cherokee", msrp: 40000, body: { SUV: 1 }, fuel: { Gasoline: 90, Diesel: 10 }, drive: { RWD: 20, "4WD": 80 }, engines: [3.6, 5.7], popularity: 7 },
      { name: "Cherokee", msrp: 29000, body: { SUV: 1 }, fuel: GAS, drive: { FWD: 40, "4WD": 60 }, engines: [2.4, 3.2], years: [2014, 2023], k: 0.14, popularity: 4 },
      { name: "Compass", msrp: 27000, body: { SUV: 1 }, fuel: GAS, drive: { FWD: 40, "4WD": 60 }, engines: [2.0, 2.4], popularity: 4 },
      { name: "Gladiator", msrp: 39000, body: { Truck: 1 }, fuel: { Gasoline: 90, Diesel: 10 }, drive: FOUR, engines: [3.6], manual: 0.15, years: [2020, 2026], k: 0.08, popularity: 2 },
    ],
  },
  {
    name: "Ram",
    k: 0.12,
    popularity: 5,
    models: [
      { name: "1500", msrp: 40000, body: { Truck: 1 }, fuel: { Gasoline: 90, Diesel: 10 }, drive: { RWD: 30, "4WD": 70 }, engines: [3.6, 5.7], popularity: 9 },
      { name: "2500", msrp: 47000, body: { Truck: 1 }, fuel: { Gasoline: 50, Diesel: 50 }, drive: FOUR, engines: [6.4, 6.7], k: 0.09, popularity: 4 },
    ],
  },
  {
    name: "GMC",
    k: 0.115,
    popularity: 5,
    models: [
      { name: "Sierra 1500", msrp: 42000, body: { Truck: 1 }, fuel: { Gasoline: 90, Diesel: 10 }, drive: { RWD: 30, "4WD": 70 }, engines: [2.7, 5.3, 6.2], k: 0.1, popularity: 8 },
      { name: "Yukon", msrp: 60000, body: { SUV: 1 }, fuel: GAS, drive: { RWD: 30, "4WD": 70 }, engines: [5.3, 6.2], k: 0.1, popularity: 3 },
      { name: "Acadia", msrp: 37000, body: { SUV: 1 }, fuel: GAS, drive: { FWD: 50, AWD: 50 }, engines: [2.0, 2.5, 3.6], popularity: 4 },
      { name: "Terrain", msrp: 29000, body: { SUV: 1 }, fuel: GAS, drive: { FWD: 50, AWD: 50 }, engines: [1.5, 2.0], popularity: 4 },
    ],
  },
  {
    name: "BMW",
    k: 0.16,
    luxury: true,
    popularity: 5,
    models: [
      { name: "3 Series", msrp: 45000, body: { Sedan: 1 }, fuel: { Gasoline: 90, Hybrid: 10 }, drive: { RWD: 40, AWD: 60 }, engines: [2.0, 3.0], manual: 0.08, popularity: 8 },
      { name: "5 Series", msrp: 58000, body: { Sedan: 1 }, fuel: { Gasoline: 90, Diesel: 5, Hybrid: 5 }, drive: { RWD: 40, AWD: 60 }, engines: [2.0, 3.0, 4.4], popularity: 5 },
      { name: "X3", msrp: 48000, body: { SUV: 1 }, fuel: GAS, drive: AWD, engines: [2.0, 3.0], popularity: 7 },
      { name: "X5", msrp: 66000, body: { SUV: 1 }, fuel: { Gasoline: 80, Diesel: 10, Hybrid: 10 }, drive: AWD, engines: [3.0, 4.4], popularity: 6 },
      { name: "M3", msrp: 75000, body: { Sedan: 1 }, fuel: GAS, drive: { RWD: 60, AWD: 40 }, engines: [3.0, 4.0], manual: 0.35, k: 0.11, enthusiast: true, popularity: 2 },
      { name: "i3", msrp: 45000, body: { Hatchback: 1 }, fuel: EV, drive: RWD, engines: [0], years: [2014, 2021], k: 0.24, popularity: 1 },
      { name: "X1", msrp: 40000, body: { SUV: 1 }, fuel: GAS, drive: { FWD: 30, AWD: 70 }, engines: [2.0], popularity: 4 },
    ],
  },
  {
    name: "Mercedes-Benz",
    k: 0.16,
    luxury: true,
    popularity: 5,
    models: [
      { name: "C-Class", msrp: 47000, body: { Sedan: 85, Coupe: 15 }, fuel: GAS, drive: { RWD: 40, AWD: 60 }, engines: [2.0, 3.0], popularity: 8 },
      { name: "E-Class", msrp: 60000, body: { Sedan: 1 }, fuel: { Gasoline: 90, Diesel: 10 }, drive: { RWD: 30, AWD: 70 }, engines: [2.0, 3.0, 3.5], popularity: 6 },
      { name: "GLC", msrp: 49000, body: { SUV: 1 }, fuel: GAS, drive: AWD, engines: [2.0], years: [2016, 2026], popularity: 6 },
      { name: "GLE", msrp: 62000, body: { SUV: 1 }, fuel: { Gasoline: 90, Diesel: 10 }, drive: AWD, engines: [2.0, 3.0, 3.5], popularity: 5 },
      { name: "S-Class", msrp: 115000, body: { Sedan: 1 }, fuel: GAS, drive: { RWD: 30, AWD: 70 }, engines: [3.0, 4.0, 4.7, 5.5], k: 0.19, popularity: 2 },
      { name: "CLA", msrp: 40000, body: { Sedan: 1 }, fuel: GAS, drive: { FWD: 60, AWD: 40 }, engines: [2.0], years: [2014, 2026], popularity: 3 },
    ],
  },
  {
    name: "Audi",
    k: 0.155,
    luxury: true,
    popularity: 4,
    models: [
      { name: "A4", msrp: 42000, body: { Sedan: 1 }, fuel: GAS, drive: { FWD: 30, AWD: 70 }, engines: [2.0], manual: 0.05, popularity: 7 },
      { name: "A6", msrp: 57000, body: { Sedan: 1 }, fuel: GAS, drive: AWD, engines: [2.0, 3.0], popularity: 4 },
      { name: "Q5", msrp: 46000, body: { SUV: 1 }, fuel: { Gasoline: 90, Hybrid: 10 }, drive: AWD, engines: [2.0, 3.0], popularity: 7 },
      { name: "Q7", msrp: 60000, body: { SUV: 1 }, fuel: { Gasoline: 90, Diesel: 10 }, drive: AWD, engines: [2.0, 3.0], popularity: 4 },
      { name: "e-tron", msrp: 75000, body: { SUV: 1 }, fuel: EV, drive: AWD, engines: [0], years: [2019, 2024], k: 0.24, popularity: 2 },
      { name: "A3", msrp: 36000, body: { Sedan: 1 }, fuel: GAS, drive: { FWD: 50, AWD: 50 }, engines: [1.8, 2.0], popularity: 3 },
    ],
  },
  {
    name: "Lexus",
    k: 0.09,
    luxury: true,
    popularity: 4,
    models: [
      { name: "ES", msrp: 43000, body: { Sedan: 1 }, fuel: { Gasoline: 70, Hybrid: 30 }, drive: FWD, engines: [2.5, 3.5], popularity: 7 },
      { name: "RX", msrp: 50000, body: { SUV: 1 }, fuel: { Gasoline: 70, Hybrid: 30 }, drive: { FWD: 30, AWD: 70 }, engines: [2.4, 3.5], popularity: 8 },
      { name: "NX", msrp: 41000, body: { SUV: 1 }, fuel: { Gasoline: 70, Hybrid: 30 }, drive: { FWD: 30, AWD: 70 }, engines: [2.0, 2.5], years: [2015, 2026], popularity: 5 },
      { name: "IS", msrp: 41000, body: { Sedan: 1 }, fuel: GAS, drive: { RWD: 50, AWD: 50 }, engines: [2.0, 2.5, 3.5], popularity: 4 },
      { name: "GX", msrp: 62000, body: { SUV: 1 }, fuel: GAS, drive: FOUR, engines: [3.4, 4.6], k: 0.07, popularity: 3 },
    ],
  },
  {
    name: "Tesla",
    k: 0.14,
    luxury: true,
    popularity: 4,
    models: [
      { name: "Model 3", msrp: 42000, body: { Sedan: 1 }, fuel: EV, drive: { RWD: 50, AWD: 50 }, engines: [0], years: [2018, 2026], k: 0.13, popularity: 9 },
      { name: "Model Y", msrp: 46000, body: { SUV: 1 }, fuel: EV, drive: AWD, engines: [0], years: [2020, 2026], k: 0.13, popularity: 8 },
      { name: "Model S", msrp: 80000, body: { Sedan: 1 }, fuel: EV, drive: AWD, engines: [0], years: [2012, 2026], k: 0.17, popularity: 3 },
      { name: "Model X", msrp: 90000, body: { SUV: 1 }, fuel: EV, drive: AWD, engines: [0], years: [2016, 2026], k: 0.18, popularity: 2 },
    ],
  },
  {
    name: "Porsche",
    k: 0.11,
    luxury: true,
    popularity: 2,
    models: [
      { name: "911", msrp: 115000, body: { Coupe: 70, Convertible: 30 }, fuel: GAS, drive: { RWD: 60, AWD: 40 }, engines: [3.0, 3.8, 4.0], manual: 0.3, k: 0.05, enthusiast: true, popularity: 3 },
      { name: "Cayenne", msrp: 80000, body: { SUV: 1 }, fuel: { Gasoline: 80, Hybrid: 20 }, drive: AWD, engines: [2.9, 3.0, 4.0], k: 0.15, popularity: 4 },
      { name: "Macan", msrp: 62000, body: { SUV: 1 }, fuel: GAS, drive: AWD, engines: [2.0, 2.9, 3.0], years: [2015, 2026], k: 0.13, popularity: 4 },
      { name: "Taycan", msrp: 90000, body: { Sedan: 1 }, fuel: EV, drive: AWD, engines: [0], years: [2020, 2026], k: 0.22, popularity: 2 },
    ],
  },
  {
    name: "Volvo",
    k: 0.14,
    luxury: true,
    popularity: 3,
    models: [
      { name: "XC60", msrp: 46000, body: { SUV: 1 }, fuel: { Gasoline: 80, Hybrid: 20 }, drive: AWD, engines: [2.0], popularity: 6 },
      { name: "XC90", msrp: 57000, body: { SUV: 1 }, fuel: { Gasoline: 80, Hybrid: 20 }, drive: AWD, engines: [2.0], popularity: 5 },
      { name: "S60", msrp: 43000, body: { Sedan: 1 }, fuel: { Gasoline: 90, Hybrid: 10 }, drive: { FWD: 40, AWD: 60 }, engines: [2.0, 2.5], popularity: 4 },
      { name: "XC40", msrp: 38000, body: { SUV: 1 }, fuel: { Gasoline: 80, Electric: 20 }, drive: AWD, engines: [2.0], years: [2019, 2026], popularity: 4 },
    ],
  },
];
