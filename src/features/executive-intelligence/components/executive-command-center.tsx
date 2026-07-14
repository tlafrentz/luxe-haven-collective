import type {
  ExecutiveIntelligenceReport,
} from "../domain";

import {
  ExecutiveBrief,
} from "./executive-brief";

import {
  ExecutiveCommandHeader,
} from "./executive-command-header";

import {
  ExecutivePriorityList,
} from "./executive-priority-list";

import {
  ExecutiveScopeControls,
} from "./executive-scope-controls";

import {
  PortfolioHealthOverview,
} from "./portfolio-health-overview";

import {
  PortfolioSnapshotGrid,
} from "./portfolio-snapshot-grid";

import {
  RecentChangesFeed,
} from "./recent-changes-feed";

import {
  RevenueRiskSummary,
} from "./revenue-risk-summary";

type ExecutiveCommandCenterProps = {
  report: ExecutiveIntelligenceReport;
};

function buildRevenueIntelligenceHref(
  report: ExecutiveIntelligenceReport,
) {
  const params = new URLSearchParams({
    start: report.dateRange.startDate,
    end: report.dateRange.endDate,
  });

  if (report.selectedProperty) {
    params.set(
      "property",
      report.selectedProperty.id,
    );
  }

  return `/dashboard/insights?${params.toString()}`;
}

export function ExecutiveCommandCenter({
  report,
}: ExecutiveCommandCenterProps) {
  const revenueIntelligenceHref =
    buildRevenueIntelligenceHref(report);

  return (
    <main className="px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-[1480px] space-y-8">
        <ExecutiveCommandHeader report={report} />

        <ExecutiveScopeControls
          properties={report.properties}
          selectedProperty={
            report.selectedProperty
          }
          dateRange={report.dateRange}
        />

        <ExecutiveBrief
          brief={report.executiveBrief}
        />

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.8fr)]">
          <ExecutivePriorityList
            priorities={report.priorities}
            revenueIntelligenceHref={
              revenueIntelligenceHref
            }
          />

          <div className="space-y-8">
            <PortfolioHealthOverview
              report={report}
            />

            <RevenueRiskSummary
              risk={report.revenueRisk}
            />

            <PortfolioSnapshotGrid
              snapshot={
                report.portfolioSnapshot
              }
            />
          </div>
        </div>

        <RecentChangesFeed
          changes={report.changes}
        />
      </div>
    </main>
  );
}
