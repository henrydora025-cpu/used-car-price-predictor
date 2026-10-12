import { describe, expect, it } from "vitest";
import { cleanDataset } from "@/ml/cleaning";
import { parseCsv, toCsv, type RawRow } from "@/ml/csv";
import {
  normalizeAccident,
  normalizeBody,
  normalizeCondition,
  normalizeDrivetrain,
  normalizeFuel,
  normalizeTransmission,
  parseNumber,
} from "@/ml/normalize";

const BASE: RawRow = {
  listing_id: "L0",
  manufacturer: "Toyota",
  model: "Corolla",
  year: "2018",
  mileage: "60000",
  fuel_type: "Gasoline",
  transmission: "Automatic",
  body_type: "Sedan",
  drivetrain: "FWD",
  engine_size: "1.8",
  condition: "Good",
  owners: "1",
  accident_history: "No",
  price: "15000",
};
const row = (overrides: Partial<RawRow>, id: number): RawRow => ({ ...BASE, listing_id: `L${id}`, ...overrides });

describe("label normalisation", () => {
  it("maps synonyms and casing to canonical categories", () => {
    expect(normalizeFuel("petrol")).toBe("Gasoline");
    expect(normalizeFuel(" EV ")).toBe("Electric");
    expect(normalizeTransmission("Stick")).toBe("Manual");
    expect(normalizeTransmission("CVT")).toBe("Automatic");
    expect(normalizeDrivetrain("4x4")).toBe("4WD");
    expect(normalizeBody("Pickup")).toBe("Truck");
    expect(normalizeCondition("like new")).toBe("Excellent");
    expect(normalizeAccident("Y")).toBe(true);
    expect(normalizeAccident("None")).toBe(false);
  });

  it("returns null for placeholders and unknown labels", () => {
    expect(normalizeFuel("N/A")).toBeNull();
    expect(normalizeFuel("rocket fuel")).toBeNull();
    expect(normalizeCondition("")).toBeNull();
  });

  it("parses currency and unit strings", () => {
    expect(parseNumber("$18,450")).toBe(18450);
    expect(parseNumber("45,000 mi")).toBe(45000);
    expect(parseNumber("2.0L")).toBe(2);
    expect(parseNumber("18450.00")).toBe(18450);
    expect(parseNumber("abc")).toBeNull();
    expect(parseNumber("")).toBeNull();
  });
});

describe("CSV I/O", () => {
  it("round-trips quoted fields with commas", () => {
    const csv = toCsv([{ a: "$18,450", b: 'say "hi"' }], ["a", "b"]);
    expect(parseCsv(csv)).toEqual([{ a: "$18,450", b: 'say "hi"' }]);
  });
});

describe("cleanDataset", () => {
  it("resolves manufacturer aliases and canonical spellings", () => {
    const rows = [
      row({ manufacturer: "Chevy", model: "Malibu", mileage: "10000" }, 1),
      row({ manufacturer: "Chevrolet", model: "Malibu", mileage: "11000" }, 2),
      row({ manufacturer: " toyota ", model: "corolla", mileage: "12000" }, 3),
      row({ mileage: "13000" }, 4),
      row({ mileage: "14000" }, 5),
    ];
    const { data } = cleanDataset(rows, { referenceYear: 2026 });
    expect(new Set(data.map((d) => d.manufacturer))).toEqual(new Set(["Chevrolet", "Toyota"]));
    expect(data.filter((d) => d.manufacturer === "Toyota").every((d) => d.model === "Corolla")).toBe(true);
  });

  it("removes duplicates, missing targets, invalid years and implausible prices", () => {
    const rows = [
      row({ mileage: "10000" }, 1),
      row({ mileage: "10000" }, 1), // same listing id
      row({ mileage: "10000", manufacturer: "TOYOTA" }, 99), // identical after normalisation
      row({ mileage: "20000", price: "" }, 2), // missing target
      row({ mileage: "30000", year: "1900" }, 3), // invalid year
      row({ mileage: "40000", price: "1" }, 4), // placeholder price
      row({ mileage: "50000", price: "$14,500" }, 5), // valid, formatted
    ];
    const { data, report } = cleanDataset(rows, { referenceYear: 2026 });
    const step = (key: string) => report.steps.find((s) => s.key === key);
    expect(data).toHaveLength(2);
    expect(step("duplicates")?.rowsRemoved).toBe(2);
    expect(step("missing_target")?.rowsRemoved).toBe(1);
    expect(step("invalid_year")?.rowsRemoved).toBe(1);
    expect(step("price_bounds")?.rowsRemoved).toBe(1);
    expect(data.find((d) => d.mileage === 50000)?.price).toBe(14500);
    expect(report.rawRows).toBe(7);
    expect(report.cleanRows).toBe(2);
  });

  it("nullifies impossible values instead of dropping the row", () => {
    const { data } = cleanDataset([row({ mileage: "-5", owners: "0", engine_size: "12" }, 1)], { referenceYear: 2026 });
    expect(data).toHaveLength(1);
    expect(data[0].mileage).toBeNull();
    expect(data[0].owners).toBeNull();
    expect(data[0].engine_size).toBeNull();
  });

  it("removes ×10 and ÷10 price typos using peer-group robust z-scores", () => {
    const rows = Array.from({ length: 30 }, (_, i) =>
      row({ mileage: String(50000 + i * 1000), price: String(15000 + (i % 7) * 300) }, i),
    );
    rows.push(row({ mileage: "91500", price: "152000" }, 100));
    rows.push(row({ mileage: "92500", price: "1520" }, 101));
    const { data, report } = cleanDataset(rows, { referenceYear: 2026 });
    expect(report.steps.find((s) => s.key === "price_outliers")?.rowsRemoved).toBe(2);
    expect(data.every((d) => d.price >= 10000 && d.price <= 20000)).toBe(true);
  });
});
