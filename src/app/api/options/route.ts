import { getVehicleOptions } from "@/lib/model-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(getVehicleOptions());
}
