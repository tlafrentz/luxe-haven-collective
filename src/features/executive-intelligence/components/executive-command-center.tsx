import type { ExecutiveIntelligenceView } from "../domain";
import { ExecutiveBrief } from "./executive-brief";
import { ExecutiveCommandHeader } from "./executive-command-header";
import { ExecutiveDataQuality } from "./executive-data-quality";
import { ExecutiveDecisionSection, ExecutiveExecutionSection, ExecutiveOutcomeSection } from "./executive-lifecycle-summary";
import { ExecutiveAttentionList } from "./executive-attention-list";
import { ExecutiveScopeControls } from "./executive-scope-controls";
import { PortfolioHealthOverview } from "./portfolio-health-overview";
import { PortfolioSnapshotGrid } from "./portfolio-snapshot-grid";
import { RecentChangesFeed } from "./recent-changes-feed";
import { RevenueRiskSummary } from "./revenue-risk-summary";

type ExecutiveCommandCenterProps = Readonly<{ view: ExecutiveIntelligenceView }>;

export function ExecutiveCommandCenter({ view }: ExecutiveCommandCenterProps) {
  return (
    <main className="px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-[1480px] space-y-8">
        <ExecutiveCommandHeader scope={view.scope} />
        <ExecutiveScopeControls scope={view.scope} />
        <ExecutiveBrief brief={view.briefing} healthStatus={view.health.status} />
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.8fr)]">
          <ExecutiveAttentionList attention={view.attention} />
          <div className="space-y-8">
            <PortfolioHealthOverview health={view.health} dataQuality={view.dataQuality} />
            <RevenueRiskSummary risks={view.attention.risks} />
            <PortfolioSnapshotGrid performance={view.performance} />
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <ExecutiveDecisionSection summary={view.decisions} dataQuality={view.dataQuality} />
          <ExecutiveExecutionSection summary={view.execution} dataQuality={view.dataQuality} />
          <ExecutiveOutcomeSection summary={view.outcomes} dataQuality={view.dataQuality} />
        </div>
        <ExecutiveDataQuality dataQuality={view.dataQuality} />
        <RecentChangesFeed items={view.attention.priorities} />
      </div>
    </main>
  );
}
