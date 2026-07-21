import {
  resolveAnalyticsDateRange,
} from "@/features/analytics";

import {
  ExecutiveCommandCenter,
  getExecutiveIntelligenceView,
} from "@/features/executive-intelligence";

type OwnerDashboardPageProps = {
  searchParams: Promise<{
    property?: string;
    start?: string;
    end?: string;
  }>;
};

export default async function OwnerDashboardPage({
  searchParams,
}: OwnerDashboardPageProps) {
  const params = await searchParams;

  const dateRange =
    resolveAnalyticsDateRange({
      startDate: params.start,
      endDate: params.end,
    });

  const result =
    await getExecutiveIntelligenceView({
      propertyId:
        params.property ?? null,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    });

  return (
    <ExecutiveCommandCenter
      view={result.view}
    />
  );
}
