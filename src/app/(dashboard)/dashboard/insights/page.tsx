import {
  getDashboardAnalytics,
  InsightsDashboard,
  resolveAnalyticsDateRange,
} from "@/features/analytics";

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

  const dateRange = resolveAnalyticsDateRange({
    startDate: params.start,
    endDate: params.end,
  });

  const analytics = await getDashboardAnalytics({
    propertyId: params.property ?? null,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });

  return (
    <main className="space-y-6">

<header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
  <div>
    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">
      Luxe Insights
    </p>

    <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">
      Property performance
    </h1>

    <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600">
      Monitor portfolio revenue, occupancy, ADR, RevPAR, and
      reservation activity using live booking data.
    </p>
  </div>

  <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
    <span className="h-2 w-2 rounded-full bg-emerald-500" />
    Live Supabase data
  </div>
</header>

      <InsightsDashboard analytics={analytics} />
    </main>
  );
}
