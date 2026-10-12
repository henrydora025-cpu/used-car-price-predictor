import { index, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Every prediction served by the API is logged for monitoring (input drift, usage, model versions).
 */
export const predictions = pgTable(
  "predictions",
  {
    id: serial("id").primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    source: text("source").notNull().default("web"),
    manufacturer: text("manufacturer").notNull(),
    model: text("model").notNull(),
    year: integer("year").notNull(),
    mileage: integer("mileage").notNull(),
    fuelType: text("fuel_type").notNull(),
    transmission: text("transmission").notNull(),
    input: jsonb("input").$type<Record<string, unknown>>().notNull(),
    estimatedPrice: integer("estimated_price").notNull(),
    priceLow: integer("price_low").notNull(),
    priceHigh: integer("price_high").notNull(),
    modelName: text("model_name").notNull(),
    modelVersion: text("model_version").notNull(),
  },
  (table) => [index("predictions_created_at_idx").on(table.createdAt)],
);

export type PredictionRow = typeof predictions.$inferSelect;
export type NewPredictionRow = typeof predictions.$inferInsert;
