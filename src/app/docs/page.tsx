import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, CodeBlock } from "@/components/ui";
import { getModelArtifact, getModelSummary } from "@/lib/model-store";
import { buildOpenApiSpec, EXAMPLE_VEHICLE } from "@/lib/openapi";
import { predictPrice } from "@/ml/predict";

export const metadata: Metadata = { title: "API docs" };

type PropertySpec = {
  type: string | string[];
  enum?: (string | null)[];
  description?: string;
  minimum?: number;
  maximum?: number;
  example?: unknown;
};

function MethodBadge({ method }: { method: string }) {
  const tone = method === "POST" ? "bg-emerald-600" : "bg-sky-600";
  return <span className={`rounded-md px-2 py-0.5 font-mono text-xs font-bold text-white ${tone}`}>{method}</span>;
}

export default function DocsPage() {
  const artifact = getModelArtifact();
  const summary = getModelSummary(artifact);
  const example = predictPrice(artifact, EXAMPLE_VEHICLE);
  const spec = buildOpenApiSpec();
  const schema = spec.components.schemas.VehicleInput;
  const properties = schema.properties as Record<string, PropertySpec>;
  const required = new Set<string>(schema.required);
  const minimal = { manufacturer: "Ford", model: "F-150", year: 2015, mileage: 120000 };

  const endpoints = [
    {
      method: "POST",
      path: "/api/predict",
      title: "Estimate the price of one vehicle",
      description:
        "Validates the input (synonyms such as 'gas', 'auto' or '4x4' are normalised), imputes optional fields, runs all three models and returns the selected model's estimate with an 80% range and a 5-year forecast.",
      request: JSON.stringify(EXAMPLE_VEHICLE, null, 2),
      response: JSON.stringify(example, null, 2),
    },
    {
      method: "POST",
      path: "/api/predict/batch",
      title: "Estimate up to 100 vehicles",
      description: "Same contract as /api/predict for a list of vehicles. Results are returned in input order.",
      request: JSON.stringify({ vehicles: [EXAMPLE_VEHICLE, minimal] }, null, 2),
      response: `{\n  "count": 2,\n  "results": [ { "estimated_price": ${example.estimated_price}, ... }, { ... } ]\n}`,
    },
    {
      method: "GET",
      path: "/api/model",
      title: "Model metadata & metrics",
      description: "Version, selection rationale, cross-validation and test metrics, hyper-parameters and feature importance of the deployed model.",
      response: JSON.stringify(
        { version: summary.version, best_model: summary.best_model, selection: summary.selection, models: [summary.models.find((m) => m.selected)], "...": "…" },
        null,
        2,
      ),
    },
    {
      method: "GET",
      path: "/api/options",
      title: "Valid categories & catalogue",
      description: "Allowed values for categorical fields and the manufacturer → model catalogue (years, body types, typical engines) used by the web form.",
    },
    {
      method: "GET",
      path: "/api/predictions?limit=10",
      title: "Recent predictions (monitoring)",
      description: "Most recent requests logged in PostgreSQL with totals — useful for monitoring usage and input drift.",
    },
    {
      method: "GET",
      path: "/api/health",
      title: "Health check",
      description: "Returns 200 when the database is reachable and the model artifact is loaded.",
      response: JSON.stringify({ ok: true, database: true, model: { version: summary.version, best_model: summary.best_model } }, null, 2),
    },
    {
      method: "GET",
      path: "/api/openapi",
      title: "OpenAPI 3.1 specification",
      description: "Machine-readable contract — import it into Swagger UI, Postman, Insomnia or a client generator.",
    },
  ];

  return (
    <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <header className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">API documentation</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Prediction API</h1>
        <p className="mt-3 text-slate-600">
          JSON over HTTP, no authentication required for the demo. All prices are in USD. The full machine-readable contract is available at{" "}
          <Link href="/api/openapi" className="font-medium text-indigo-600 hover:text-indigo-500">/api/openapi</Link>.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone="indigo">OpenAPI 3.1</Badge>
          <Badge>Model v{summary.version}</Badge>
          <Badge tone="emerald">Validation with Zod</Badge>
        </div>
      </header>

      <div className="mt-10 grid gap-8 lg:grid-cols-12">
        <aside className="hidden lg:col-span-3 lg:block">
          <nav className="sticky top-24 space-y-1 text-sm">
            {endpoints.map((e) => (
              <a key={e.path} href={`#${e.path.replace(/[^a-z]/g, "-")}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                <span className={`w-10 font-mono text-[10px] font-bold ${e.method === "POST" ? "text-emerald-600" : "text-sky-600"}`}>{e.method}</span>
                <span className="truncate font-mono text-xs">{e.path.split("?")[0]}</span>
              </a>
            ))}
            <a href="#fields" className="block rounded-lg px-2 py-1.5 text-slate-600 hover:bg-slate-100">Input fields</a>
            <a href="#errors" className="block rounded-lg px-2 py-1.5 text-slate-600 hover:bg-slate-100">Errors</a>
            <a href="#deployment" className="block rounded-lg px-2 py-1.5 text-slate-600 hover:bg-slate-100">Run & deploy</a>
          </nav>
        </aside>

        <div className="space-y-8 lg:col-span-9">
          <Card title="Quick start">
            <CodeBlock
              label="cURL"
              code={`curl -X POST https://<your-host>/api/predict \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(minimal)}'`}
            />
            <p className="mt-3 text-sm text-slate-600">
              Only <code className="rounded bg-slate-100 px-1">manufacturer</code>, <code className="rounded bg-slate-100 px-1">model</code>,{" "}
              <code className="rounded bg-slate-100 px-1">year</code> and <code className="rounded bg-slate-100 px-1">mileage</code> are required; every
              other characteristic is imputed when omitted and reported in <code className="rounded bg-slate-100 px-1">imputed_fields</code>.
            </p>
          </Card>

          {endpoints.map((e) => (
            <section key={e.path} id={e.path.replace(/[^a-z]/g, "-")} className="scroll-mt-24">
              <Card>
                <div className="flex flex-wrap items-center gap-3">
                  <MethodBadge method={e.method} />
                  <code className="font-mono text-sm font-semibold text-slate-900">{e.path}</code>
                </div>
                <h2 className="mt-3 text-lg font-semibold text-slate-900">{e.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{e.description}</p>
                {(e.request || e.response) && (
                  <div className={`mt-4 grid gap-4 ${e.request && e.response ? "xl:grid-cols-2" : ""}`}>
                    {e.request && <CodeBlock label="Request body" code={e.request} />}
                    {e.response && <CodeBlock label="Response · 200" code={e.response} />}
                  </div>
                )}
              </Card>
            </section>
          ))}

          <section id="fields" className="scroll-mt-24">
            <Card title="Input fields" subtitle="VehicleInput schema">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-4 font-medium">Field</th>
                      <th className="py-2 pr-4 font-medium">Type</th>
                      <th className="py-2 pr-4 font-medium">Allowed values</th>
                      <th className="py-2 font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(properties).map(([name, p]) => (
                      <tr key={name} className="border-b border-slate-100 align-top last:border-0">
                        <td className="py-2.5 pr-4">
                          <code className="font-mono text-xs font-semibold text-slate-900">{name}</code>
                          {required.has(name) && <span className="ml-2 text-[11px] font-medium text-rose-600">required</span>}
                        </td>
                        <td className="py-2.5 pr-4 font-mono text-xs text-slate-600">{Array.isArray(p.type) ? p.type.join(" | ") : p.type}</td>
                        <td className="py-2.5 pr-4 text-xs text-slate-600">
                          {p.enum
                            ? p.enum.filter((v): v is string => v !== null).join(", ")
                            : p.minimum !== undefined
                              ? `${p.minimum} – ${p.maximum}`
                              : "—"}
                        </td>
                        <td className="py-2.5 text-xs text-slate-500">{p.description ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </section>

          <section id="errors" className="scroll-mt-24">
            <Card title="Errors" subtitle="Invalid JSON returns 400; schema violations return 422 with one entry per problem.">
              <CodeBlock
                label="Response · 422"
                code={JSON.stringify(
                  {
                    error: "Validation failed",
                    details: [
                      { field: "year", message: "Too big: expected number to be <=2027" },
                      { field: "fuel_type", message: 'Invalid option: expected one of "Gasoline"|"Diesel"|"Hybrid"|"Electric"' },
                    ],
                  },
                  null,
                  2,
                )}
              />
            </Card>
          </section>

          <section id="deployment" className="scroll-mt-24">
            <Card title="Run, test & deploy">
              <div className="grid gap-4 xl:grid-cols-2">
                <CodeBlock
                  label="Local development (Node 20+)"
                  code={`npm install\nnpm run data:generate   # raw dataset with realistic quality issues\nnpm run train           # clean → CV → select → models/car_price_model.json\nnpm test                # unit + API tests (Vitest)\nnpm run dev             # http://localhost:3000`}
                />
                <CodeBlock
                  label="Docker"
                  code={`# Web app + API + PostgreSQL\ndocker compose up --build\n# → http://localhost:3000\n\n# Python stack: FastAPI + Streamlit\ncd python && docker compose up --build\n# → http://localhost:8000/docs · http://localhost:8501`}
                />
              </div>
            </Card>
          </section>
        </div>
      </div>
    </main>
  );
}
