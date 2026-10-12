import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getModelArtifact } from "@/lib/model-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let database = false;
  let model: { version: string; best_model: string } | null = null;
  try {
    await db.execute(sql`select 1`);
    database = true;
  } catch {
    database = false;
  }
  try {
    const artifact = getModelArtifact();
    model = { version: artifact.version, best_model: artifact.bestModel };
  } catch {
    model = null;
  }
  const ok = database && model !== null;
  return Response.json({ ok, database, model }, { status: ok ? 200 : 500 });
}
