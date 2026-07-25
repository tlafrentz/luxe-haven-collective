import type { PortfolioDecisionWorkspace } from "../application/decisions";

export type PortfolioDecisionCacheIdentity = Readonly<{
  workspaceId: string; authorizedPropertyIds: readonly string[]; role: string;
  financials: boolean; period: string; findingsVersion: string; decisionPolicyVersion: string;
}>;

export function portfolioDecisionCacheKey(input: PortfolioDecisionCacheIdentity): string {
  return [
    "portfolio-decisions", input.workspaceId, input.role,
    [...input.authorizedPropertyIds].sort().join(","),
    input.financials ? "financials" : "no-financials",
    input.period, input.findingsVersion, input.decisionPolicyVersion,
  ].join(":");
}

export class PortfolioDecisionCache {
  private readonly values = new Map<string, PortfolioDecisionWorkspace>();
  get(identity: PortfolioDecisionCacheIdentity) { return this.values.get(portfolioDecisionCacheKey(identity)); }
  set(identity: PortfolioDecisionCacheIdentity, value: PortfolioDecisionWorkspace) {
    this.values.set(portfolioDecisionCacheKey(identity), value);
  }
  invalidateWorkspace(workspaceId: string) {
    for (const key of this.values.keys()) if (key.startsWith(`portfolio-decisions:${workspaceId}:`)) this.values.delete(key);
  }
}

