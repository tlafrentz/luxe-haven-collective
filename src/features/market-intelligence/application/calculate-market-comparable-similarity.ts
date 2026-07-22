import type { MarketComparableCandidate } from "../domain/comparable-acquisition";
import type { MarketComparableSimilarityAssessment, MarketComparableSimilarityComponent, MarketComparableSimilarityDimension, MarketComparableSimilarityPolicy } from "../domain/comparable-qualification";
import type { MarketProperty } from "../domain/property-resolution";

export function calculateMarketComparableSimilarity(subject: MarketProperty, candidate: MarketComparableCandidate, policy: MarketComparableSimilarityPolicy, evaluatedAt: Date, maximumAgeDays: number, maximumDistanceMiles: number): MarketComparableSimilarityAssessment {
  const values: Partial<Record<MarketComparableSimilarityDimension, number>> = {};
  if (candidate.distanceMiles !== undefined) values.distance = linear(candidate.distanceMiles, maximumDistanceMiles);
  if (subject.characteristics.squareFeet && candidate.squareFeet) values["square-feet"] = linear(Math.abs(candidate.squareFeet - subject.characteristics.squareFeet) / subject.characteristics.squareFeet, 0.5);
  if (subject.characteristics.bedrooms !== undefined && candidate.bedrooms !== undefined) values.bedrooms = linear(Math.abs(candidate.bedrooms - subject.characteristics.bedrooms), 3);
  if (subject.characteristics.bathrooms !== undefined && candidate.bathrooms !== undefined) values.bathrooms = linear(Math.abs(candidate.bathrooms - subject.characteristics.bathrooms), 2);
  if (subject.characteristics.yearBuilt !== undefined && candidate.yearBuilt !== undefined) values["year-built"] = linear(Math.abs(candidate.yearBuilt - subject.characteristics.yearBuilt), policy.maximumYearBuiltDifference);
  if (subject.characteristics.propertyType && candidate.propertyType) values["property-type"] = normalize(subject.characteristics.propertyType) === normalize(candidate.propertyType) ? 1 : 0;
  const evidenceAt = candidate.listing?.listedAt ?? candidate.rental?.listedAt;
  if (evidenceAt) values.recency = linear(Math.max(0, (evaluatedAt.getTime() - evidenceAt.getTime()) / 86_400_000), maximumAgeDays);
  const dimensions = (Object.keys(policy.weights) as MarketComparableSimilarityDimension[]).sort();
  const supportedWeight = dimensions.reduce((sum, dimension) => sum + (values[dimension] === undefined ? 0 : policy.weights[dimension]), 0);
  const components: MarketComparableSimilarityComponent[] = dimensions.flatMap((dimension) => values[dimension] === undefined ? [] : [{ dimension, score: round((values[dimension] ?? 0) * 100), policyWeight: policy.weights[dimension], effectiveWeight: round(policy.weights[dimension] / supportedWeight * 100) }]);
  const missingDimensions = dimensions.filter((dimension) => values[dimension] === undefined);
  const score = supportedWeight ? round(components.reduce((sum, component) => sum + component.score * component.effectiveWeight / 100, 0)) : 0;
  return Object.freeze({ score: clamp(score), components: Object.freeze(components), missingDimensions: Object.freeze(missingDimensions), rationale: Object.freeze([`Similarity uses ${components.length} supported dimensions; ${missingDimensions.length} dimensions are missing.`]) });
}
function linear(value: number, maximum: number): number { return Math.max(0, Math.min(1, 1 - value / maximum)); }
function normalize(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]/g, ""); }
function round(value: number): number { return Math.round(value * 100) / 100; }
function clamp(value: number): number { return Math.max(0, Math.min(100, value)); }
