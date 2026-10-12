import type { ReactNode } from "react";

export function Card({ title, subtitle, children, className = "", action }: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <div className={`rounded-3xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h3 className="text-base font-semibold text-slate-900">{title}</h3>}
            {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function Stat({ label, value, hint, tone = "light" }: { label: string; value: string; hint?: string; tone?: "light" | "dark" }) {
  const dark = tone === "dark";
  return (
    <div className={`rounded-2xl p-4 ${dark ? "border border-white/10 bg-white/5" : "border border-slate-200 bg-white shadow-sm"}`}>
      <dt className={`text-xs font-medium uppercase tracking-wide ${dark ? "text-slate-400" : "text-slate-500"}`}>{label}</dt>
      <dd className={`mt-1.5 text-2xl font-semibold tracking-tight ${dark ? "text-white" : "text-slate-900"}`}>{value}</dd>
      {hint && <p className={`mt-1 text-xs ${dark ? "text-slate-400" : "text-slate-500"}`}>{hint}</p>}
    </div>
  );
}

export function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <div className="mb-6 max-w-3xl">
      <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{title}</h2>
      {description && <p className="mt-2 text-slate-600">{description}</p>}
    </div>
  );
}

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "indigo" | "emerald" | "amber" | "rose" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
    rose: "bg-rose-50 text-rose-700 ring-rose-200",
  } as const;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function CodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-slate-950 ring-1 ring-slate-800">
      {label && <div className="border-b border-slate-800 px-4 py-2 text-xs font-medium text-slate-400">{label}</div>}
      <pre className="max-h-[28rem] overflow-auto p-4 text-[12.5px] leading-relaxed text-slate-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}
