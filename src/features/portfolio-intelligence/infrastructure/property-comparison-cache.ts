import type { PortfolioPropertyComparison } from "../application/property-comparison";

export type PropertyComparisonCacheContext = Readonly<{
  workspaceId: string; membershipId: string; role: string; authorizedPropertyIds: readonly string[];
  includedPropertyIds: readonly string[]; currentFrom: string; currentTo: string;
  comparisonType: string; comparisonFrom?: string; comparisonTo?: string;
  metricFamily: string; normalization: string; grouping: string; capabilities: readonly string[];
  projectionVersion: string;
}>;
export function propertyComparisonCacheKey(context: PropertyComparisonCacheContext) {
  return ["property-comparison-v1", context.workspaceId, context.membershipId, context.role,
    [...context.authorizedPropertyIds].sort().join(","), [...context.includedPropertyIds].sort().join(","),
    context.currentFrom, context.currentTo, context.comparisonType, context.comparisonFrom ?? "-",
    context.comparisonTo ?? "-", context.metricFamily, context.normalization, context.grouping,
    [...context.capabilities].sort().join(","), context.projectionVersion].join("|");
}
export class AuthorizationAwarePropertyComparisonCache {
  private readonly entries = new Map<string, Readonly<{ value: PortfolioPropertyComparison; expiresAt: number }>>();
  constructor(private readonly ttlMilliseconds = 60_000, private readonly now = () => Date.now()) {}
  get(context: PropertyComparisonCacheContext) { const entry = this.entries.get(propertyComparisonCacheKey(context)); return !entry || entry.expiresAt <= this.now() ? null : entry.value; }
  set(context: PropertyComparisonCacheContext, value: PortfolioPropertyComparison) { this.entries.set(propertyComparisonCacheKey(context), { value, expiresAt: this.now() + this.ttlMilliseconds }); }
  invalidateWorkspace(workspaceId: string) { for (const key of this.entries.keys()) if (key.startsWith(`property-comparison-v1|${workspaceId}|`)) this.entries.delete(key); }
}
