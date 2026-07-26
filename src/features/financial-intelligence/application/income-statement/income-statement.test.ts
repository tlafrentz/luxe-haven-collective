import { describe, expect, it, vi } from "vitest";
import { permissionsForRole, type WorkspaceAccessContext } from "@/features/workspace";
import { Money } from "@/platform/kernel";
import { buildFinancialReadModel, type FinancialSource } from "../..";
import { FinancialTransaction, type FinancialAccount, type FinancialPeriod } from "../../domain";
import {
  buildIncomeStatement, incomeStatementCacheKey, safePercentageChange,
  type BuildIncomeStatementInput,
} from ".";

const period: FinancialPeriod = { kind: "month", from: "2026-07-01", to: "2026-07-31", comparison: { from: "2026-06-01", to: "2026-06-30" }, reportingCalendar: "fiscal" };
const accounts: readonly FinancialAccount[] = [
  { id: "accommodation", workspaceId: "w", code: "4000", name: "Accommodation", category: "revenue", subcategory: "Accommodation", active: true },
  { id: "fees", workspaceId: "w", code: "4100", name: "Pet Fees", category: "revenue", subcategory: "Pet Fees", active: true },
  { id: "cleaning", workspaceId: "w", code: "5000", name: "Turnover Cleaning", category: "cost-of-revenue", subcategory: "Cleaning", active: true },
  { id: "maintenance", workspaceId: "w", code: "6000", name: "Maintenance", category: "operating-expense", subcategory: "Maintenance", active: true },
  { id: "unknown", workspaceId: "w", code: "6999", name: "Uncategorized", category: "operating-expense", active: true },
  { id: "capex", workspaceId: "w", code: "7000", name: "Capital Improvements", category: "capital-expense", subcategory: "Improvements", active: true },
];
const access: WorkspaceAccessContext = { profileId: "p", workspaceId: "w", ownerId: "w", ownerProfileId: "p", membershipId: "m", role: "owner", status: "active", propertyAccess: { type: "all" }, permissions: permissionsForRole("owner") };
function tx(id: string, accountId: string, amount: number, propertyId: string) { return FinancialTransaction.create({ id, accountId, workspaceId: "w", propertyId, amount: Money.usd(amount), category: accountId === "unknown" ? "uncategorized" : accountId, measurement: "measured", effectiveDate: "2026-07-10", postingDate: "2026-07-10", source: { provider: "ledger" }, status: "posted", evidenceIds: [`e:${id}`] }); }
async function model(multiplier = 1, accountingMethod: "cash" | "accrual" = "accrual") {
  const transactions = [
    tx("r1", "accommodation", 8_000 * multiplier, "one"), tx("f1", "fees", 1_000 * multiplier, "one"),
    tx("c1", "cleaning", 2_000 * multiplier, "one"), tx("m1", "maintenance", 1_000 * multiplier, "one"),
    tx("r2", "accommodation", 6_000 * multiplier, "two"), tx("c2", "cleaning", 1_500 * multiplier, "two"),
    tx("u2", "unknown", 500 * multiplier, "two"), tx("x2", "capex", 10_000 * multiplier, "two"),
  ];
  const source: FinancialSource = {
    getIdentity: vi.fn(async () => ({ workspaceId: "w", organizationId: "o", reportingCurrency: "USD", fiscalYearStartMonth: 1, timezone: "UTC", reportingStandards: ["GAAP"], accountingMethod })),
    listAccounts: vi.fn(async () => accounts), listTransactions: vi.fn(async () => transactions),
    getSynchronization: vi.fn(async () => ({ lastSuccessfulAt: "2026-07-25T10:00:00Z", expectedProviders: 1, connectedProviders: 1, historyMonths: 24 })),
  };
  return buildFinancialReadModel(source, { access, workspaceId: "w", propertyIds: ["one","two"], period, evaluatedAt: "2026-07-25T12:00:00Z" });
}
async function input(overrides: Partial<BuildIncomeStatementInput> = {}): Promise<BuildIncomeStatementInput> {
  return { current: await model(), comparison: await model(.8), comparisonType: "previous-period", scope: { type: "workspace", label: "Full Workspace", propertyIds: ["one","two"], propertyCount: 2 }, properties: [{ propertyId: "one", label: "Property One", market: "Austin", operatingModel: "owned" }, { propertyId: "two", label: "Property Two", market: "Dallas", operatingModel: "managed" }], canViewRevenueDetail: true, canViewExpenseDetail: true, ...overrides };
}

