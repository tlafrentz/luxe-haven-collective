import {
  Database,
  Info,
} from "lucide-react";

import type {
  ExecutiveIntelligenceReport,
} from "../domain";

import {
  HpmPillarGrid,
} from "./hpm-pillar-grid";

import {
  SectionHeading,
} from "./section-heading";

type PortfolioHealthOverviewProps = {
  report: ExecutiveIntelligenceReport;
};

export function PortfolioHealthOverview({
  report,
}: PortfolioHealthOverviewProps) {
  const coverage =
    report.hpmPerformance.dataCoverage;

  return (
    <section>
      <SectionHeading
        eyebrow="Hospitality performance"
        title="Portfolio health"
        description="HPM evaluates the business across seven performance pillars. Scores appear only when enough trusted data is available."
      />

      <div className="mt-5 rounded-3xl border border-stone-200 bg-stone-100/60 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-stone-700 shadow-sm">
            <Database className="h-4 w-4" />
          </div>

          <div>
            <p className="text-sm font-semibold text-stone-950">
              {coverage.coveragePercentage}% HPM data coverage
            </p>

            <p className="mt-1 text-xs leading-5 text-stone-600">
              {coverage.measuredPillars.length} measured,{" "}
              {coverage.partialPillars.length} partial, and{" "}
              {coverage.unavailablePillars.length} awaiting
              additional data.
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-xl border border-stone-200 bg-white px-3 py-3 text-xs leading-5 text-stone-600">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
          Overall HPM health will become available when
          additional financial, operational, guest,
          investment, and growth signals are connected.
        </div>
      </div>

      <div className="mt-4">
        <HpmPillarGrid
          performance={report.hpmPerformance}
        />
      </div>
    </section>
  );
}
