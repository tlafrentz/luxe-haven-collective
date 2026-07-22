import { describe, expect, it } from "vitest";
import type { MarketComparableCandidate } from "../domain/comparable-acquisition";
import type { MarketProperty } from "../domain/property-resolution";
import { ProviderType } from "../domain/enums/provider-type";
import { buildDefaultMarketComparableQualificationPolicy } from "./market-comparable-qualification-policy";
import { assessMarketComparableEligibility } from "./assess-market-comparable-eligibility";
import { calculateMarketComparableSimilarity } from "./calculate-market-comparable-similarity";
import { assessMarketComparableOutliers } from "./assess-market-comparable-outliers";
import { calculateMarketComparableWeight, normalizeMarketComparableWeights } from "./calculate-market-comparable-weight";

const evaluatedAt = new Date("2026-07-21T00:00:00.000Z");
const subject: MarketProperty = { id: "subject", providerReferences: [{ provider: ProviderType.RentCast, externalId: "subject" }], address: { formatted: "1 Main St", addressLine1: "1 Main St", city: "Mesa", state: "AZ", postalCode: "85201" }, characteristics: { propertyType: "Single Family", bedrooms: 3, bathrooms: 2, squareFeet: 1650, yearBuilt: 2000 }, financialFacts: {} };
function candidate(overrides: Partial<MarketComparableCandidate> = {}): MarketComparableCandidate { return { id: "comp", purpose: "sale-valuation", providerReferences: [{ provider: ProviderType.RentCast, externalId: "comp" }], address: { formatted: "2 Main St" }, propertyType: "Single Family", bedrooms: 3, bathrooms: 2, squareFeet: 1650, yearBuilt: 2000, distanceMiles: 0.5, listing: { price: 400000, status: "sold", listedAt: new Date("2026-06-01") }, sourceRank: 1, dataGaps: [], provenance: [], ...overrides }; }

describe("comparable eligibility", () => {
  const sale = buildDefaultMarketComparableQualificationPolicy("sale-valuation", ["Single Family"]);
  it("accepts a valid sale comparable", () => expect(assessMarketComparableEligibility(subject, candidate(), sale.eligibility, evaluatedAt).status).toBe("eligible"));
  it("excludes a subject candidate defensively", () => { const result = assessMarketComparableEligibility(subject, candidate({ providerReferences: subject.providerReferences }), sale.eligibility, evaluatedAt); expect(result.status).toBe("excluded"); if (result.status === "excluded") expect(result.reasons[0]?.code).toBe("COMPARABLE_SUBJECT_MATCH"); });
  it.each([
    ["unsupported type", { propertyType: "Condo" }, "COMPARABLE_UNSUPPORTED_PROPERTY_TYPE"],
    ["excessive distance", { distanceMiles: 9 }, "COMPARABLE_DISTANCE_EXCEEDED"],
    ["stale evidence", { listing: { price: 400000, status: "sold", listedAt: new Date("2020-01-01") } }, "COMPARABLE_EVIDENCE_TOO_OLD"],
    ["missing price", { listing: undefined }, "COMPARABLE_PRICE_MISSING"],
    ["bedroom variance", { bedrooms: 7 }, "COMPARABLE_BEDROOM_VARIANCE_EXCEEDED"],
    ["bathroom variance", { bathrooms: 5 }, "COMPARABLE_BATHROOM_VARIANCE_EXCEEDED"],
    ["size variance", { squareFeet: 3000 }, "COMPARABLE_SQUARE_FEET_VARIANCE_EXCEEDED"],
  ] as const)("excludes %s", (_name, overrides, code) => { const result = assessMarketComparableEligibility(subject, candidate(overrides as Partial<MarketComparableCandidate>), sale.eligibility, evaluatedAt); expect(result.status).toBe("excluded"); if (result.status === "excluded") expect(result.reasons.map((item) => item.code)).toContain(code); });
  it.each([["missing type", { propertyType: undefined }, "COMPARABLE_PROPERTY_TYPE_UNRESOLVED"], ["missing square feet", { squareFeet: undefined }, "COMPARABLE_SQUARE_FEET_UNRESOLVED"]] as const)("marks %s unresolved", (_name, overrides, code) => { const result = assessMarketComparableEligibility(subject, candidate(overrides), sale.eligibility, evaluatedAt); expect(result.status).toBe("unresolved"); if (result.status === "unresolved") expect(result.reasons[0]?.code).toBe(code); });
  it("requires rent for rental purpose", () => { const rental = buildDefaultMarketComparableQualificationPolicy("long-term-rent", ["Single Family"]); const result = assessMarketComparableEligibility(subject, candidate({ purpose: "long-term-rent", listing: undefined }), rental.eligibility, evaluatedAt); expect(result.status).toBe("excluded"); });
});

