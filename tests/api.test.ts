import { describe, expect, it, vi } from "vitest";

// The database is mocked: API tests exercise validation, inference and response contracts.
vi.mock("@/lib/prediction-log", () => ({
  recordPredictions: vi.fn(async () => true),
  listRecentPredictions: vi.fn(async () => ({ items: [], total: 0, average_price: 0 })),
}));

import { GET as getModel } from "@/app/api/model/route";
import { GET as getOpenApi } from "@/app/api/openapi/route";
import { GET as getOptions } from "@/app/api/options/route";
import { POST as predictBatch } from "@/app/api/predict/batch/route";
import { POST as predict } from "@/app/api/predict/route";
import { recordPredictions } from "@/lib/prediction-log";

const post = (url: string, body: unknown) =>
  new Request(`http://localhost${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

interface PredictBody {
  estimated_price: number;
  currency: string;
  vehicle: { fuel_type: string; transmission: string; drivetrain: string };
  depreciation_forecast: unknown[];
  model_predictions: Record<string, number>;
}
interface ErrorBody {
  error: string;
  details: { field: string; message: string }[];
}

describe("POST /api/predict", () => {
  it("returns an estimate for a valid vehicle and logs it", async () => {
    const res = await predict(
      post("/api/predict", { manufacturer: "Honda", model: "Civic", year: 2018, mileage: 70000, fuel_type: "Gasoline", transmission: "Manual" }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as PredictBody;
    expect(body.estimated_price).toBeGreaterThan(1000);
    expect(body.currency).toBe("USD");
    expect(body.vehicle.transmission).toBe("Manual");
    expect(body.depreciation_forecast).toHaveLength(6);
    expect(Object.keys(body.model_predictions)).toHaveLength(3);
    expect(recordPredictions).toHaveBeenCalled();
  });

  it("normalises synonyms in categorical fields", async () => {
    const res = await predict(
      post("/api/predict", { manufacturer: "chevy", model: "Silverado 1500", year: 2017, mileage: 90000, fuel_type: "petrol", drivetrain: "4x4" }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as PredictBody;
    expect(body.vehicle.fuel_type).toBe("Gasoline");
    expect(body.vehicle.drivetrain).toBe("4WD");
  });

  it("rejects invalid input with 422 and field-level details", async () => {
    const res = await predict(post("/api/predict", { manufacturer: "Honda", model: "", year: 2099, mileage: -5, fuel_type: "steam" }));
    expect(res.status).toBe(422);
    const body = (await res.json()) as ErrorBody;
    expect(body.error).toBe("Validation failed");
    expect(body.details.map((d) => d.field)).toEqual(expect.arrayContaining(["model", "year", "mileage", "fuel_type"]));
  });

  it("rejects malformed JSON with 400", async () => {
    const res = await predict(post("/api/predict", "{not json"));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/predict/batch", () => {
  it("returns one result per vehicle", async () => {
    const res = await predictBatch(
      post("/api/predict/batch", {
        vehicles: [
          { manufacturer: "Toyota", model: "RAV4", year: 2020, mileage: 40000 },
          { manufacturer: "Ford", model: "F-150", year: 2015, mileage: 120000 },
        ],
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { count: number; results: PredictBody[] };
    expect(body.count).toBe(2);
    expect(body.results).toHaveLength(2);
  });

  it("rejects an empty batch", async () => {
    const res = await predictBatch(post("/api/predict/batch", { vehicles: [] }));
    expect(res.status).toBe(422);
  });
});

describe("GET endpoints", () => {
  it("exposes model metadata and metrics", async () => {
    const body = (await getModel().json()) as { best_model: string; models: { name: string; selected: boolean }[] };
    expect(body.models).toHaveLength(3);
    expect(body.models.find((m) => m.selected)?.name).toBe(body.best_model);
  });

  it("exposes the form options catalogue", async () => {
    const body = (await getOptions().json()) as { manufacturers: { name: string; models: unknown[] }[]; fuel_types: string[] };
    expect(body.manufacturers.length).toBeGreaterThan(10);
    expect(body.fuel_types).toContain("Electric");
  });

  it("serves an OpenAPI 3.1 document", async () => {
    const body = (await getOpenApi(new Request("http://localhost/api/openapi")).json()) as { openapi: string; paths: Record<string, unknown> };
    expect(body.openapi).toBe("3.1.0");
    expect(Object.keys(body.paths)).toEqual(expect.arrayContaining(["/api/predict", "/api/predict/batch", "/api/model"]));
  });
});
