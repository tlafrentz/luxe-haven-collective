import { evaluatePropertyAccess, evaluateWorkspacePermission, type WorkspaceAccessContext } from "@/features/workspace";
import {
  buildFinancialReadModel, IncomeStatementError, type BuildIncomeStatementInput,
  type FinancialSource, type GetIncomeStatementQuery, type IncomeStatementReader,
} from "../application";
import type { FinancialPropertyCatalog } from "./financial-overview-projection-adapter";

export class IncomeStatementProjectionAdapter implements IncomeStatementReader {
  constructor(
    private readonly access: WorkspaceAccessContext,
    private readonly source: FinancialSource,
    private readonly catalog: FinancialPropertyCatalog,
  ) {}

  async read(query: GetIncomeStatementQuery): Promise<BuildIncomeStatementInput> {
    if (query.workspaceId !== this.access.workspaceId || !evaluateWorkspacePermission(this.access, "financial.profitability.view")) {
      throw new IncomeStatementError("permission", "Profitability access is not permitted.");
    }
    const catalog = await this.catalog.list(query.workspaceId);
    const eligible = catalog.filter(item => item.included && item.reportingEligible && evaluatePropertyAccess(this.access, item.propertyId));
    const requested = query.propertyIds ? [...new Set(query.propertyIds)] : undefined;
    if (requested?.some(id => !eligible.some(item => item.propertyId === id))) throw new IncomeStatementError("permission", "A selected property is outside the authorized profitability scope.");
    const properties = eligible.filter(item => !requested || requested.includes(item.propertyId));
    const propertyIds = properties.map(item => item.propertyId).sort();
    const evaluatedAt = query.evaluatedAt ?? new Date().toISOString();
    const canonicalQuery = { access: this.access, workspaceId: query.workspaceId, propertyIds, period: query.period, evaluatedAt, authorizationLevel: "read" as const };
    const current = await buildFinancialReadModel(this.source, canonicalQuery);
    const comparison = query.comparisonType !== "none" && query.period.comparison
      ? await buildFinancialReadModel(this.source, { ...canonicalQuery, period: { ...query.period, from: query.period.comparison.from, to: query.period.comparison.to, comparison: undefined } })
      : undefined;
    const scope = Object.freeze({
      type: query.portfolioId ? "portfolio" as const : propertyIds.length === 1 ? "single-property" as const : requested ? "selected-properties" as const : "workspace" as const,
      label: query.portfolioId ? "Authorized Portfolio" : propertyIds.length === 1 ? properties[0]?.label ?? "Single Property" : requested ? "Selected Properties" : this.access.propertyAccess.type === "all" ? "Full Workspace" : "Authorized Properties",
      propertyIds: Object.freeze(propertyIds), propertyCount: propertyIds.length,
    });
    const canViewRevenueDetail = evaluateWorkspacePermission(this.access, "financial.revenue.detail");
    const canViewExpenseDetail = evaluateWorkspacePermission(this.access, "financial.expense.detail");
    return Object.freeze({
      current, comparison, ...(query.comparisonType !== "none" ? { comparisonType: query.comparisonType } : {}),
      scope, properties: Object.freeze(properties.map(({ propertyId, label, market, operatingModel }) => ({
        propertyId, label, ...(market ? { market } : {}), ...(operatingModel ? { operatingModel } : {}),
      }))),
      canViewRevenueDetail, canViewExpenseDetail,
      permissionLimited: this.access.propertyAccess.type !== "all" || !canViewRevenueDetail || !canViewExpenseDetail,
      projectionVersion: `income-statement-v1:${current.evaluatedAt}`,
    });
  }
}
