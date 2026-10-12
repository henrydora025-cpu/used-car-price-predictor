"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Predict" },
  { href: "/insights", label: "Model insights" },
  { href: "/docs", label: "API docs" },
];

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-linear-to-br from-indigo-600 to-violet-600 text-white shadow-sm">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path d="M5 17h14M6.5 17a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm14 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0ZM3.5 17v-4l2-5h13l2 5v4M5.5 13h13" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="text-base font-semibold tracking-tight text-slate-900">
            CarValue <span className="text-indigo-600">ML</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          {LINKS.map((link) => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-2.5 py-2 text-sm font-medium transition sm:px-3 ${
                  active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
