import {
  AcquisitionSetup,
} from "./acquisition-setup";

import {
  DecisionReadinessCard,
} from "./decision-readiness-card";

import {
  GenerateInvestmentAnalysisCard,
} from "./generate-investment-analysis-card";

import {
  InvestmentAnalysisResults,
} from "./investment-analysis-results";

import {
  InvestmentWorkspaceHeader,
} from "./investment-workspace-header";

import {
  InvestmentWorkspaceNavigation,
} from "./investment-workspace-navigation";

import {
  InvestmentWorkspaceStateProvider,
} from "./investment-workspace-state";

import {
  LiveInvestmentSummary,
} from "./live-investment-summary";
import { InvestmentMarketEvidencePanel } from "./investment-market-evidence-panel";

export function InvestmentWorkspace() {
  return (
    <InvestmentWorkspaceStateProvider>
      <main className="px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="mx-auto max-w-[1480px] space-y-10">
          <InvestmentWorkspaceHeader />

          <InvestmentWorkspaceNavigation />

          <AcquisitionSetup />

          <InvestmentMarketEvidencePanel />

          <LiveInvestmentSummary />

          <section
            id="analysis"
            className="space-y-6 scroll-mt-6"
          >
            <header className="border-b border-neutral-200 pb-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                Investment analysis
              </p>

              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950">
                Analyze the investment
              </h2>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
                Confirm the workspace is ready, then generate the complete
                analysis across financial performance, market position,
                risks, evidence, and acquisition strategy.
              </p>
            </header>

            <div className="grid gap-8 xl:grid-cols-[minmax(0,0.7fr)_minmax(0,1.5fr)]">
              <DecisionReadinessCard />
              <GenerateInvestmentAnalysisCard />
            </div>
          </section>

          <section
            id="results"
            className="space-y-6 scroll-mt-6"
          >
            <header className="border-b border-neutral-200 pb-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                Results
              </p>

              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950">
                Explainable investment analysis
              </h2>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
                Review the recommendation, score, financial performance,
                supporting evidence, risks, scenarios, and failure points.
              </p>
            </header>

            <InvestmentAnalysisResults />
          </section>
        </div>
      </main>
    </InvestmentWorkspaceStateProvider>
  );
}
