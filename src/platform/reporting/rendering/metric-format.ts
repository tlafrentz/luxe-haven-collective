import type { ReportMetric } from "../domain";

const currencyKeys = new Set(["gross-revenue", "revenue", "adr", "revpar", "noi", "cash-flow", "market-adr"]);
const percentageKeys = new Set(["occupancy", "operating-margin", "market-occupancy"]);
const labels: Record<string, string> = { adr: "ADR", revpar: "RevPAR", noi: "NOI" };

export function reportMetricLabel(metric: ReportMetric) {
  return labels[metric.key] ?? metric.label.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function reportMetricDisplay(metric: ReportMetric) {
  if (metric.displayValue === "Unavailable") return metric.displayValue;
  const numeric = typeof metric.rawValue === "number" ? metric.rawValue : Number(metric.displayValue.replace(/[$,%\s]/g, ""));
  if (!Number.isFinite(numeric)) return metric.displayValue;
  if (currencyKeys.has(metric.key)) return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(numeric);
  if (percentageKeys.has(metric.key)) return `${(numeric <= 1 ? numeric * 100 : numeric).toFixed(2)}%`;
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: Number.isInteger(numeric) ? 0 : 2, maximumFractionDigits: 2 }).format(numeric);
}
