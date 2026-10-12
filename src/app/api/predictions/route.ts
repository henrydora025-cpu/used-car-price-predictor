import { listRecentPredictions } from "@/lib/prediction-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const raw = Number(new URL(request.url).searchParams.get("limit") ?? 10);
  const limit = Number.isFinite(raw) ? Math.min(100, Math.max(1, Math.round(raw))) : 10;
  return Response.json(await listRecentPredictions(limit));
}
