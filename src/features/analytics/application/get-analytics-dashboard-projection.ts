import { buildDailyOccupancySeries, buildDailyRevenueSeries, calculateDashboardMetrics, calculateTrend, getAnalyticsBookings, getAnalyticsProperties, getPreviousDateRange } from "../lib";
import { buildAnalyticsMetricProjections } from "../lib/metric-projections";
import { buildPerformanceSummaries } from "../lib/performance-summaries";
import type { AnalyticsDashboardProjection, AnalyticsQueryParams, DashboardComparison } from "../types";

/** Single factual projection service for Analytics dashboard consumers. */
export async function getAnalyticsDashboardProjection({
  propertyId,
  startDate,
  endDate,
  generatedAt = new Date().toISOString(),
}: AnalyticsQueryParams & { generatedAt?: string }): Promise<AnalyticsDashboardProjection> {
  const properties = await getAnalyticsProperties();
  const selectedProperty = propertyId ? properties.find((value) => value.id === propertyId) ?? null : null;
  const selectedPropertyId = selectedProperty?.id ?? null;
  const dateRange = { startDate, endDate };
  const previousDateRange = getPreviousDateRange(dateRange);
  const [bookings, previousBookings] = await Promise.all([
    getAnalyticsBookings({ propertyId: selectedPropertyId, ...dateRange }),
    getAnalyticsBookings({ propertyId: selectedPropertyId, ...previousDateRange }),
  ]);
  const propertyCount = selectedPropertyId ? 1 : properties.length;
  const metrics = calculateDashboardMetrics({ bookings, propertyCount, dateRange });
  const previousMetrics = calculateDashboardMetrics({ bookings: previousBookings, propertyCount, dateRange: previousDateRange });
  const comparison: DashboardComparison = {
    revenue: calculateTrend(metrics.grossRevenue, previousMetrics.grossRevenue),
    occupancy: calculateTrend(metrics.occupancyRate, previousMetrics.occupancyRate),
    adr: calculateTrend(metrics.averageDailyRate, previousMetrics.averageDailyRate),
    revPar: calculateTrend(metrics.revPar, previousMetrics.revPar),
  };
  return Object.freeze({
    generatedAt,
    dateRange,
    previousDateRange,
    selectedProperty,
    properties: Object.freeze(properties),
    metrics,
    previousMetrics,
    comparison,
    revenueSeries: Object.freeze(buildDailyRevenueSeries({ bookings, dateRange })),
    occupancySeries: Object.freeze(buildDailyOccupancySeries({ bookings, dateRange, propertyCount })),
    bookings: Object.freeze(bookings),
    summaries: buildPerformanceSummaries(metrics, comparison),
    metricProjections: buildAnalyticsMetricProjections({ metrics, dateRange, propertyId: selectedPropertyId, measuredAt: generatedAt }),
  });
}