describe("similarity, outliers, and weight", () => {
  const policy = buildDefaultMarketComparableQualificationPolicy("sale-valuation", ["Single Family"]);
  const similarity = (item: MarketComparableCandidate) => calculateMarketComparableSimilarity(subject, item, policy.similarity, evaluatedAt, policy.eligibility.maximumAgeDays, policy.eligibility.maximumDistanceMiles);
  it("scores an identical recent property highly", () => expect(similarity(candidate({ distanceMiles: 0 })).score).toBeGreaterThan(95));
  it.each([["distance", { distanceMiles: 4 }], ["bedrooms", { bedrooms: 5 }], ["bathrooms", { bathrooms: 3.5 }], ["square feet", { squareFeet: 2400 }], ["year", { yearBuilt: 1970 }], ["type", { propertyType: "Condo" }]] as const)("applies a %s penalty", (_name, overrides) => expect(similarity(candidate(overrides)).score).toBeLessThan(similarity(candidate()).score));
  it("omits and renormalizes missing dimensions", () => { const result = similarity(candidate({ yearBuilt: undefined })); expect(result.missingDimensions).toContain("year-built"); expect(result.components.reduce((sum, item) => sum + item.effectiveWeight, 0)).toBeCloseTo(100, 1); });
  it("keeps scores in range", () => expect(similarity(candidate({ distanceMiles: 999 })).score).toBeGreaterThanOrEqual(0));
  it("does not classify a two-item sample statistically", () => expect([...assessMarketComparableOutliers([candidate(), candidate({ id: "b", listing: { price: 900000, status: "sold" } })], policy.outliers).values()].every((item) => item.status === "insufficient-sample")).toBe(true));
  it("detects a clear hard high outlier", () => { const map = assessMarketComparableOutliers([candidate(), candidate({ id: "b", listing: { price: 410000, status: "sold" } }), candidate({ id: "x", listing: { price: 1200000, status: "sold" } })], policy.outliers); expect(map.get("x")?.status).toBe("hard-outlier"); });
  it("does not flag identical values", () => expect([...assessMarketComparableOutliers([candidate(), candidate({ id: "b" }), candidate({ id: "c" })], policy.outliers).values()].every((item) => item.status === "not-outlier")).toBe(true));
  it("gives stronger similarity more raw weight", () => { const strong = similarity(candidate()); const weak = similarity(candidate({ distanceMiles: 4 })); const outlier = { status: "not-outlier", dimensions: [], rationale: [] } as const; expect(calculateMarketComparableWeight(candidate(), strong, outlier, policy.weighting).rawWeight).toBeGreaterThan(calculateMarketComparableWeight(candidate(), weak, outlier, policy.weighting).rawWeight); });
  it("penalizes soft outliers", () => { const score = similarity(candidate()); expect(calculateMarketComparableWeight(candidate(), score, { status: "soft-outlier", dimensions: [], rationale: [] }, policy.weighting).rawWeight).toBeLessThan(calculateMarketComparableWeight(candidate(), score, { status: "not-outlier", dimensions: [], rationale: [] }, policy.weighting).rawWeight); });
  it("normalizes one candidate to one", () => { const score = similarity(candidate()); const weight = calculateMarketComparableWeight(candidate(), score, { status: "not-outlier", dimensions: [], rationale: [] }, policy.weighting); expect(normalizeMarketComparableWeights([{ candidate: candidate(), weight }])[0]?.normalizedWeight).toBe(1); });
  it("normalizes many candidates to one", () => { const score = similarity(candidate()); const weight = calculateMarketComparableWeight(candidate(), score, { status: "not-outlier", dimensions: [], rationale: [] }, policy.weighting); expect(normalizeMarketComparableWeights([{ candidate: candidate(), weight }, { candidate: candidate({ id: "b" }), weight }]).reduce((sum, item) => sum + item.normalizedWeight, 0)).toBe(1); });
});
