import { describe, expect, it, vi } from "vitest";
import { permissionsForRole, type WorkspaceAccessContext, type WorkspaceRole } from "@/features/workspace";
import { Money } from "@/platform/kernel";
import { buildFinancialReadModel, type FinancialSource } from "../..";
import { FinancialTransaction, type FinancialAccount, type FinancialPeriod } from "../../domain";
import {
  buildFinancialOverview, buildFinancialPlanVariancePreview, buildFinancialMetricSummaries,
  financialOverviewCacheKey, identifyMaterialFinancialChanges, metricChange,
  type FinancialOverviewBuildInput,
} from ".";

const period: FinancialPeriod = { kind: "month", from: "2026-07-01", to: "2026-07-31", comparison: { from: "2026-06-01", to: "2026-06-30" }, reportingCalendar: "fiscal" };
const accounts: readonly FinancialAccount[] = [
  { id: "revenue", workspaceId: "w", code: "4000", name: "Revenue", category: "revenue", subcategory: "Accommodation", active: true },
  { id: "expense", workspaceId: "w", code: "6000", name: "Maintenance", category: "operating-expense", subcategory: "Maintenance", active: true },
  { id: "capex", workspaceId: "w", code: "7000", name: "Improvements", category: "capital-expense", active: true },
];
function access(role: WorkspaceRole = "owner"): WorkspaceAccessContext { return { profileId: "p", workspaceId: "w", ownerId: "w", ownerProfileId: "p", membershipId: "m", role, status: "active", propertyAccess: role === "owner" || role === "administrator" ? { type: "all" } : { type: "selected", propertyIds: ["one"] }, permissions: permissionsForRole(role) }; }
function tx(id: string, accountId: string, amount: number, propertyId = "one") { return FinancialTransaction.create({ id, accountId, workspaceId: "w", propertyId, amount: Money.usd(amount), category: accountId, measurement: "measured", effectiveDate: "2026-07-10", postingDate: "2026-07-10", source: { provider: "ledger" }, status: "posted", evidenceIds: [`e:${id}`] }); }
async function model(values = { revenue: 10_000, expense: 4_000, capex: 5_000 }, sync = "2026-07-25T10:00:00Z") {
  const source: FinancialSource = {
    getIdentity: vi.fn(async () => ({ workspaceId: "w", organizationId: "o", reportingCurrency: "USD", fiscalYearStartMonth: 1, timezone: "America/Chicago", reportingStandards: ["GAAP"], accountingMethod: "accrual" as const })),
    listAccounts: vi.fn(async () => accounts),
    listTransactions: vi.fn(async () => [tx("r", "revenue", values.revenue), tx("e", "expense", values.expense), tx("c", "capex", values.capex)]),
    getSynchronization: vi.fn(async () => ({ lastSuccessfulAt: sync, expectedProviders: 1, connectedProviders: 1, historyMonths: 24 })),
  };
  return buildFinancialReadModel(source, { access: access(), workspaceId: "w", propertyIds: ["one"], period, evaluatedAt: "2026-07-25T12:00:00Z" });
}
async function input(overrides: Partial<FinancialOverviewBuildInput> = {}): Promise<FinancialOverviewBuildInput> {
  const current = await model(), comparison = await model({ revenue: 8_000, expense: 3_500, capex: 0 });
  return {
    current, comparison, comparisonType: "previous-period",
    scope: { type: "workspace", label: "Full Workspace", propertyIds: ["one"], propertyCount: 1 },
    propertySnapshots: [{ propertyId: "one", label: "Property One", snapshot: current.snapshot }],
    cash: { balance: Money.usd(20_000), netMovement: Money.usd(1_000), asOf: "2026-07-25T10:00:00Z", qualification: "measured", confidence: "high", freshness: "current", evidenceIds: ["cash"], reserveTarget: Money.usd(10_000), internalTransfersEliminated: true },
    obligations: { sourceAvailable: false, items: [] }, canViewCash: true, canViewDetail: true, ...overrides,
  };
}

