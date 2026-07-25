import type { PortfolioOverview } from "../application/overview";

export type PortfolioOverviewCacheContext = Readonly<{
  workspaceId: string;
  membershipId: string;
  role: string;
  propertyIds: readonly string[];
  currentFrom: string;
  currentTo: string;
  comparisonType: string;
  comparisonFrom?: string;
  comparisonTo?: string;
}>;

export function portfolioOverviewCacheKey(context: PortfolioOverviewCacheContext) {
  return [
    "portfolio-overview-v1", context.workspaceId, context.membershipId, context.role,
    [...context.propertyIds].sort().join(","), context.currentFrom, context.currentTo,
    context.comparisonType, context.comparisonFrom ?? "-", context.comparisonTo ?? "-",
  ].join("|");
}

export class AuthorizationAwarePortfolioOverviewCache {
  private readonly values = new Map<string, Readonly<{ value: PortfolioOverview; expiresAt: number }>>();
  constructor(private readonly ttlMilliseconds = 60_000, private readonly now = () => Date.now()) {}
  get(context: PortfolioOverviewCacheContext) {
    const entry = this.values.get(portfolioOverviewCacheKey(context));
    if (!entry || entry.expiresAt <= this.now()) return null;
    return entry.value;
  }
  set(context: PortfolioOverviewCacheContext, value: PortfolioOverview) {
    this.values.set(portfolioOverviewCacheKey(context), { value, expiresAt: this.now() + this.ttlMilliseconds });
  }
  invalidateWorkspace(workspaceId: string) {
    for (const key of this.values.keys()) if (key.startsWith(`portfolio-overview-v1|${workspaceId}|`)) this.values.delete(key);
  }
}
