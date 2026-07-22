import { describe, expect, it } from "vitest";
import type { MarketComparableCandidate } from "../domain/comparable-acquisition";
import type { MarketComparableQualificationResult, QualifiedMarketComparable } from "../domain/comparable-qualification";
import { buildMarketEstimateCore } from "./build-market-estimate-analysis";

function included(id: string, value: number, weight: number, similarity = 80, purpose: "sale-valuation" | "long-term-rent" = "sale-valuation"): QualifiedMarketComparable {
  const candidate: MarketComparableCandidate = { id, purpose, providerReferences: [], address: { formatted: id }, propertyType: "Single Family", bedrooms: 3, bathrooms: 2, squareFeet: 1000, ...(purpose === "sale-valuation" ? { listing: { price: value, status: "sold" as const } } : { rental: { monthlyRent: value, status: "active" as const } }), dataGaps: [], provenance: [] };
  return { candidate, eligibility: { status: "eligible", reasons: [{ code: "COMPARABLE_ELIGIBLE", description: "eligible" }] }, similarity: { score: similarity, components: [], missingDimensions: [], rationale: [] }, outlier: { status: "not-outlier", dimensions: [], rationale: [] }, weight: { rawWeight: weight, components: [], rationale: [] }, normalizedWeight: weight, inclusionReasons: [], dataGaps: [] };
}
function qualification(items: readonly QualifiedMarketComparable[], sufficiency: "sufficient" | "limited" | "insufficient" = "sufficient"): MarketComparableQualificationResult { return { qualificationId: "q", subjectId: "s", acquisitionId: "a", purpose: items[0]?.candidate.purpose === "long-term-rent" ? "long-term-rent" : "sale-valuation", included: items, excluded: [], unresolved: [], summary: { acquiredCount: items.length, includedCount: items.length, excludedCount: 0, unresolvedCount: 0, sufficiency, totalNormalizedWeight: items.reduce((sum, item) => sum + item.normalizedWeight, 0), dataGapCount: 0 }, policySnapshot: {} as MarketComparableQualificationResult["policySnapshot"], dataGaps: [], lineage: { subjectId: "s", acquisitionId: "a", candidateIds: items.map((item) => item.candidate.id) }, evaluatedAt: new Date("2026-01-01") } as MarketComparableQualificationResult; }
const policy = { minimumEstimateComparables: 1, lowPercentile: 0.25, highPercentile: 0.75 } as const;

describe("buildMarketEstimateCore", () => {
  it("uses qualification normalized weights", () => expect(buildMarketEstimateCore(qualification([included("a", 300000, 0.25), included("b", 500000, 0.75)]), policy, 2000).estimate).toBe(450000));
  it("calculates a supported range containing the estimate", () => expect(buildMarketEstimateCore(qualification([included("a", 300000, 0.5), included("b", 500000, 0.5)]), policy, 2000).range).toEqual({ lower: 350000, upper: 450000 }));
  it("calculates estimate per subject square foot", () => expect(buildMarketEstimateCore(qualification([included("a", 400000, 1)]), policy, 2000).unitEstimate).toBe(200));
  it("omits unit estimate when subject square footage is unavailable", () => expect(buildMarketEstimateCore(qualification([included("a", 400000, 1)]), policy, undefined).unitEstimate).toBeUndefined());
  it("supports weighted monthly rent without STR conversion", () => { const result = buildMarketEstimateCore(qualification([included("a", 2000, 0.5, 80, "long-term-rent"), included("b", 2400, 0.5, 80, "long-term-rent")]), policy, 1000); expect(result.estimate).toBe(2200); expect(result).not.toHaveProperty("annualRevenue"); });
  it("marks one-comparable estimates limited when qualification is limited", () => expect(buildMarketEstimateCore(qualification([included("a", 400000, 1)], "insufficient"), policy, 2000).status).toBe("limited"));
  it("produces no estimate below explicit policy minimum", () => { const result = buildMarketEstimateCore(qualification([included("a", 400000, 1)], "insufficient"), { ...policy, minimumEstimateComparables: 2 }, 2000); expect(result.status).toBe("insufficient"); expect(result.estimate).toBeUndefined(); });
  it("keeps confidence separate from estimate attractiveness", () => { const low = buildMarketEstimateCore(qualification([included("a", 100, 1)]), policy, 10); const high = buildMarketEstimateCore(qualification([included("a", 1000000, 1)]), policy, 10); expect(low.confidence).toEqual(high.confidence); });
  it("bounds confidence score", () => expect(buildMarketEstimateCore(qualification([]), policy, 1000).confidence.score).toBeGreaterThanOrEqual(0));
  it("is deterministic and does not mutate qualification", () => { const source = qualification([included("a", 400000, 1)]); const before = structuredClone(source); expect(buildMarketEstimateCore(source, policy, 2000)).toEqual(buildMarketEstimateCore(source, policy, 2000)); expect(source).toEqual(before); });
});
