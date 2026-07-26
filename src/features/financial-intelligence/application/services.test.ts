import { describe, expect, it, vi } from "vitest";
import { permissionsForRole, type WorkspaceAccessContext, type WorkspaceRole } from "@/features/workspace";
import { Money } from "@/platform/kernel";
import { FinancialTransaction, type FinancialAccount, type FinancialIdentity, type FinancialPeriod } from "../domain";
import { buildFinancialReadModel, type FinancialSource, type GetFinancialSnapshotQuery } from ".";

const period: FinancialPeriod = { kind: "month", from: "2026-07-01", to: "2026-07-31", comparison: { from: "2026-06-01", to: "2026-06-30" }, reportingCalendar: "fiscal" };
const identity: FinancialIdentity = { workspaceId: "workspace-1", organizationId: "organization-1", reportingCurrency: "USD", fiscalYearStartMonth: 1, timezone: "America/Chicago", reportingStandards: ["GAAP"], accountingMethod: "accrual" };
const accounts: readonly FinancialAccount[] = [
  { id: "revenue", workspaceId: "workspace-1", code: "4000", name: "Accommodation", category: "revenue", subcategory: "accommodation", active: true },
  { id: "expense", workspaceId: "workspace-1", code: "6000", name: "Cleaning", category: "operating-expense", subcategory: "cleaning", active: true },
  { id: "asset", workspaceId: "workspace-1", code: "1000", name: "Cash", category: "asset", active: true },
];
function access(role: WorkspaceRole = "owner", propertyIds: readonly string[] = []): WorkspaceAccessContext {
  return { profileId: "p", workspaceId: "workspace-1", ownerId: "o", ownerProfileId: "p", membershipId: "m", role, status: "active", propertyAccess: role === "owner" || role === "administrator" ? { type: "all" } : { type: "selected", propertyIds }, permissions: permissionsForRole(role) };
}
function transaction(id: string, accountId: string, amount: number, measurement: "measured" | "projected" | "forecast" | "estimated" = "measured", evidenceIds = [`e-${id}`]) {
  return FinancialTransaction.create({ id, accountId, workspaceId: "workspace-1", propertyId: "property-1", amount: Money.usd(amount), category: accountId, measurement, effectiveDate: "2026-07-10", postingDate: "2026-07-11", source: { provider: "stripe" }, status: "posted", evidenceIds });
}
function source(overrides: Partial<FinancialSource> = {}): FinancialSource {
  return {
    getIdentity: vi.fn(async () => identity),
    listAccounts: vi.fn(async () => accounts),
    listTransactions: vi.fn(async () => [transaction("r1", "revenue", 4_120), transaction("r2", "revenue", 500, "projected"), transaction("e1", "expense", 1_480), transaction("a1", "asset", 8_000)]),
    getSynchronization: vi.fn(async () => ({ lastSuccessfulAt: "2026-07-25T10:00:00.000Z", expectedProviders: 1, connectedProviders: 1, historyMonths: 18 })),
    ...overrides,
  };
}
function query(overrides: Partial<GetFinancialSnapshotQuery> = {}): GetFinancialSnapshotQuery {
  return { access: access(), workspaceId: "workspace-1", propertyId: "property-1", period, evaluatedAt: "2026-07-25T12:00:00.000Z", ...overrides };
}

describe("canonical financial read model", () => {
  it("builds workspace/property snapshots only from posted ledger transactions", async () => {
    const model = await buildFinancialReadModel(source(), query());
    expect(model.snapshot.revenue.amount).toBe(4_620);
    expect(model.snapshot.expenses.amount).toBe(1_480);
    expect(model.snapshot.assets.amount).toBe(8_000);
    expect(model.snapshot.valuesByMeasurement.measured.revenue.amount).toBe(4_120);
    expect(model.snapshot.valuesByMeasurement.projected.revenue.amount).toBe(500);
    expect(model.confidence).toBe("high");
    expect(model.freshness).toBe("current");
    expect(model.transactions).toEqual([]);
  });

  it("reveals transaction detail only with explicit detail authorization", async () => {
    const model = await buildFinancialReadModel(source(), query({ access: access("operator", ["property-1"]), authorizationLevel: "detail" }));
    expect(model.transactions).toHaveLength(4);
  });

  it("propagates partial evidence, missing expenses, and stale synchronization", async () => {
    const gateway = source({
      listTransactions: vi.fn(async () => [transaction("r1", "revenue", 100, "measured", [])]),
      getSynchronization: vi.fn(async () => ({ lastSuccessfulAt: "2026-07-20T00:00:00.000Z", expectedProviders: 2, connectedProviders: 1, historyMonths: 1 })),
    });
    const model = await buildFinancialReadModel(gateway, query());
    expect(model.evidence.gaps).toContain("Expense coverage incomplete.");
    expect(model.confidence).toBe("low");
    expect(model.freshness).toBe("stale");
  });

  it.each([
    ["anonymous", { access: null }, "ANONYMOUS_DENIED"],
    ["cross workspace", { access: { ...access(), workspaceId: "other" } }, "CROSS_WORKSPACE_DENIED"],
    ["viewer detail", { access: access("viewer", ["property-1"]), authorizationLevel: "detail" as const }, "FINANCIAL_ACCESS_DENIED"],
    ["unassigned property", { access: access("operator", ["property-2"]) }, "PROPERTY_ACCESS_DENIED"],
  ])("denies %s before financial repositories are queried", async (_label, overrides, code) => {
    const gateway = source();
    await expect(buildFinancialReadModel(gateway, query(overrides))).rejects.toMatchObject({ code });
    expect(gateway.getIdentity).not.toHaveBeenCalled();
  });

  it("rejects source data outside the authorized property scope", async () => {
    const gateway = source({ listTransactions: vi.fn(async () => [transaction("foreign", "revenue", 1)]) });
    await expect(buildFinancialReadModel(gateway, query({ propertyId: "property-2" }))).rejects.toMatchObject({ code: "SOURCE_SCOPE_VIOLATION" });
  });

  it("rejects mixed currency rather than silently aggregating it", async () => {
    const mixed = FinancialTransaction.create({ ...transaction("eur", "revenue", 1).props, amount: Money.of(1, "EUR") });
    await expect(buildFinancialReadModel(source({ listTransactions: vi.fn(async () => [mixed]) }), query())).rejects.toMatchObject({ code: "CURRENCY_MISMATCH" });
  });
});
