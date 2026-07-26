import type { FinancialOverview, FinancialOverviewBuildInput, FinancialOverviewCache, FinancialOverviewReader, GetFinancialOverviewQuery } from "./contracts";
import { buildFinancialOverview } from "./build-financial-overview";

export class FinancialOverviewError extends Error {
  constructor(readonly code: "permission" | "configuration" | "currency" | "accounting_basis" | "data_quality" | "reconciliation" | "unavailable" | "conflict" | "unexpected", message: string) {
    super(message); this.name = "FinancialOverviewError";
  }
}

export function financialOverviewCacheKey(input: FinancialOverviewBuildInput): string {
  const comparison = input.comparisonType ?? "none";
  const permission = `${input.canViewCash ? "cash" : "no-cash"}:${input.canViewDetail ? "detail" : "summary"}:${input.permissionLimited ? "limited" : "full"}`;
  return ["financial-overview", input.current.identity.workspaceId, input.scope.type, [...input.scope.propertyIds].sort().join(","), permission, input.current.period.from, input.current.period.to, comparison, input.current.identity.accountingMethod, input.current.identity.reportingCurrency, input.projectionVersion ?? "v1", input.current.evidence.sourceIds.join(",")].join("|");
}

export async function getFinancialOverview(reader: FinancialOverviewReader, query: GetFinancialOverviewQuery, cache?: FinancialOverviewCache): Promise<FinancialOverview> {
  let input: FinancialOverviewBuildInput;
  try { input = await reader.read(query); }
  catch (error) {
    if (error instanceof FinancialOverviewError) throw error;
    const message = error instanceof Error ? error.message : "";
    if (message.includes("CURRENCY")) throw new FinancialOverviewError("currency", "Financial values use incompatible currencies and no approved conversion policy is configured.");
    if (message.includes("basis")) throw new FinancialOverviewError("accounting_basis", "Current and comparison values use incompatible accounting bases.");
    if (/access|permission|Authentication|Denied/i.test(message)) throw new FinancialOverviewError("permission", "Financial Overview access is not permitted.");
    throw new FinancialOverviewError("unavailable", "Financial Overview could not be completed from the available sources.");
  }
  const key = financialOverviewCacheKey(input);
  const cached = await cache?.get(key);
  if (cached) return cached;
  const overview = buildFinancialOverview(input);
  await cache?.put(key, overview);
  return overview;
}

export class GetFinancialOverview {
  constructor(private readonly reader: FinancialOverviewReader, private readonly cache?: FinancialOverviewCache) {}
  execute(query: GetFinancialOverviewQuery) { return getFinancialOverview(this.reader, query, this.cache); }
}
export class BuildFinancialOverview {
  execute(input: FinancialOverviewBuildInput) { return buildFinancialOverview(input); }
}
