import type { StrComparable, StrMarketConfidence, StrMarketQuery } from "../domain";

export interface StrComparablePolicy {
  readonly version: string;
  readonly initialRadiusMiles: number;
  readonly maximumRadiusMiles: number;
  readonly targetComparableCount: number;
  readonly minimumComparableCount: number;
  readonly maximumComparableCount: number;
  readonly minimumActiveDays: number;
  readonly bedroomTolerance: number;
  readonly bathroomTolerance: number;
  readonly requireEntirePlace: boolean;
}

export interface ComparableWeightPolicy {
  readonly version: string;
  readonly distanceWeight: number;
  readonly bedroomWeight: number;
  readonly bathroomWeight: number;
  readonly propertyTypeWeight: number;
  readonly accommodatesWeight: number;
  readonly dataQualityWeight: number;
}

export const DEFAULT_STR_COMPARABLE_POLICY: StrComparablePolicy = Object.freeze({
  version: "str-comparables.v1", initialRadiusMiles: 3, maximumRadiusMiles: 10,
  targetComparableCount: 10, minimumComparableCount: 5, maximumComparableCount: 20,
  minimumActiveDays: 90, bedroomTolerance: 1, bathroomTolerance: 1, requireEntirePlace: true,
});

export const DEFAULT_STR_WEIGHT_POLICY: ComparableWeightPolicy = Object.freeze({
  version: "str-similarity.v1", distanceWeight: 0.25, bedroomWeight: 0.18,
  bathroomWeight: 0.12, propertyTypeWeight: 0.2, accommodatesWeight: 0.1, dataQualityWeight: 0.15,
});

const clamp = (value: number) => Math.max(0, Math.min(100, value));
const match = (subject?: number, comparable?: number, tolerance = 1) =>
  subject === undefined || comparable === undefined ? 50 : clamp(100 - Math.abs(subject - comparable) * (100 / (tolerance + 1)));

export function qualifyAndWeightComparables(
  comparables: readonly StrComparable[],
  query: StrMarketQuery,
  policy: StrComparablePolicy = DEFAULT_STR_COMPARABLE_POLICY,
  weights: ComparableWeightPolicy = DEFAULT_STR_WEIGHT_POLICY,
): readonly StrComparable[] {
  const scored = comparables.map((comparable) => {
    const reasons: string[] = [];
    const distance = comparable.location.distanceMiles;
    if (distance !== undefined && distance > policy.maximumRadiusMiles) reasons.push("outside-maximum-radius");
    if (policy.requireEntirePlace && comparable.property.roomType && !/entire/i.test(comparable.property.roomType)) reasons.push("not-entire-place");
    if (query.property.propertyType && comparable.property.propertyType
      && query.property.propertyType.toLowerCase() !== comparable.property.propertyType.toLowerCase()) reasons.push("incompatible-property-type");
    if (query.property.bedrooms !== undefined && comparable.property.bedrooms !== undefined
      && Math.abs(query.property.bedrooms - comparable.property.bedrooms) > policy.bedroomTolerance) reasons.push("bedroom-tolerance-exceeded");
    if (comparable.performance.activeDays !== undefined && comparable.performance.activeDays < policy.minimumActiveDays) reasons.push("insufficient-active-days");
    if (!comparable.performance.adr && !comparable.performance.annualRevenue) reasons.push("missing-performance-data");

    const distanceScore = distance === undefined ? 50 : clamp(100 * (1 - distance / policy.maximumRadiusMiles));
    const propertyTypeScore = !query.property.propertyType || !comparable.property.propertyType ? 50
      : query.property.propertyType.toLowerCase() === comparable.property.propertyType.toLowerCase() ? 100 : 0;
    const quality = clamp(100 - comparable.missingFields.length * 8);
    const similarityScore = clamp(
      distanceScore * weights.distanceWeight
      + match(query.property.bedrooms, comparable.property.bedrooms, policy.bedroomTolerance) * weights.bedroomWeight
      + match(query.property.bathrooms, comparable.property.bathrooms, policy.bathroomTolerance) * weights.bathroomWeight
      + propertyTypeScore * weights.propertyTypeWeight
      + match(query.property.accommodates, comparable.property.accommodates, 2) * weights.accommodatesWeight
      + quality * weights.dataQualityWeight,
    );
    return { ...comparable, eligibility: reasons.length ? "excluded" as const : "eligible" as const,
      similarityScore: Math.round(similarityScore), evidenceQualityScore: Math.round(quality), exclusionReasons: reasons, weight: 0 };
  });
  const eligibleTotal = scored.filter((item) => item.eligibility === "eligible")
    .reduce((sum, item) => sum + item.similarityScore * item.evidenceQualityScore, 0);
  return scored.map((item) => ({ ...item, weight: item.eligibility === "eligible" && eligibleTotal > 0
    ? (item.similarityScore * item.evidenceQualityScore) / eligibleTotal : 0 }));
}

export function assessStrMarketConfidence(input: {
  readonly query: StrMarketQuery; readonly comparables: readonly StrComparable[];
  readonly hasRevenueEstimate: boolean; readonly hasMarketMetrics: boolean; readonly hasSeasonality: boolean;
  readonly relaxedRules: readonly string[]; readonly dataAgeDays?: number; readonly providerScore?: number;
}): StrMarketConfidence {
  const eligible = input.comparables.filter((item) => item.eligibility === "eligible");
  const averageSimilarity = eligible.length ? eligible.reduce((sum, item) => sum + item.similarityScore, 0) / eligible.length : 0;
  const components = [
    { name: "response-completeness", score: [input.hasRevenueEstimate, input.hasMarketMetrics, input.hasSeasonality].filter(Boolean).length / 3 * 100, rationale: "Available canonical response sections." },
    { name: "qualified-comparables", score: clamp(eligible.length / 10 * 100), rationale: `${eligible.length} qualified comparable listings.` },
    { name: "comparable-similarity", score: averageSimilarity, rationale: `${Math.round(averageSimilarity)} average similarity score.` },
    { name: "data-freshness", score: input.dataAgeDays === undefined ? 70 : clamp(100 - input.dataAgeDays * 3), rationale: "Age of provider evidence." },
    { name: "subject-completeness", score: clamp(100 - input.query.missingInputs.length * 15), rationale: `${input.query.missingInputs.length} subject inputs unavailable.` },
    { name: "policy-integrity", score: clamp(100 - input.relaxedRules.length * 20), rationale: `${input.relaxedRules.length} comparable rules relaxed.` },
    ...(input.providerScore === undefined ? [] : [{ name: "provider-confidence", score: clamp(input.providerScore), rationale: "Provider-reported confidence retained as one input." }]),
  ].map((item) => ({ ...item, score: Math.round(item.score) }));
  const score = Math.round(components.reduce((sum, item) => sum + item.score, 0) / components.length);
  const limitations = [
    ...(eligible.length < 5 ? [`Only ${eligible.length} qualified comparables were available.`] : []),
    ...input.query.missingInputs.map((field) => `${field} was unavailable for matching.`),
    ...input.relaxedRules.map((rule) => `Comparable policy relaxed: ${rule}.`),
    ...(!input.hasSeasonality ? ["Monthly seasonality is unavailable."] : []),
  ];
  return { score, level: score >= 80 ? "high" : score >= 55 ? "moderate" : "low", components, limitations };
}