describe("canonical Income Statement", () => {
  it("reconciles revenue, cost of revenue, operating expense, gross profit, NOI and margins while excluding capex", async () => {
    const statement = buildIncomeStatement(await input());
    expect(statement.revenue.total.amount?.amount).toBe(15_000);
    expect(statement.expenses.costOfRevenue?.amount?.amount).toBe(3_500);
    expect(statement.expenses.operatingExpenses.amount?.amount).toBe(1_500);
    expect(statement.expenses.total.amount?.amount).toBe(5_000);
    expect(statement.profitability.grossProfit?.amount).toBe(11_500);
    expect(statement.profitability.noi?.amount).toBe(10_000);
    expect(statement.profitability.operatingMargin).toBeCloseTo(2 / 3);
  });
  it("omits gross profit when Cost of Revenue is not modeled", async () => {
    const current = await model();
    const withoutCostAccounts = current.accounts.filter(item => item.category !== "cost-of-revenue");
    const filtered = { ...current, accounts: withoutCostAccounts, ledger: { ...current.ledger, accounts: withoutCostAccounts, transactions: current.ledger.transactions.filter(item => item.props.accountId !== "cleaning") } };
    const statement = buildIncomeStatement(await input({ current: filtered, comparison: undefined }));
    expect(statement.expenses.costOfRevenue).toBeNull();
    expect(statement.profitability.grossProfit).toBeNull();
  });
  it("keeps uncategorized expenses visible and reports categorization coverage", async () => {
    const statement = buildIncomeStatement(await input());
    expect(statement.expenses.categories.find(item => item.category === "Uncategorized")?.amount?.amount).toBe(500);
    expect(statement.expenses.uncategorized.amount).toBe(500);
    expect(statement.expenses.categorizationCoverage).toBe(.75);
  });
  it("reconciles property, market and operating-model profitability upward", async () => {
    const statement = buildIncomeStatement(await input());
    expect(statement.properties.reduce((sum, item) => sum + item.revenue.amount, 0)).toBe(statement.profitability.revenue?.amount);
    expect(statement.properties.reduce((sum, item) => sum + (item.noi?.amount ?? 0), 0)).toBe(statement.profitability.noi?.amount);
    expect(statement.dimensions.markets.reduce((sum, item) => sum + item.revenue.amount, 0)).toBe(15_000);
    expect(statement.dimensions.operatingModels).toHaveLength(2);
  });
  it("creates decision-specific rankings without best or worst labels", async () => {
    const statement = buildIncomeStatement(await input());
    expect(statement.rankings.highestNoi[0]?.propertyId).toBe("one");
    expect(JSON.stringify(statement.rankings)).not.toMatch(/best|worst/i);
  });
  it("builds compatible trends, variance and at most five material drivers", async () => {
    const statement = buildIncomeStatement(await input());
    expect(statement.trends.find(item => item.metric === "noi")).toMatchObject({ classification: "improving", varianceDirection: "positive" });
    expect(statement.materialChanges.length).toBeLessThanOrEqual(5);
    expect(statement.drivers.expenses.some(item => item.label === "Maintenance")).toBe(true);
  });
  it("avoids misleading percentages from zero and near-zero baselines", () => {
    expect(safePercentageChange(2_400, 0)).toBeNull();
    expect(safePercentageChange(2_400, 50)).toBeNull();
  });
  it("makes profitability unavailable when expense coverage is insufficient", async () => {
    const current = await model();
    const partial = { ...current, evidence: { ...current.evidence, expenseCoverage: .5, gaps: ["Expense categorization incomplete."] } };
    const statement = buildIncomeStatement(await input({ current: partial, comparison: undefined }));
    expect(statement.expenses.total.amount).toBeNull();
    expect(statement.profitability.noi).toBeNull();
    expect(statement.profitability.operatingMargin).toBeNull();
    expect(statement.state).toBe("partial");
  });
  it("omits restricted category and transaction counts at the application boundary", async () => {
    const statement = buildIncomeStatement(await input({ canViewRevenueDetail: false, canViewExpenseDetail: false, permissionLimited: true }));
    expect(statement.revenue.categories).toEqual([]);
    expect(statement.expenses.categories).toEqual([]);
    expect(statement.permissionLimited).toBe(true);
  });
  it("rejects incompatible accounting basis and isolates cache permissions and scope", async () => {
    const base = await input();
    await expect(async () => buildIncomeStatement({ ...base, comparison: await model(.8, "cash") })).rejects.toThrow(/BASIS_MISMATCH/);
    expect(incomeStatementCacheKey(base)).not.toBe(incomeStatementCacheKey({ ...base, canViewExpenseDetail: false }));
    expect(incomeStatementCacheKey(base)).not.toBe(incomeStatementCacheKey({ ...base, scope: { ...base.scope, propertyIds: ["one"] } }));
  });
});
