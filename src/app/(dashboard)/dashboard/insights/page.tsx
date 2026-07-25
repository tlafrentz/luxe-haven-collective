import {
  resolveAnalyticsDateRange,
} from "@/features/analytics";

import {
  getRevenueIntelligence,
  RevenueIntelligenceDashboard,
} from "@/features/revenue-intelligence";
import { WorkspaceHeader, WorkspacePage } from "@/components/application-layout";

type InsightsPageProps = {
  searchParams: Promise<{
    property?: string;
    start?: string;
    end?: string;
  }>;
};

export default async function InsightsPage({
  searchParams,
}: InsightsPageProps) {
  const params = await searchParams;

  const dateRange =
    resolveAnalyticsDateRange({
      startDate: params.start,
      endDate: params.end,
    });

  const intelligence =
    await getRevenueIntelligence({
      propertyId:
        params.property ?? null,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    });

  return (
    <WorkspacePage className="space-y-6">
      <WorkspaceHeader
        eyebrow="Observe"
        title="Revenue Intelligence"
        description="Monitor revenue, occupancy, and booking performance, then review the opportunities that need attention."
        context={<div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Live intelligence engine
        </div>}
      />

      <RevenueIntelligenceDashboard
        intelligence={intelligence}
      />
    </WorkspacePage>
  );
}
