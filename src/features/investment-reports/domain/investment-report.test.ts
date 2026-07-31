import { describe, expect, it } from "vitest";
import { buildInvestmentReportSnapshot, InvestmentReportError } from "./investment-report";
import type { ImmutableAnalysisProjection } from "@/features/investment-opportunity";

function analysis(strategy: "purchase" | "rental-arbitrage" = "purchase"): ImmutableAnalysisProjection {
  return {
    projectionVersion: "investment-analysis-projection.v1",
    opportunity: { id: "investment-opportunity-1", name: "Lake House", status: "evaluating", tags: [], archived: false, route: strategy, aggregateVersion: 2, property: { displayAddress: "1 Lake Way", normalizedAddress: { address1: "1 Lake Way", city: "Austin", state: "TX", postalCode: "78701" }, propertyType: "House", bedrooms: 3, bathrooms: 2, resolutionStatus: "user-supplied", capturedAt: new Date("2026-07-01") } },
    analysisVersion: { id: "opportunity-analysis-1", number: 3, createdAt: new Date("2026-07-02"), author: { type: "user", id: "u1" }, policyVersions: { opportunitySnapshotSchema: "1", investmentAnalysisPolicy: "calc.v2", investmentRecommendationPolicy: "score.v3" }, lineage: { investmentLifecycleResultId: "life-1", evidenceIds: ["e1"] }, sourceSummary: { userSuppliedCount: 1, learningSuppliedCount: 0, marketSuppliedCount: 0, defaultSuppliedCount: 0, overrides: [], marketEvidenceAvailable: false } },
    snapshot: { schemaVersion: "1", route: strategy, subject: { id: "subject-1", normalizedAddress: { address1: "1 Lake Way", city: "Austin", state: "TX", postalCode: "78701" } }, recommendation: { recommendation: "buy-with-conditions", summary: "Attractive with evidence limitations.", rationale: ["Cash flow is positive."], conditions: ["Verify demand."] }, score: { value: 78, scaleMinimum: 0, scaleMaximum: 100 }, confidence: { level: "moderate", explanation: "User inputs dominate." }, financials: { projectedAnnualRevenue: { amount: 90000, currency: "USD" }, projectedAdr: { amount: 250, currency: "USD" }, projectedOccupancy: { value: .65 }, operatingExpenses: { amount: 30000, currency: "USD" }, netOperatingIncome: { amount: 60000, currency: "USD" }, annualCashFlow: { amount: 30000, currency: "USD" }, cashOnCashReturn: { value: .12 }, initialCashRequired: { amount: 250000, currency: "USD" }, ...(strategy === "purchase" ? { purchasePrice: { amount: 800000, currency: "USD" as const }, capRate: { value: .075 } } : { proposedMonthlyLease: { amount: 4000, currency: "USD" as const } }) }, market: { name: "Austin", medianAdr: { amount: 240, currency: "USD" }, medianOccupancy: { value: .62 }, trend: "stable" }, risks: [], dataGaps: [{ code: "NO_EXTERNAL_MARKET", description: "No external market data available." }], evidence: [], assumptions: [{ key: "occupancy", value: .65, source: "user", unit: "percentage" }], analyzedAt: new Date("2026-07-02") },
    assumptions: [{ key: "occupancy", value: .65, source: "user", unit: "percentage" }],
  };
}

describe("Investment Report snapshot", () => {
  it.each(["purchase", "rental-arbitrage"] as const)("snapshots a completed %s analysis with exact lineage", strategy => {
    const result = buildInvestmentReportSnapshot(analysis(strategy), new Date("2026-07-30T12:00:00Z"));
    expect(result.lineage).toMatchObject({ opportunityId: "investment-opportunity-1", analysisId: "opportunity-analysis-1", analysisVersion: 3, strategy });
    expect(result.financials.projectedAnnualRevenue.amount).toBe(90000);
    expect(result.limitations[0].code).toBe("NO_EXTERNAL_MARKET");
  });
  it("is detached and immutable when the working analysis changes", () => {
    const source = analysis(), result = buildInvestmentReportSnapshot(source, new Date());
    (source.snapshot.financials.projectedAnnualRevenue as { amount: number }).amount = 1;
    expect(result.financials.projectedAnnualRevenue.amount).toBe(90000);
    expect(Object.isFrozen(result.financials)).toBe(true);
  });
  it("rejects missing canonical projections without synthesizing figures", () => {
    const source = analysis();
    delete (source.snapshot.financials as { projectedAnnualRevenue?: unknown }).projectedAnnualRevenue;
    expect(() => buildInvestmentReportSnapshot(source, new Date())).toThrowError(InvestmentReportError);
    try { buildInvestmentReportSnapshot(source, new Date()); } catch (error) { expect((error as InvestmentReportError).code).toBe("CANONICAL_PROJECTIONS_UNAVAILABLE"); }
  });
});
