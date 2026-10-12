import { z } from "zod";
import { REFERENCE_YEAR } from "@/ml/config";
import {
  normalizeAccident,
  normalizeBody,
  normalizeCondition,
  normalizeDrivetrain,
  normalizeFuel,
  normalizeTransmission,
} from "@/ml/normalize";
import { BODY_TYPES, CONDITIONS, DRIVETRAINS, FUEL_TYPES, TRANSMISSIONS } from "@/ml/schema";

/** Enum that also accepts common synonyms ("gas" → "Gasoline", "4x4" → "4WD"); "" or null = unknown. */
function lenientEnum<const T extends readonly [string, ...string[]]>(values: T, normalizer: (value: unknown) => string | null) {
  return z
    .preprocess((value) => {
      if (value === "" || value === null) return null;
      if (typeof value === "string") return normalizer(value) ?? value;
      return value;
    }, z.enum(values).nullable())
    .optional();
}

export const vehicleInputSchema = z.object({
  manufacturer: z.string().trim().min(1, "manufacturer is required").max(60),
  model: z.string().trim().min(1, "model is required").max(60),
  year: z.number().int().min(1980).max(REFERENCE_YEAR + 1),
  mileage: z.number().min(0).max(1_000_000),
  fuel_type: lenientEnum(FUEL_TYPES, normalizeFuel),
  transmission: lenientEnum(TRANSMISSIONS, normalizeTransmission),
  body_type: lenientEnum(BODY_TYPES, normalizeBody),
  drivetrain: lenientEnum(DRIVETRAINS, normalizeDrivetrain),
  engine_size: z.number().min(0).max(10).nullable().optional(),
  condition: lenientEnum(CONDITIONS, normalizeCondition),
  owners: z.number().int().min(1).max(10).nullable().optional(),
  accident_history: z
    .preprocess((value) => (typeof value === "string" ? normalizeAccident(value) ?? value : value), z.boolean().nullable())
    .optional(),
});

export type VehicleInput = z.infer<typeof vehicleInputSchema>;

export const batchInputSchema = z.object({
  vehicles: z.array(vehicleInputSchema).min(1, "provide at least one vehicle").max(100, "at most 100 vehicles per request"),
});

export function formatZodError(error: z.ZodError) {
  return error.issues.map((issue) => ({
    field: issue.path.map(String).join(".") || "(body)",
    message: issue.message,
  }));
}