describe("Financial Overview policies", () => {
  it("calculates recognized revenue, operating expenses, NOI, margin and excludes capital expenditure", async () => {
    const overview = buildFinancialOverview(await input({ comparison: undefined, comparisonType: undefined }));
    expect(overview.metrics.find(item => item.metric === "revenue")?.current.money?.amount).toBe(10_000);
    expect(overview.metrics.find(item => item.metric === "operating-expenses")?.current.money?.amount).toBe(4_000);
    expect(overview.profitability.noi.money?.amount).toBe(6_000);
    expect(overview.profitability.margin.percentage).toBe(.6);
    expect(overview.condition.status).toBe("strong");
  });
  it("does not infer cash movement from NOI and preserves authorized sourced liquidity", async () => {
    const overview = buildFinancialOverview(await input({ cash: { balance: Money.usd(2_000), netMovement: Money.usd(-9_000), asOf: "2026-07-25T10:00:00Z", qualification: "measured", confidence: "high", freshness: "current", evidenceIds: ["cash"], internalTransfersEliminated: true } }));
    expect(overview.profitability.noi.money?.amount).toBe(6_000);
    expect(overview.liquidity.movement.money?.amount).toBe(-9_000);
    expect(overview.liquidity.explanation).toMatch(/distinct from NOI/);
  });
  it("keeps missing expense and cash values unavailable rather than false zeroes", async () => {
    const current = await model({ revenue: 10_000, expense: 0, capex: 0 });
    const sourceWithoutExpense = { ...current, evidence: { ...current.evidence, expenseCoverage: 0, gaps: ["Expense coverage incomplete."] }, snapshot: { ...current.snapshot, evidence: { ...current.evidence, expenseCoverage: 0, gaps: ["Expense coverage incomplete."] } } };
    const overview = buildFinancialOverview(await input({ current: sourceWithoutExpense, comparison: undefined, cash: undefined }));
    expect(overview.profitability.status).toBe("insufficient-evidence");
    expect(overview.metrics.find(item => item.metric === "operating-expenses")?.current.money).toBeUndefined();
    expect(overview.metrics.find(item => item.metric === "cash-balance")?.current.money).toBeUndefined();
    expect(overview.condition.status).toBe("insufficient-evidence");
  });
  it("suppresses extreme percentage changes for zero or immaterial denominators", () => {
    const fromZero = metricChange(Money.usd(2_400), Money.zero(), true)!;
    const fromSmall = metricChange(Money.usd(2_400), Money.usd(50), true)!;
    expect(fromZero.kind).toBe("new");
    expect(fromZero).not.toHaveProperty("percentageChange");
    expect(fromSmall.kind).toBe("absolute-only");
    expect(fromSmall).not.toHaveProperty("percentageChange");
  });
  it("builds a daily cumulative performance trend that excludes capital expenditure and matches the period totals", async () => {
    const overview = buildFinancialOverview(await input({ comparison: undefined, comparisonType: undefined }));
    expect(overview.performanceTrend).toHaveLength(31);
    expect(overview.performanceTrend[0]).toMatchObject({ date: "2026-07-01", revenue: 0, expenses: 0, noi: 0 });
    const last = overview.performanceTrend.at(-1)!;
    expect(last.date).toBe("2026-07-31");
    expect(last.revenue).toBe(10_000);
    expect(last.expenses).toBe(4_000);
    expect(last.noi).toBe(6_000);
  });
  it("prioritizes no more than five material changes", async () => {
    expect(identifyMaterialFinancialChanges(await input()).length).toBeLessThanOrEqual(5);
  });
  it("expresses the operating-margin comparison as a percentage-point change, not a relative percent-of-percent", async () => {
    const metrics = buildFinancialMetricSummaries(await input());
    const margin = metrics.find(item => item.metric === "operating-margin")!;
    expect(margin.current.percentage).toBe(.6);
    expect(margin.change?.percentagePointChange).toBeCloseTo(.0375, 4);
    expect(margin.change).not.toHaveProperty("percentageChange");
  });
  it("explains operating margin is unavailable because revenue is zero, distinct from unreliable-coverage cases", async () => {
    const current = await model({ revenue: 0, expense: 4_000, capex: 0 });
    const overview = buildFinancialOverview(await input({ current, comparison: undefined, comparisonType: undefined }));
    const margin = overview.metrics.find(item => item.metric === "operating-margin")!;
    expect(margin.current.percentage).toBeUndefined();
    expect(margin.current.limitation).toBe("Revenue is required to calculate operating margin.");
  });
  it("attaches a comparison-period change to matching expense-category drivers, without inventing one for new categories", async () => {
    const overview = buildFinancialOverview(await input());
    const maintenance = overview.drivers.expenses.find(item => item.label === "Maintenance");
    expect(maintenance?.change?.amount).toBe(500);
  });
  it("counts uncategorized transactions in the evidence summary", async () => {
    const fullyCategorized = buildFinancialOverview(await input({ comparison: undefined, comparisonType: undefined }));
    expect(fullyCategorized.evidence.uncategorizedTransactionCount).toBe(0);
  });
  it("uses account-type favorable variance and rejects accounting-basis mismatch", async () => {
    const compatible = await input({ plan: { kind: "budget", accountingBasis: "accrual", values: { revenue: Money.usd(9_000), expenses: Money.usd(3_000) } } });
    const preview = buildFinancialPlanVariancePreview(compatible);
    expect(preview.lines.find(line => line.metric === "revenue")?.favorable).toBe(true);
    expect(preview.lines.find(line => line.metric === "expenses")?.favorable).toBe(false);
    expect(buildFinancialPlanVariancePreview(await input({ plan: { kind: "budget", accountingBasis: "cash", values: { revenue: Money.usd(9_000) } } })).status).toBe("incompatible-basis");
  });
  it("omits cash at the application boundary when permission is absent", async () => {
    const metrics = buildFinancialMetricSummaries(await input({ canViewCash: false }));
    const cash = metrics.find(item => item.metric === "cash-balance")!;
    expect(cash.availability).toBe("restricted");
    expect(cash.current).not.toHaveProperty("money");
  });
  it("isolates cache dimensions by authorized scope and permissions", async () => {
    const base = await input();
    expect(financialOverviewCacheKey(base)).not.toBe(financialOverviewCacheKey({ ...base, canViewCash: false }));
    expect(financialOverviewCacheKey(base)).not.toBe(financialOverviewCacheKey({ ...base, scope: { ...base.scope, propertyIds: ["two"] } }));
  });
  it("rejects a plan in another currency", async () => {
    const base = await input();
    expect(() => buildFinancialOverview({ ...base, plan: { kind: "budget", accountingBasis: "accrual", values: { revenue: Money.of(1, "EUR") } } })).toThrow("FINANCIAL_CURRENCY_MISMATCH");
  });
});
