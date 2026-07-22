import type { MarketComparableCandidate } from "../domain/comparable-acquisition";
import type { MarketComparableOutlierAssessment, MarketComparableSimilarityAssessment, MarketComparableWeightAssessment, MarketComparableWeightingPolicy } from "../domain/comparable-qualification";

export function calculateMarketComparableWeight(candidate: MarketComparableCandidate, similarity: MarketComparableSimilarityAssessment, outlier: MarketComparableOutlierAssessment, policy: MarketComparableWeightingPolicy): MarketComparableWeightAssessment {
  const similarityFactor = Math.max(0.01, similarity.score / 100);
  const outlierFactor = outlier.status === "soft-outlier" ? policy.softOutlierMultiplier : 1;
  const completenessFactor = similarity.missingDimensions.length ? policy.incompleteEvidenceMultiplier : 1;
  const rawWeight = round(similarityFactor * outlierFactor * completenessFactor);
  return Object.freeze({ rawWeight, components: Object.freeze([{ key: "similarity", value: similarityFactor }, { key: "outlier", value: outlierFactor }, { key: "evidence-completeness", value: completenessFactor }]), rationale: Object.freeze([`Candidate ${candidate.id} weight reflects Luxe Haven similarity, outlier, and evidence-completeness policy.`]) });
}

export function normalizeMarketComparableWeights<T extends Readonly<{ candidate: MarketComparableCandidate; weight: MarketComparableWeightAssessment }>>(items: readonly T[]): readonly (T & Readonly<{ normalizedWeight: number }>)[] {
  if (!items.length) return [];
  const total = items.reduce((sum, item) => sum + item.weight.rawWeight, 0);
  const raw = total > 0 ? items.map((item) => item.weight.rawWeight / total) : items.map(() => 1 / items.length);
  const rounded = raw.map((value) => Math.round(value * 1_000_000) / 1_000_000);
  const difference = Math.round((1 - rounded.reduce((sum, value) => sum + value, 0)) * 1_000_000) / 1_000_000;
  const correctionIndex = raw.reduce((best, value, index) => value > raw[best] || (value === raw[best] && items[index].candidate.id < items[best].candidate.id) ? index : best, 0);
  return items.map((item, index) => ({ ...item, normalizedWeight: rounded[index] + (index === correctionIndex ? difference : 0) }));
}
function round(value: number): number { return Math.round(value * 1_000_000) / 1_000_000; }
