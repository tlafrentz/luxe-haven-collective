import type { MarketComparableQualificationResult } from "../domain/comparable-qualification";
import type { MarketAnalysisConfidence, MarketEstimateCalculation, MarketEstimateStatus, MarketEstimationPolicy } from "../domain/canonical-market-analysis-report";

export interface MarketEstimateCore { readonly status: MarketEstimateStatus; readonly estimate?: number; readonly range?: Readonly<{ lower: number; upper: number }>; readonly unitEstimate?: number; readonly calculation?: MarketEstimateCalculation; readonly confidence: MarketAnalysisConfidence }

export function buildMarketEstimateCore(qualification: MarketComparableQualificationResult, policy: MarketEstimationPolicy, subjectSquareFeet: number | undefined): MarketEstimateCore {
  const valued = qualification.included.flatMap((item) => { const value = item.candidate.listing?.price ?? item.candidate.rental?.monthlyRent; return value === undefined ? [] : [{ candidateId: item.candidate.id, value, weight: item.normalizedWeight, similarity: item.similarity.score }]; });
  if (valued.length < policy.minimumEstimateComparables) return Object.freeze({ status: "insufficient", confidence: confidence(qualification, [], undefined) });
  const totalWeight = valued.reduce((sum, item) => sum + item.weight, 0);
  const estimate = valued.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight;
  const values = valued.map((item) => item.value);
  const lower = Math.min(percentile(values, policy.lowPercentile), estimate);
  const upper = Math.max(percentile(values, policy.highPercentile), estimate);
  const status = qualification.summary.sufficiency === "sufficient" ? "estimated" : "limited";
  const calculation: MarketEstimateCalculation = { method: "weighted-comparable-mean", candidateIds: valued.map((item) => item.candidateId), normalizedWeights: valued.map((item) => ({ candidateId: item.candidateId, weight: item.weight })), values: valued.map((item) => ({ candidateId: item.candidateId, value: item.value })), lowPercentile: policy.lowPercentile, highPercentile: policy.highPercentile };
  return Object.freeze({ status, estimate: round(estimate), range: Object.freeze({ lower: round(lower), upper: round(upper) }), ...(subjectSquareFeet && subjectSquareFeet > 0 ? { unitEstimate: round(estimate / subjectSquareFeet) } : {}), calculation: deepFreeze(calculation), confidence: confidence(qualification, values, estimate) });
}

function confidence(qualification: MarketComparableQualificationResult, values: readonly number[], estimate: number | undefined): MarketAnalysisConfidence {
  const count = qualification.included.length;
  const averageSimilarity = count ? qualification.included.reduce((sum, item) => sum + item.similarity.score, 0) / count : 0;
  const dispersion = estimate && estimate > 0 && values.length ? standardDeviation(values) / estimate : 1;
  const coverage = Math.min(count / 5, 1) * 30;
  const similarity = averageSimilarity / 100 * 45;
  const dispersionScore = Math.max(0, 1 - Math.min(dispersion / 0.35, 1)) * 25;
  const score = round(coverage + similarity + dispersionScore);
  const reasons = [...(count < 3 ? ["Fewer than three supporting comparables."] : []), ...(averageSimilarity < 70 ? ["Average comparable similarity is below 70."] : []), ...(dispersion > 0.2 ? ["Comparable values show meaningful dispersion."] : [])];
  return deepFreeze({ score, level: level(score), reasons, dimensions: { coverage: round(coverage), similarity: round(similarity), dispersion: round(dispersionScore) } });
}
function percentile(values: readonly number[], value: number): number { const sorted = [...values].sort((a, b) => a - b); if (sorted.length === 1) return sorted[0]; const index = (sorted.length - 1) * value; const lower = Math.floor(index); const fraction = index - lower; return sorted[lower] + (sorted[Math.min(lower + 1, sorted.length - 1)] - sorted[lower]) * fraction; }
function standardDeviation(values: readonly number[]): number { const mean = values.reduce((sum, value) => sum + value, 0) / values.length; return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length); }
function level(score: number): MarketAnalysisConfidence["level"] { return score >= 80 ? "high" : score >= 60 ? "medium" : score > 0 ? "low" : "none"; }
function round(value: number): number { return Math.round(value * 100) / 100; }
function deepFreeze<T>(value: T): T { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child); } return value; }
