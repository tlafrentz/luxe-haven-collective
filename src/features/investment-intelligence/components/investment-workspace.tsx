import {
  AcquisitionSetup,
} from "./acquisition-setup";

import {
  DecisionReadinessCard,
} from "./decision-readiness-card";

import {
  GenerateInvestmentDecisionCard,
} from "./generate-investment-decision-card";

import {
  InvestmentDecisionPreview,
} from "./investment-decision-preview";

import {
  InvestmentWorkspaceHeader,
} from "./investment-workspace-header";

import {
  InvestmentWorkspaceNavigation,
} from "./investment-workspace-navigation";

import {
  InvestmentWorkspaceStateProvider,
} from "./investment-workspace-state";

export function InvestmentWorkspace() {
  return (
    <InvestmentWorkspaceStateProvider>
      <main className="px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="mx-auto max-w-[1480px] space-y-10">
          <InvestmentWorkspaceHeader />

          <InvestmentWorkspaceNavigation />

          <AcquisitionSetup />

          <section className="space-y-6">
            <header className="border-b border-neutral-200 pb-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                Phase 2
              </p>

              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950">
                Generate the decision
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
                Confirm the opportunity is ready, then let the platform
                build the complete acquisition case.
              </p>
            </header>

            <div className="grid gap-8 xl:grid-cols-[minmax(0,0.7fr)_minmax(0,1.5fr)]">
              <DecisionReadinessCard />
              <GenerateInvestmentDecisionCard />
            </div>
          </section>

          <section className="space-y-6">
            <header className="border-b border-neutral-200 pb-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                Phase 3
              </p>

              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950">
                Investment decision report
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
                The recommendation, supporting analysis, evidence, and
                risks will appear below after evaluation.
              </p>
            </header>

            <InvestmentDecisionPreview />
          </section>
        </div>
      </main>
    </InvestmentWorkspaceStateProvider>
  );
}
