import { getModelArtifact } from "@/lib/model-store";
import { recordPredictions } from "@/lib/prediction-log";
import { batchInputSchema, formatZodError } from "@/lib/validation";
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

  const parsed = batchInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Validation failed", details: formatZodError(parsed.error) }, { status: 422 });
  }

  const artifact = getModelArtifact();
  const results = parsed.data.vehicles.map((vehicle) => predictPrice(artifact, vehicle));
  await recordPredictions(results.map((result, i) => ({ source: "batch", input: parsed.data.vehicles[i], result })));
  return Response.json({ count: results.length, results });
}
