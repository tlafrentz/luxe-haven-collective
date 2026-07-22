import type { MarketComparablePurpose } from "../domain/comparable-acquisition";
import type { MarketComparableQualificationPolicy } from "../domain/comparable-qualification";

export function buildDefaultMarketComparableQualificationPolicy(purpose: Exclude<MarketComparablePurpose, "short-term-rental-performance">, allowedPropertyTypes: readonly string[] = []): MarketComparableQualificationPolicy {
  return deepFreeze({
    purpose,
    eligibility: { allowedPropertyTypes: [...allowedPropertyTypes].sort(), maximumDistanceMiles: 5, maximumAgeDays: purpose === "sale-valuation" ? 365 : 270, bedroomDifferenceMaximum: 2, bathroomDifferenceMaximum: 1.5, squareFeetVarianceMaximum: 0.5, requirePrice: purpose === "sale-valuation", requireTransactionDate: false, requireMonthlyRent: purpose === "long-term-rent", requireCoordinates: false },
    similarity: { weights: { distance: 25, "square-feet": 20, bedrooms: 15, bathrooms: 10, "year-built": 5, "property-type": 15, recency: 10 }, maximumYearBuiltDifference: 40 },
    outliers: { minimumSampleSize: 3, softDeviationRatio: 0.35, hardDeviationRatio: 0.6 },
    weighting: { softOutlierMultiplier: 0.5, incompleteEvidenceMultiplier: 0.8 }, minimumIncludedComparables: 3, preferredComparableCount: 5,
  });
}
function deepFreeze<T>(value: T): T { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child); } return value; }
