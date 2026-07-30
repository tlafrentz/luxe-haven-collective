import { describe, expect, it } from "vitest";
import type { StrMarketSnapshot } from "@/features/market-intelligence/str/domain";
import {
  acceptMarketAssumption, buildInvestmentAnalysisMarketContext, calculateSnapshotFreshness,
  detectMaterialMarketChanges, overrideMarketAssumption, projectInvestmentMemoMarketEvidence,
  proposeMarketAssumptions, restoreMarketAssumption, selectedAssumption,
} from "./market-intelligence-experience";

const now = new Date("2026-07-29T12:00:00.000Z");
function snapshot(overrides: Partial<StrMarketSnapshot> = {}): StrMarketSnapshot {
  return {
    id: "market-1", ownerId: "owner-1", workspaceId: "workspace-1", subjectPropertyId: "subject-1",
    subjectPropertySnapshotId: "property-1", provider: "airroi", providerSnapshotReferences: [],
    schemaVersion: "str-market-snapshot.v1", providerVersion: "airroi-api.v1", queryPolicyVersion: "str-query.v1",
    comparablePolicyVersion: "str-comparables.v1", createdAt: "2026-07-20T00:00:00.000Z", expiresAt: "2026-08-19T00:00:00.000Z",
    query: { subjectPropertyId: "subject-1", subjectPropertySnapshotId: "property-1", location: { latitude: 1, longitude: 1 },
      property: {}, requestedAt: "2026-07-20T00:00:00.000Z", missingInputs: [] },
    revenueEstimate: { projectedAdr: { amount: 228, currency: "USD" }, projectedOccupancy: { value: 68 },
      projectedRevPar: { amount: 155.04, currency: "USD" }, projectedAnnualRevenue: { amount: 56_589.6, currency: "USD" },
      projectedMonthlyRevenue: { amount: 4_715.8, currency: "USD" }, currency: "USD", period: { basis: "provider-estimate" },
      confidence: { score: 82, level: "high" }, evidenceIds: ["adr-evidence", "occupancy-evidence"], metricLineage: {} },
    comparables: [], confidence: { score: 82, level: "high", components: [], limitations: ["Guest capacity unavailable."] },
    completeness: "complete", evidence: [], evidenceIds: [], warnings: [], relaxedRules: [], ...overrides,
  };
}

describe("WI-003 market experience contracts", () => {
  it("supports accept, override, restore, and selected-value precedence without mutating the proposal", () => {
    const proposed = proposeMarketAssumptions(snapshot()).adr;
    const accepted = acceptMarketAssumption(proposed, now), overridden = overrideMarketAssumption(accepted, 245, now, "Premium finish");
    expect(selectedAssumption(overridden, 190)).toBe(245);
    expect(overridden).toMatchObject({ state: "user-overridden", value: 245, marketValue: 228 });
    expect(restoreMarketAssumption(overridden)).toMatchObject({ state: "market-derived", value: 228 });
    expect(proposed).toMatchObject({ state: "market-derived", value: 228 });
  });
  it("calculates current, expiring, stale, and unavailable freshness", () => {
    expect(calculateSnapshotFreshness(snapshot(), now)).toBe("current");
    expect(calculateSnapshotFreshness(snapshot({ expiresAt: "2026-07-30T00:00:00.000Z" }), now)).toBe("expiring-soon");
    expect(calculateSnapshotFreshness(snapshot({ expiresAt: "2026-07-28T00:00:00.000Z" }), now)).toBe("stale");
    expect(calculateSnapshotFreshness(undefined, now)).toBe("unavailable");
  });
  it("detects material metric changes between immutable snapshot versions", () => {
    const changes = detectMaterialMarketChanges(snapshot(), snapshot({ id: "market-2", revenueEstimate: {
      ...snapshot().revenueEstimate!, projectedAdr: { amount: 245, currency: "USD" },
    } }));
    expect(changes).toContainEqual(expect.objectContaining({ metric: "adr", previous: 228, current: 245, absoluteChange: 17 }));
  });
  it("builds analysis context and memo projection with exact snapshot and override lineage", () => {
    const market = snapshot(), selections = proposeMarketAssumptions(market);
    const selected = { ...selections, adr: overrideMarketAssumption(selections.adr, 245, now) };
    const context = buildInvestmentAnalysisMarketContext({ snapshot: market, selections: selected });
    expect(context.selectedAssumptions.adr).toMatchObject({ selectedValue: 245, marketValue: 228, sourceType: "user-override", marketSnapshotId: "market-1" });
    const memo = projectInvestmentMemoMarketEvidence(context, now);
    expect(memo?.references).toMatchObject({ marketSnapshotId: "market-1", subjectPropertySnapshotId: "property-1", comparablePolicyVersion: "str-comparables.v1" });
    expect(memo?.assumptions.find(item => item.assumption === "adr")).toMatchObject({ usedValue: 245, marketValue: 228, overridden: true });
  });
});
