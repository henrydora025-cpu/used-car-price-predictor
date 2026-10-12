import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "CarValue ML — Used Car Price Predictor", template: "%s · CarValue ML" },
  description:
    "End-to-end machine learning project: data cleaning, Linear Regression vs Random Forest vs Gradient Boosting, a validated prediction API and a web interface to estimate used car prices.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <SiteHeader />
        {children}
        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p>
              <span className="font-semibold text-slate-700">CarValue ML</span> — an end-to-end machine learning portfolio project.
            </p>
            <p>Estimates are statistical predictions from a simulated marketplace dataset, not financial advice.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
