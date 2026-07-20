import {
  resolveAnalyticsDateRange,
} from "@/features/analytics";

import {
  ExecutiveCommandCenter,
  getExecutiveDashboardProjection,
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

  const report =
    await getExecutiveDashboardProjection({
      propertyId:
        params.property ?? null,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    });

  return (
    <ExecutiveCommandCenter
      report={report}
    />
  );
}
