import {
  resolveAnalyticsDateRange,
} from "@/features/analytics";

import {
  getRevenueIntelligence,
  RevenueIntelligenceDashboard,
} from "@/features/revenue-intelligence";
import { WorkspacePage } from "@/components/application-layout";
import { getRelevantLearning } from "@/app/actions/platform-learning-workspace";
import { RelevantLearningPanel } from "@/components/learning/relevant-learning-panel";

type InsightsPageProps = {
  searchParams: Promise<{
    property?: string;
    start?: string;
    end?: string;
    from?: string;
    to?: string;
  }>;
};

export default async function InsightsPage({
  searchParams,
}: InsightsPageProps) {
  const params = await searchParams;

  const dateRange =
    resolveAnalyticsDateRange({
      startDate: params.from ?? params.start,
      endDate: params.to ?? params.end,
    });

  const intelligence =
    await getRevenueIntelligence({
      propertyId:
        params.property ?? null,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    });
  const learning = await getRelevantLearning({
    capability: "revenue",
    subjectType: "revenue-recommendation",
    subjectId: params.property ?? "workspace-revenue",
    propertyId: params.property,
    strategy: "revenue-optimization",
  }).catch(() => null);

  return (
    <WorkspacePage className="space-y-6 pt-1">
      <RevenueIntelligenceDashboard
        intelligence={intelligence}
      />
      {learning ? <RelevantLearningPanel projection={learning} title="Relevant revenue learning" /> : null}
    </WorkspacePage>
  );
}
