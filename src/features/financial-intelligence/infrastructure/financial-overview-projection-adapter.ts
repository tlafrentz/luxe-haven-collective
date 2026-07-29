import { evaluatePropertyAccess, evaluateWorkspacePermission, type WorkspaceAccessContext } from "@/features/workspace";
import {
  buildFinancialReadModel, FinancialOverviewError, type FinancialCashSource,
  type FinancialExecutionSummary, type FinancialObligation, type FinancialOverviewBuildInput,
  type FinancialOverviewReader, type FinancialPlanSource, type FinancialSource,
  type GetFinancialOverviewQuery,
} from "../application";
import type { FinancialSnapshot } from "../domain";

export interface FinancialPropertyCatalog {
  list(workspaceId: string): Promise<readonly Readonly<{ propertyId: string; label: string; included: boolean; reportingEligible: boolean; market?: string; operatingModel?: string }>[]>;
}
export interface FinancialLiquidityReader { read(workspaceId: string, propertyIds: readonly string[], period: GetFinancialOverviewQuery["period"]): Promise<FinancialCashSource | null>; }
export interface FinancialPlanningVarianceReader { read(workspaceId: string, period: GetFinancialOverviewQuery["period"], kind: "budget" | "forecast"): Promise<FinancialPlanSource | null>; }
export interface FinancialObligationReader { read(workspaceId: string, propertyIds: readonly string[], period: GetFinancialOverviewQuery["period"]): Promise<Readonly<{ sourceAvailable: boolean; items: readonly FinancialObligation[] }>>; }
export interface FinancialExecutionSummaryReader { read(workspaceId: string, propertyIds: readonly string[]): Promise<FinancialExecutionSummary>; }
export interface FinancialSnapshotWriter { put(snapshot:FinancialSnapshot,actorProfileId:string):Promise<void>; }

export class FinancialOverviewProjectionAdapter implements FinancialOverviewReader {
  constructor(
    private readonly access: WorkspaceAccessContext,
    private readonly source: FinancialSource,
    private readonly catalog: FinancialPropertyCatalog,
    private readonly dependencies: Readonly<{
      liquidity?: FinancialLiquidityReader; planning?: FinancialPlanningVarianceReader;
      obligations?: FinancialObligationReader; execution?: FinancialExecutionSummaryReader;
      snapshots?: FinancialSnapshotWriter;
    }> = {},
  ) {}

  async read(query: GetFinancialOverviewQuery): Promise<FinancialOverviewBuildInput> {
    if (query.workspaceId !== this.access.workspaceId || !evaluateWorkspacePermission(this.access, "financial.overview.view")) {
      throw new FinancialOverviewError("permission", "Financial Overview access is not permitted.");
    }
    const catalog = await this.catalog.list(query.workspaceId);
    const eligible = catalog.filter(item => item.included && item.reportingEligible && evaluatePropertyAccess(this.access, item.propertyId));
    const requested = query.propertyIds ? [...new Set(query.propertyIds)] : undefined;
    if (requested?.some(id => !eligible.some(item => item.propertyId === id))) throw new FinancialOverviewError("permission", "One or more selected properties are outside the authorized financial scope.");
    const properties = eligible.filter(item => !requested || requested.includes(item.propertyId));
    const propertyIds = properties.map(item => item.propertyId).sort();
    const scope = Object.freeze({
      type: query.portfolioId ? "portfolio" as const : propertyIds.length === 1 ? "single-property" as const : requested ? "selected-properties" as const : "workspace" as const,
      label: query.portfolioId ? "Authorized Portfolio" : propertyIds.length === 1 ? properties[0]?.label ?? "Single Property" : requested ? "Selected Properties" : this.access.propertyAccess.type === "all" ? "Full Workspace" : "Authorized Properties",
      propertyIds: Object.freeze(propertyIds), propertyCount: propertyIds.length,
    });
    const evaluatedAt = query.evaluatedAt ?? new Date().toISOString();
    const readQuery = { access: this.access, workspaceId: query.workspaceId, propertyIds, period: query.period, reportingCurrency: query.reportingCurrency, evaluatedAt, authorizationLevel: "read" as const };
    const current = await buildFinancialReadModel(this.source, readQuery);
    if (query.accountingBasis && query.accountingBasis !== current.identity.accountingMethod) throw new FinancialOverviewError("accounting_basis", "The selected accounting basis is not supported by current sources.");
    const comparison = query.comparisonType === "previous-period" || query.comparisonType === "previous-year"
      ? query.period.comparison ? await buildFinancialReadModel(this.source, { ...readQuery, period: { ...query.period, from: query.period.comparison.from, to: query.period.comparison.to, comparison: undefined } }) : undefined
      : undefined;
    const propertySnapshots = await Promise.all(properties.map(async property => ({
      propertyId: property.propertyId, label: property.label,
      snapshot: (await buildFinancialReadModel(this.source, { ...readQuery, propertyIds: undefined, propertyId: property.propertyId })).snapshot,
    })));
    if(this.dependencies.snapshots)await Promise.all([
      this.dependencies.snapshots.put(current.snapshot,this.access.profileId),
      ...(comparison?[this.dependencies.snapshots.put(comparison.snapshot,this.access.profileId)]:[]),
      ...propertySnapshots.map(item=>this.dependencies.snapshots!.put(item.snapshot,this.access.profileId)),
    ]);
    const canViewCash = evaluateWorkspacePermission(this.access, "financial.cash.view");
    const canViewDetail = evaluateWorkspacePermission(this.access, "financial.details.view");
    const [cash, plan, obligations, execution] = await Promise.all([
      canViewCash ? this.dependencies.liquidity?.read(query.workspaceId, propertyIds, query.period).catch(() => null) : undefined,
      query.comparisonType === "budget" || query.comparisonType === "forecast" ? this.dependencies.planning?.read(query.workspaceId, query.period, query.comparisonType).catch(() => null) : undefined,
      this.dependencies.obligations?.read(query.workspaceId, propertyIds, query.period).catch(() => ({ sourceAvailable: false, items: [] })),
      this.dependencies.execution?.read(query.workspaceId, propertyIds).catch(() => undefined),
    ]);
    return Object.freeze({
      current, comparison, ...(query.comparisonType !== "none" ? { comparisonType: query.comparisonType } : {}),
      scope, propertySnapshots: Object.freeze(propertySnapshots), ...(cash ? { cash } : {}), ...(plan ? { plan } : {}),
      obligations: obligations ?? { sourceAvailable: false, items: [] }, ...(execution ? { execution } : {}),
      canViewCash, canViewDetail, permissionLimited: this.access.propertyAccess.type !== "all" || !canViewCash,
      projectionVersion: `financial-overview-v1:${current.evaluatedAt}`,
    });
  }
}
