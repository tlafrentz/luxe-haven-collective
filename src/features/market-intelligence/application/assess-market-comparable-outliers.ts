import type { MarketComparableCandidate } from "../domain/comparable-acquisition";
import type { MarketComparableOutlierAssessment, MarketComparableOutlierPolicy } from "../domain/comparable-qualification";

export function assessMarketComparableOutliers(candidates: readonly MarketComparableCandidate[], policy: MarketComparableOutlierPolicy): ReadonlyMap<string, MarketComparableOutlierAssessment> {
  const values = candidates.flatMap((candidate) => { const value = comparableUnitValue(candidate); return value === undefined ? [] : [{ id: candidate.id, value }]; });
  if (values.length < policy.minimumSampleSize) return new Map(candidates.map((candidate) => [candidate.id, assessment("insufficient-sample", [], "Too few eligible comparables for statistical outlier assessment.")]));
  const median = calculateMedian(values.map((item) => item.value));
  return new Map(candidates.map((candidate) => {
    const value = comparableUnitValue(candidate);
    if (value === undefined || median <= 0) return [candidate.id, assessment("insufficient-sample", [], "Comparable lacks a supported unit value.")];
    const deviation = Math.abs(value - median) / median;
    if (deviation > policy.hardDeviationRatio) return [candidate.id, assessment("hard-outlier", ["unit-value"], `Unit value deviates ${percent(deviation)} from the median.`)];
    if (deviation > policy.softDeviationRatio) return [candidate.id, assessment("soft-outlier", ["unit-value"], `Unit value deviates ${percent(deviation)} from the median.`)];
    return [candidate.id, assessment("not-outlier", [], "Unit value is within the policy deviation range.")];
  }));
}
function comparableUnitValue(candidate: MarketComparableCandidate): number | undefined { const price = candidate.listing?.price ?? candidate.rental?.monthlyRent; return price === undefined ? undefined : candidate.squareFeet ? price / candidate.squareFeet : price; }
function assessment(status: MarketComparableOutlierAssessment["status"], dimensions: readonly string[], rationale: string): MarketComparableOutlierAssessment { return Object.freeze({ status, dimensions: Object.freeze([...dimensions]), rationale: Object.freeze([rationale]) }); }
function calculateMedian(values: readonly number[]): number { const sorted = [...values].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2; }
function percent(value: number): string { return `${Math.round(value * 100)}%`; }
