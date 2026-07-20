import type { AnalyticsDateRange, AnalyticsMetricProjection, DashboardMetrics } from "../types";

export const ANALYTICS_CALCULATION_VERSION = "analytics-v1";

export function buildAnalyticsMetricProjections(input: Readonly<{
  metrics: DashboardMetrics;
  dateRange: AnalyticsDateRange;
  propertyId?: string | null;
  measuredAt: string;
}>): readonly AnalyticsMetricProjection[] {
  const scope = input.propertyId ? { type: "property" as const, id: input.propertyId } : { type: "portfolio" as const, id: "portfolio" };
  const metric = (name: string, label: string, value: number, unit: AnalyticsMetricProjection["unit"]): AnalyticsMetricProjection => Object.freeze({ metric: name, label, value, unit, scope, period: Object.freeze({ ...input.dateRange }), measuredAt: input.measuredAt, calculationVersion: ANALYTICS_CALCULATION_VERSION });
  return Object.freeze([
    metric("gross-revenue", "Gross revenue", input.metrics.grossRevenue, "currency"),
    metric("room-revenue", "Room revenue", input.metrics.roomRevenue, "currency"),
    metric("occupancy-rate", "Occupancy rate", input.metrics.occupancyRate, "percentage"),
    metric("average-daily-rate", "Average daily rate", input.metrics.averageDailyRate, "currency-per-night"),
    metric("revpar", "Revenue per available night", input.metrics.revPar, "currency-per-night"),
    metric("cancellation-rate", "Cancellation rate", input.metrics.cancellationRate, "percentage"),
    metric("average-length-of-stay", "Average length of stay", input.metrics.averageLengthOfStay, "days"),
    metric("total-bookings", "Total bookings", input.metrics.totalBookings, "count"),
  ]);
}
