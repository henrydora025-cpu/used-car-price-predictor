import { REFERENCE_YEAR } from "@/ml/config";
import { BODY_TYPES, CONDITIONS, DRIVETRAINS, FUEL_TYPES, MODEL_NAMES, TRANSMISSIONS } from "@/ml/schema";

export const EXAMPLE_VEHICLE = {
  manufacturer: "Toyota",
  model: "RAV4",
  year: 2020,
  mileage: 45000,
  fuel_type: "Hybrid",
  transmission: "Automatic",
  body_type: "SUV",
  drivetrain: "AWD",
  engine_size: 2.5,
  condition: "Good",
  owners: 1,
  accident_history: false,
} as const;

const nullableEnum = (values: readonly string[], description: string) => ({
  type: ["string", "null"],
  enum: [...values, null],
  description,
});

/** OpenAPI 3.1 description of the public API (served at /api/openapi). */
export function buildOpenApiSpec(serverUrl?: string) {
  const vehicleInput = {
    type: "object",
    required: ["manufacturer", "model", "year", "mileage"],
    properties: {
      manufacturer: { type: "string", example: "Toyota", description: "Case-insensitive; aliases such as 'Chevy' or 'VW' are accepted." },
      model: { type: "string", example: "RAV4" },
      year: { type: "integer", minimum: 1980, maximum: REFERENCE_YEAR + 1, example: 2020 },
      mileage: { type: "number", minimum: 0, maximum: 1000000, example: 45000, description: "Odometer reading in miles." },
      fuel_type: nullableEnum(FUEL_TYPES, "Synonyms like 'gas', 'petrol', 'EV' are normalised. Omit/null → imputed."),
      transmission: nullableEnum(TRANSMISSIONS, "Synonyms like 'auto', 'stick', 'CVT' are normalised. Omit/null → imputed."),
      body_type: nullableEnum(BODY_TYPES, "Omit/null → most common body type of the model."),
      drivetrain: nullableEnum(DRIVETRAINS, "'4x4' → 4WD, 'all-wheel drive' → AWD. Omit/null → imputed."),
      engine_size: { type: ["number", "null"], minimum: 0, maximum: 10, description: "Litres (0 for electric). Omit/null → imputed." },
      condition: nullableEnum(CONDITIONS, "Omit/null → typical condition for the vehicle age."),
      owners: { type: ["integer", "null"], minimum: 1, maximum: 10, description: "Number of previous owners." },
      accident_history: { type: ["boolean", "null"], description: "Reported accident on the vehicle history report." },
    },
  };

  const modelPrices = Object.fromEntries(MODEL_NAMES.map((name) => [name, { type: "integer" }]));

  const predictionResult = {
    type: "object",
    properties: {
      estimated_price: { type: "integer", description: "Point estimate (USD) from the selected model." },
      currency: { type: "string", enum: ["USD"] },
      price_range: {
        type: "object",
        description: "80% prediction interval calibrated on out-of-fold residuals.",
        properties: { low: { type: "integer" }, high: { type: "integer" }, confidence: { type: "number" } },
      },
      model_used: { type: "string", enum: [...MODEL_NAMES] },
      model_label: { type: "string" },
      model_version: { type: "string" },
      model_predictions: { type: "object", properties: modelPrices, description: "Estimates of all three models." },
      vehicle: { type: "object", description: "The canonical, fully imputed vehicle used for the prediction." },
      imputed_fields: { type: "array", items: { type: "string" } },
      warnings: { type: "array", items: { type: "string" } },
      depreciation_forecast: {
        type: "array",
        items: {
          type: "object",
          properties: {
            year: { type: "integer" },
            vehicle_age: { type: "integer" },
            mileage: { type: "integer" },
            estimated_price: { type: "integer" },
          },
        },
      },
    },
  };

  const validationError = {
    type: "object",
    properties: {
      error: { type: "string", example: "Validation failed" },
      details: {
        type: "array",
        items: { type: "object", properties: { field: { type: "string" }, message: { type: "string" } } },
      },
    },
  };

  return {
    openapi: "3.1.0",
    info: {
      title: "CarValue ML — Used Car Price Prediction API",
      version: "1.0.0",
      description:
        "Predicts the market price of a used car from its manufacturer, model, year, mileage, fuel type, transmission and other characteristics. Three models (Linear Regression, Random Forest, Gradient Boosting) are trained and compared; the best one by cross-validated RMSE serves the estimate.",
    },
    servers: serverUrl ? [{ url: serverUrl }] : [],
    tags: [
      { name: "Prediction", description: "Price estimates" },
      { name: "Model", description: "Model metadata, metrics and options" },
      { name: "Monitoring", description: "Health and prediction logs" },
    ],
    paths: {
      "/api/predict": {
        post: {
          tags: ["Prediction"],
          summary: "Estimate the price of one vehicle",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/VehicleInput" }, example: EXAMPLE_VEHICLE } },
          },
          responses: {
            "200": { description: "Price estimate", content: { "application/json": { schema: { $ref: "#/components/schemas/PredictionResult" } } } },
            "400": { description: "Body is not valid JSON" },
            "422": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } } },
          },
        },
      },
      "/api/predict/batch": {
        post: {
          tags: ["Prediction"],
          summary: "Estimate prices for up to 100 vehicles",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["vehicles"],
                  properties: { vehicles: { type: "array", maxItems: 100, items: { $ref: "#/components/schemas/VehicleInput" } } },
                },
                example: { vehicles: [EXAMPLE_VEHICLE, { manufacturer: "Ford", model: "F-150", year: 2015, mileage: 120000 }] },
              },
            },
          },
          responses: {
            "200": {
              description: "One result per vehicle, in order",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { count: { type: "integer" }, results: { type: "array", items: { $ref: "#/components/schemas/PredictionResult" } } },
                  },
                },
              },
            },
            "422": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } } },
          },
        },
      },
      "/api/model": {
        get: {
          tags: ["Model"],
          summary: "Model version, selection rationale, CV & test metrics, feature importance",
          responses: { "200": { description: "Model summary" } },
        },
      },
      "/api/options": {
        get: {
          tags: ["Model"],
          summary: "Valid categories and the manufacturer → model catalogue",
          responses: { "200": { description: "Options used by the web form" } },
        },
      },
      "/api/predictions": {
        get: {
          tags: ["Monitoring"],
          summary: "Most recent logged predictions",
          parameters: [{ name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 10 } }],
          responses: { "200": { description: "Recent predictions with totals" } },
        },
      },
      "/api/health": {
        get: {
          tags: ["Monitoring"],
          summary: "Liveness/readiness: database connectivity and loaded model version",
          responses: { "200": { description: "Healthy" }, "500": { description: "Unhealthy" } },
        },
      },
    },
    components: {
      schemas: { VehicleInput: vehicleInput, PredictionResult: predictionResult, ValidationError: validationError },
    },
  };
}
