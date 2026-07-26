import { describe, expect, it, vi } from "vitest";
import { permissionsForRole } from "@/features/workspace";
import { Money } from "@/platform/kernel";
import { FinancialTransaction, type FinancialPeriod } from "../domain";
import { financialCacheKey } from "../application";
import { ComputedFinancialReadModelRepository, InMemoryFinancialSnapshotRepository } from ".";

const period: FinancialPeriod = { kind: "month", from: "2026-07-01", to: "2026-07-31", reportingCalendar: "calendar" };
const access = { profileId: "p", workspaceId: "w", ownerId: "o", ownerProfileId: "p", membershipId: "m", role: "owner" as const, status: "active" as const, propertyAccess: { type: "all" as const }, permissions: permissionsForRole("owner") };
const query = { access, workspaceId: "w", period, evaluatedAt: "2026-07-25T12:00:00.000Z" };
const account = { id: "revenue", workspaceId: "w", code: "4000", name: "Revenue", category: "revenue" as const, active: true };
const tx = FinancialTransaction.create({ id: "tx", accountId: "revenue", workspaceId: "w", amount: Money.usd(10), category: "accommodation", measurement: "measured", effectiveDate: "2026-07-01", postingDate: "2026-07-01", source: { provider: "pms" }, status: "posted", evidenceIds: ["e"] });

describe("financial infrastructure", () => {
  it("uses complete cache dimensions, stores snapshots, observes reads, and invalidates by workspace", async () => {
    const cache = new InMemoryFinancialSnapshotRepository();
    const observed = vi.fn();
    const source = { getIdentity: vi.fn(async () => ({ workspaceId: "w", organizationId: "o", reportingCurrency: "USD", fiscalYearStartMonth: 1, timezone: "UTC", reportingStandards: ["GAAP"], accountingMethod: "cash" as const })), listAccounts: vi.fn(async () => [account]), listTransactions: vi.fn(async () => [tx]), getSynchronization: vi.fn(async () => ({ lastSuccessfulAt: query.evaluatedAt, expectedProviders: 1, connectedProviders: 1, historyMonths: 12 })) };
    const repository = new ComputedFinancialReadModelRepository(source, cache, { evaluated: observed }, (() => { let time = 10; return () => time++; })());
    const snapshot = await repository.getFinancialSnapshot(query);
    const key = financialCacheKey(query, "USD");
    expect(key).toContain("w|2026-07-01|2026-07-31|none|m:read:workspace|USD|0");
    expect(cache.getByKey(key)).toEqual(snapshot);
    expect(observed).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: "w", transactionCount: 1, durationMs: 1 }));
    await repository.getFinancialSnapshot(query);
    expect(source.listTransactions).toHaveBeenCalledTimes(1);
    await cache.invalidateWorkspace("w");
    expect(cache.getByKey(key)).toBeNull();
  });

  it("propagates repository failures without manufacturing financial values", async () => {
    const source = { getIdentity: vi.fn(async () => { throw new Error("provider unavailable"); }), listAccounts: vi.fn(), listTransactions: vi.fn(), getSynchronization: vi.fn() };
    await expect(new ComputedFinancialReadModelRepository(source).getFinancialSnapshot(query)).rejects.toThrow("provider unavailable");
  });
});
