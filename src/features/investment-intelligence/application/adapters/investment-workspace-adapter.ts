import type { InvestmentLifecycleResult, InvestmentWorkspaceView } from "../../domain";
import { createInvestmentPlatformRunContext, type InvestmentPlatformRunContext } from "./investment-platform-run-context";
import { mapInvestmentPlatformAnalysis } from "./map-investment-platform-analysis";

/** The sole canonical-to-UI projection boundary for Investment underwriting. */
export function buildInvestmentWorkspaceView(
  result: InvestmentLifecycleResult,
  context: InvestmentPlatformRunContext = createInvestmentPlatformRunContext(),
): InvestmentWorkspaceView {
  return Object.freeze({
    projection: result.analysis,
    platform:
      mapInvestmentPlatformAnalysis(
        result,
        context,
      ),
  });
}
