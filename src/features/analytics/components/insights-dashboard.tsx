import {
  buildDailyOccupancySeries,
  buildDailyRevenueSeries,
  generatePerformanceInsights,
} from "../lib";
import type { DashboardAnalytics } from "../types";

import { AnalyticsControls } from "./analytics-controls";
import { BookingsTable } from "./bookings-table";
import { OccupancyTrendChart } from "./occupancy-trend-chart";
import { PerformanceSummary } from "./performance-summary";
import { ReportContext } from "./report-context";
import { RevenueIntelligence } from "./revenue-intelligence";
import { RevenueTrendChart } from "./revenue-trend-chart";
import { StatsGrid } from "./stats-grid";

type InsightsDashboardProps = {
  analytics: DashboardAnalytics;
};

export function InsightsDashboard({
  analytics,
}: InsightsDashboardProps) {
  const hasProperties =
    analytics.properties.length > 0;

  const propertyCount =
    analytics.selectedPropertyId
      ? 1
      : analytics.properties.length;

  const insights = generatePerformanceInsights({
    metrics: analytics.metrics,
    comparison: analytics.comparison,
    bookings: analytics.bookings,
  });

  const revenueSeries = buildDailyRevenueSeries({
    bookings: analytics.bookings,
    dateRange: analytics.dateRange,
  });

  const occupancySeries = buildDailyOccupancySeries({
    bookings: analytics.bookings,
    dateRange: analytics.dateRange,
    propertyCount,
  });

  return (
    <div className="space-y-6">
      <AnalyticsControls
        properties={analytics.properties}
        selectedPropertyId={
          analytics.selectedPropertyId
        }
        startDate={analytics.dateRange.startDate}
        endDate={analytics.dateRange.endDate}
      />

      {!hasProperties ? (
        <EmptyState
          title="No active properties"
          description="Add or activate a property before viewing live performance analytics."
        />
      ) : (
        <>
          <ReportContext analytics={analytics} />

          <StatsGrid
            metrics={analytics.metrics}
            comparison={analytics.comparison}
          />

          <div className="grid gap-6 xl:grid-cols-2">
            <RevenueTrendChart
              data={revenueSeries}
            />

            <OccupancyTrendChart
              data={occupancySeries}
            />
          </div>

          <RevenueIntelligence
            recommendations={
              analytics.recommendations
            }
          />

          <PerformanceSummary
            insights={insights}
          />

          <BookingsTable
            bookings={analytics.bookings}
          />
        </>
      )}
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-10 text-center">
      <h2 className="text-lg font-semibold text-neutral-950">
        {title}
      </h2>

      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-neutral-500">
        {description}
      </p>
    </section>
  );
}
