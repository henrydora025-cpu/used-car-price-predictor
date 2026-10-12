import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { predictions } from "@/db/schema";
import type { PredictionResult } from "@/ml/predict";

// Idempotent safety net so a fresh database works even before `drizzle-kit push` has run.
const CREATE_TABLE = `CREATE TABLE IF NOT EXISTS "predictions" (
  "id" serial PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "source" text DEFAULT 'web' NOT NULL,
  "manufacturer" text NOT NULL,
  "model" text NOT NULL,
  "year" integer NOT NULL,
  "mileage" integer NOT NULL,
  "fuel_type" text NOT NULL,
  "transmission" text NOT NULL,
  "input" jsonb NOT NULL,
  "estimated_price" integer NOT NULL,
  "price_low" integer NOT NULL,
  "price_high" integer NOT NULL,
  "model_name" text NOT NULL,
  "model_version" text NOT NULL
)`;
const CREATE_INDEX = `CREATE INDEX IF NOT EXISTS "predictions_created_at_idx" ON "predictions" USING btree ("created_at")`;

let ready: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await db.execute(sql.raw(CREATE_TABLE));
      await db.execute(sql.raw(CREATE_INDEX));
    })().catch((error: unknown) => {
      ready = null;
      throw error;
    });
  }
  return ready;
}

export type PredictionSource = "web" | "api" | "batch";

export interface PredictionLogEntry {
  source: PredictionSource;
  input: Record<string, unknown>;
  result: PredictionResult;
}

/** Logs predictions; never throws (serving a price matters more than logging it). */
export async function recordPredictions(entries: PredictionLogEntry[]): Promise<boolean> {
  if (entries.length === 0) return true;
  try {
    await ensureTable();
    await db.insert(predictions).values(
      entries.map(({ source, input, result }) => ({
        source,
        manufacturer: result.vehicle.manufacturer,
        model: result.vehicle.model,
        year: result.vehicle.year,
        mileage: Math.round(result.vehicle.mileage),
        fuelType: result.vehicle.fuel_type,
        transmission: result.vehicle.transmission,
        input,
        estimatedPrice: result.estimated_price,
        priceLow: result.price_range.low,
        priceHigh: result.price_range.high,
        modelName: result.model_used,
        modelVersion: result.model_version,
      })),
    );
    return true;
  } catch (error) {
    console.error("[prediction-log] failed to record prediction", error);
    return false;
  }
}

export interface RecentPrediction {
  id: number;
  created_at: string;
  source: string;
  manufacturer: string;
  model: string;
  year: number;
  mileage: number;
  fuel_type: string;
  transmission: string;
  estimated_price: number;
  price_low: number;
  price_high: number;
  model_name: string;
  model_version: string;
}

export interface RecentPredictions {
  items: RecentPrediction[];
  total: number;
  average_price: number;
}

export async function listRecentPredictions(limit = 10): Promise<RecentPredictions> {
  try {
    await ensureTable();
    const rows = await db.select().from(predictions).orderBy(desc(predictions.createdAt)).limit(limit);
    const [stats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        average: sql<number>`coalesce(avg(${predictions.estimatedPrice}), 0)::float8`,
      })
      .from(predictions);
    return {
      items: rows.map((r) => ({
        id: r.id,
        created_at: r.createdAt.toISOString(),
        source: r.source,
        manufacturer: r.manufacturer,
        model: r.model,
        year: r.year,
        mileage: r.mileage,
        fuel_type: r.fuelType,
        transmission: r.transmission,
        estimated_price: r.estimatedPrice,
        price_low: r.priceLow,
        price_high: r.priceHigh,
        model_name: r.modelName,
        model_version: r.modelVersion,
      })),
      total: Number(stats?.total ?? 0),
      average_price: Math.round(Number(stats?.average ?? 0)),
    };
  } catch (error) {
    console.error("[prediction-log] failed to list predictions", error);
    return { items: [], total: 0, average_price: 0 };
  }
}
