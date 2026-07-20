import type { AnalyticsPerformanceSummary, DashboardComparison, DashboardMetrics } from "../types";

/** Describes measured change without thresholds, judgment, priority, or advice. */
export function buildPerformanceSummaries(
  metrics: DashboardMetrics,
  comparison: DashboardComparison,
): readonly AnalyticsPerformanceSummary[] {
  return Object.freeze([
    summary("revenue", "Gross revenue", metrics.grossRevenue, comparison.revenue.percentChange, "currency"),
    summary("occupancy", "Occupancy", metrics.occupancyRate, comparison.occupancy.percentChange, "percentage"),
    summary("adr", "Average daily rate", metrics.averageDailyRate, comparison.adr.percentChange, "currency"),
    summary("revpar", "RevPAR", metrics.revPar, comparison.revPar.percentChange, "currency"),
  ]);
}

function summary(id: string, label: string, value: number, change: number, unit: "currency" | "percentage"): AnalyticsPerformanceSummary {
  const direction = change > 0 ? "increased" : change < 0 ? "decreased" : "was unchanged";
  const formattedValue = unit === "currency" ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value) : `${value.toFixed(1)}%`;
  return Object.freeze({
    id: `${id}-comparison`,
    title: `${label} ${direction}`,
    description: `${label} was ${formattedValue} and ${direction}${change === 0 ? "" : ` ${Math.abs(change).toFixed(1)}%`} versus the previous period.`,
    tone: change > 0 ? "positive" : change < 0 ? "negative" : "neutral",
  });
}
