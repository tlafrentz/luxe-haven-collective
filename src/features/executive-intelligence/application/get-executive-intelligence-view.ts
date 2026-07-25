import { getCurrentHpmLifecycleProjection, type CurrentHpmLifecycleResult, type CurrentHpmQuery } from "@/features/hpm";

import type { ExecutiveIntelligenceView } from "../domain";
import { buildExecutiveIntelligenceView } from "./build-executive-intelligence-view";

export type ExecutiveIntelligenceViewResult = Readonly<{
  view: ExecutiveIntelligenceView;
  lifecycleResult: CurrentHpmLifecycleResult;
}>;

export async function getExecutiveIntelligenceView(
  query: CurrentHpmQuery,
  getLifecycle: (query: CurrentHpmQuery) => Promise<CurrentHpmLifecycleResult> = getCurrentHpmLifecycleProjection,
): Promise<ExecutiveIntelligenceViewResult> {
  const lifecycleResult = await getLifecycle(query);
  const analytics = lifecycleResult.context.analytics;
  const revenueUnavailable =
    analytics.metrics.grossRevenue === 0 &&
    analytics.metrics.totalBookings > 0 &&
    (analytics.metrics.roomRevenue > 0 || analytics.metrics.averageDailyRate > 0);
  return Object.freeze({
    view: buildExecutiveIntelligenceView(lifecycleResult.lifecycle, {
      scope: Object.freeze({
        properties: Object.freeze(lifecycleResult.context.analytics.properties.map((value) => Object.freeze({ ...value }))),
        selectedProperty: lifecycleResult.context.analytics.selectedProperty
          ? Object.freeze({ ...lifecycleResult.context.analytics.selectedProperty }) : null,
        propertyCount: lifecycleResult.context.analytics.selectedProperty ? 1 : lifecycleResult.context.analytics.properties.length,
        startDate: lifecycleResult.context.analytics.dateRange.startDate,
        endDate: lifecycleResult.context.analytics.dateRange.endDate,
        scopeKnown: true,
      }),
      performance: Object.freeze({
        available: true,
        grossRevenue: metric(revenueUnavailable ? null : lifecycleResult.context.analytics.metrics.grossRevenue, lifecycleResult.context.analytics.comparison.revenue),
        occupancyRate: metric(lifecycleResult.context.analytics.metrics.occupancyRate, lifecycleResult.context.analytics.comparison.occupancy),
        averageDailyRate: metric(lifecycleResult.context.analytics.metrics.averageDailyRate, lifecycleResult.context.analytics.comparison.adr),
        revPar: metric(lifecycleResult.context.analytics.metrics.revPar, lifecycleResult.context.analytics.comparison.revPar),
        totalBookings: lifecycleResult.context.analytics.metrics.totalBookings,
        upcomingBookings: lifecycleResult.context.analytics.metrics.upcomingBookings,
      }),
    }),
    lifecycleResult,
  });
}

function metric(value: number | null, trend: Readonly<{ percentChange: number; direction: "up" | "down" | "neutral"; status?: "available" | "new-measurement" | "unavailable" }>) {
  return Object.freeze({
    value,
    trend: value === null || (trend.status && trend.status !== "available")
      ? null
      : Object.freeze({ percentChange: trend.percentChange, direction: trend.direction }),
  });
}
