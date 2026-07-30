import type { InvestmentDecisionAnalysis } from "../domain";
import type { InvestmentWorkspaceAnalysisResult } from "./types";

/** Client-facing decision projection; the rich Platform view stays server-side. */
export type InvestmentDecisionAnalysisTransportDto = Readonly<
  Omit<InvestmentDecisionAnalysis, "workspaceView">
>;

export type InvestmentWorkspaceAnalysisTransportDto = Readonly<
  Omit<InvestmentWorkspaceAnalysisResult, "decisionAnalysis"> & {
    decisionAnalysis: InvestmentDecisionAnalysisTransportDto;
  }
>;

/**
 * Dedicated React transport boundary for the Investment Workspace.
 *
 * Canonical domain artifacts remain unchanged for persistence and server-side
 * workflows. Only the rich Platform workspace view is excluded from the
 * browser payload because it contains custom collection and value-object
 * prototypes that React Server Actions cannot serialize.
 */
export function projectInvestmentWorkspaceTransport(
  result: InvestmentWorkspaceAnalysisResult,
): InvestmentWorkspaceAnalysisTransportDto {
  const { workspaceView: _serverOnlyWorkspaceView, ...decisionAnalysis } =
    result.decisionAnalysis;
  void _serverOnlyWorkspaceView;

  return deepFreeze({
    propertyResolution: result.propertyResolution,
    marketReport: result.marketReport,
    investmentMarketContext: result.investmentMarketContext,
    investmentAnalysisContext: result.investmentAnalysisContext,
    lifecycleResult: result.lifecycleResult,
    decisionAnalysis,
    lineage: result.lineage,
  });
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
