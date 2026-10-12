import { buildOpenApiSpec } from "@/lib/openapi";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return Response.json(buildOpenApiSpec(new URL(request.url).origin));
}
