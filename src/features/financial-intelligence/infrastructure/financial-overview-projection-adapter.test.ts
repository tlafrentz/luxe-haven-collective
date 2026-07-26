import { describe, expect, it, vi } from "vitest";
import { permissionsForRole, type WorkspaceAccessContext } from "@/features/workspace";
import { Money } from "@/platform/kernel";
import { FinancialTransaction, type FinancialAccount } from "../domain";
import { FinancialOverviewProjectionAdapter } from ".";

const account: FinancialAccount = { id: "revenue", workspaceId: "w", code: "4000", name: "Revenue", category: "revenue", active: true };
const transaction = (propertyId: string) => FinancialTransaction.create({ id: `tx-${propertyId}`, accountId: "revenue", workspaceId: "w", propertyId, amount: Money.usd(100), category: "accommodation", measurement: "measured", effectiveDate: "2026-07-01", postingDate: "2026-07-01", source: { provider: "ledger" }, status: "posted", evidenceIds: ["e"] });
const source = () => ({ getIdentity: vi.fn(async () => ({ workspaceId: "w", organizationId: "o", reportingCurrency: "USD", fiscalYearStartMonth: 1, timezone: "UTC", reportingStandards: ["GAAP"], accountingMethod: "accrual" as const })), listAccounts: vi.fn(async () => [account]), listTransactions: vi.fn(async (scope: { propertyId?: string; propertyIds?: readonly string[] }) => (scope.propertyId ? [transaction(scope.propertyId)] : (scope.propertyIds ?? []).map(transaction))), getSynchronization: vi.fn(async () => ({ lastSuccessfulAt: "2026-07-25T00:00:00Z", expectedProviders: 1, connectedProviders: 1, historyMonths: 12 })) });
const catalog = { list: vi.fn(async () => [{ propertyId: "one", label: "One", included: true, reportingEligible: true }, { propertyId: "two", label: "Two", included: true, reportingEligible: true }]) };
function access(role: "owner" | "operator", ids: readonly string[] = []): WorkspaceAccessContext { return { profileId: "p", workspaceId: "w", ownerId: "w", ownerProfileId: "p", membershipId: "m", role, status: "active", propertyAccess: role === "owner" ? { type: "all" } : { type: "selected", propertyIds: ids }, permissions: permissionsForRole(role) }; }
const query = { workspaceId: "w", period: { kind: "month" as const, from: "2026-07-01", to: "2026-07-31", reportingCalendar: "calendar" as const }, comparisonType: "none" as const, evaluatedAt: "2026-07-25T12:00:00Z" };

describe("Financial Overview projection adapter", () => {
  it("resolves authorized included properties before aggregation and omits cash for operators", async () => {
    const gateway = source();
    const result = await new FinancialOverviewProjectionAdapter(access("operator", ["two"]), gateway, catalog, { liquidity: { read: vi.fn(async () => ({ balance: Money.usd(1), netMovement: Money.usd(1), asOf: query.evaluatedAt, qualification: "measured" as const, confidence: "high" as const, freshness: "current" as const, evidenceIds: [], internalTransfersEliminated: true })) } }).read(query);
    expect(result.scope.propertyIds).toEqual(["two"]);
    expect(result.canViewCash).toBe(false);
    expect(result.cash).toBeUndefined();
    expect(gateway.listTransactions).toHaveBeenCalledWith(expect.objectContaining({ propertyIds: ["two"] }));
  });
  it("denies inaccessible selected properties before financial reads", async () => {
    const gateway = source();
    await expect(new FinancialOverviewProjectionAdapter(access("operator", ["one"]), gateway, catalog).read({ ...query, propertyIds: ["two"] })).rejects.toMatchObject({ code: "permission" });
    expect(gateway.getIdentity).not.toHaveBeenCalled();
  });
  it("allows owners to receive cash from a bounded source", async () => {
    const result = await new FinancialOverviewProjectionAdapter(access("owner"), source(), catalog, { liquidity: { read: vi.fn(async () => ({ balance: Money.usd(500), netMovement: Money.usd(-10), asOf: query.evaluatedAt, qualification: "measured" as const, confidence: "high" as const, freshness: "current" as const, evidenceIds: ["cash"], internalTransfersEliminated: true })) } }).read(query);
    expect(result.cash?.balance.amount).toBe(500);
  });
});
