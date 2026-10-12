import { getModelArtifact } from "@/lib/model-store";
import { recordPredictions } from "@/lib/prediction-log";
import { formatZodError, vehicleInputSchema } from "@/lib/validation";
import { predictPrice } from "@/ml/predict";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const parsed = vehicleInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Validation failed", details: formatZodError(parsed.error) }, { status: 422 });
  }

  const result = predictPrice(getModelArtifact(), parsed.data);
  const source = request.headers.get("x-client") === "web" ? "web" : "api";
  await recordPredictions([{ source, input: parsed.data, result }]);
  return Response.json(result);
}
