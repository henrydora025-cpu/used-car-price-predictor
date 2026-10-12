const usdFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const numberFormatter = new Intl.NumberFormat("en-US");

export const formatUsd = (value: number) => usdFormatter.format(Math.round(value));
export const formatNumber = (value: number) => numberFormatter.format(Math.round(value));
export const formatPercent = (value: number, digits = 1) => `${(value * 100).toFixed(digits)}%`;

export function formatCompactUsd(value: number): string {
  if (Math.abs(value) >= 1000) {
    const digits = Math.abs(value) >= 100_000 ? 0 : 1;
    return `$${(value / 1000).toFixed(digits).replace(/\.0$/, "")}k`;
  }
  return `$${Math.round(value)}`;
}

export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export const FIELD_LABELS: Record<string, string> = {
  mileage: "Mileage",
  fuel_type: "Fuel type",
  transmission: "Transmission",
  body_type: "Body type",
  drivetrain: "Drivetrain",
  engine_size: "Engine size",
  condition: "Condition",
  owners: "Owners",
  accident_history: "Accident history",
};
