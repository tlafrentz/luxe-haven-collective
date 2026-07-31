import {
  InvestmentWorkspaceHeader,
} from "./investment-workspace-header";

import {
  InvestmentWorkspaceStateProvider,
} from "./investment-workspace-state";

import { InvestmentAnalysisStepPages } from "./investment-analysis-step-pages";
import type { ReactNode } from "react";
import type { InvestmentWorkspaceValues } from "./investment-workspace-state";
import type { InvestmentAnalysisMarketContext } from "../application";

export function InvestmentWorkspace({ resultsActions, initialValues, contextNotice, initialMarketContext, draftScope }: { resultsActions?: ReactNode; initialValues?: Partial<InvestmentWorkspaceValues>; contextNotice?: ReactNode; initialMarketContext?: InvestmentAnalysisMarketContext; draftScope?: string } = {}) {
  return (
    <InvestmentWorkspaceStateProvider initialValues={initialValues} initialMarketContext={initialMarketContext} draftScope={draftScope}>
      <main className="px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="mx-auto max-w-[1480px] space-y-10">
          <InvestmentWorkspaceHeader />
          {contextNotice}

          <InvestmentAnalysisStepPages resultsActions={resultsActions} />
        </div>
      </main>
    </InvestmentWorkspaceStateProvider>
  );
}
