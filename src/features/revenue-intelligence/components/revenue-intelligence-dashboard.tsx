import {
  AnalyticsControls,
  BookingsTable,
  OccupancyTrendChart,
  PerformanceSummary,
  ReportContext,
  RevenueTrendChart,
  StatsGrid,
  buildDailyRevenueSeries,
  generatePerformanceInsights,
} from "@/features/analytics";

import type {
  RevenueIntelligence,
} from "../types";

import {
  toDashboardAnalytics,
} from "../adapters/to-dashboard-analytics";

import {
  OpportunityIntelligence,
} from "./opportunity-intelligence";

type RevenueIntelligenceDashboardProps = {
  intelligence: RevenueIntelligence;
};

export function RevenueIntelligenceDashboard({
  intelligence,
}: RevenueIntelligenceDashboardProps) {
  const analytics =
    toDashboardAnalytics(intelligence);

  const hasProperties =
    analytics.properties.length > 0;

  const insights =
    generatePerformanceInsights({
      metrics: analytics.metrics,
      comparison: analytics.comparison,
      bookings: analytics.bookings,
    });

  const revenueSeries =
    buildDailyRevenueSeries({
      bookings: analytics.bookings,
      dateRange: analytics.dateRange,
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
          description="Add or activate a property before viewing live performance intelligence."
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
              data={
                intelligence.occupancySeries
              }
            />
          </div>

          <OpportunityIntelligence
            report={
              intelligence.opportunityReport
            }
          />

          <PerformanceSummary
            insights={insights}
          />

          <BookingsTable
            bookings={intelligence.bookings}
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
