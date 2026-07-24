import type { RecommendationEffectivenessPolicy } from "./model";

export const DEFAULT_RECOMMENDATION_EFFECTIVENESS_POLICY: RecommendationEffectivenessPolicy = Object.freeze({
  version: "recommendation-effectiveness-policy/v1",
  minimumSampleSize: 5,
  highlyEffectiveSuccessRate: 80,
  effectiveSuccessRate: 65,
  mixedSuccessRate: 40,
  harmfulRateThreshold: 20,
  severeHarmOverrides: true,
  highRepeatabilityRate: 80,
  moderateRepeatabilityRate: 60,
  minimumConfidenceForLearning: 65,
  maximumInconclusiveRateForLearning: 25,
  trendStableTolerancePoints: 5,
  confidenceWeights: Object.freeze({ sample: 0.25, evidence: 0.2, outcome: 0.2, attribution: 0.15, consistency: 0.2 }),
});

export function validateRecommendationEffectivenessPolicy(policy: RecommendationEffectivenessPolicy): void {
  if (!policy.version.trim()) throw new TypeError("Recommendation effectiveness policy version is required.");
  if (!Number.isInteger(policy.minimumSampleSize) || policy.minimumSampleSize < 2) throw new RangeError("Minimum sample size must be an integer of at least two.");
  for (const [name, value] of Object.entries({
    highlyEffectiveSuccessRate: policy.highlyEffectiveSuccessRate, effectiveSuccessRate: policy.effectiveSuccessRate,
    mixedSuccessRate: policy.mixedSuccessRate, harmfulRateThreshold: policy.harmfulRateThreshold,
    highRepeatabilityRate: policy.highRepeatabilityRate, moderateRepeatabilityRate: policy.moderateRepeatabilityRate,
    minimumConfidenceForLearning: policy.minimumConfidenceForLearning,
    maximumInconclusiveRateForLearning: policy.maximumInconclusiveRateForLearning,
  })) if (!Number.isFinite(value) || value < 0 || value > 100) throw new RangeError(`${name} must be between 0 and 100.`);
  if (!(policy.highlyEffectiveSuccessRate > policy.effectiveSuccessRate && policy.effectiveSuccessRate > policy.mixedSuccessRate)) throw new RangeError("Effectiveness thresholds must descend.");
  const weight = Object.values(policy.confidenceWeights).reduce((sum, value) => sum + value, 0);
  if (Math.abs(weight - 1) > 1e-10) throw new RangeError("Recommendation confidence weights must total one.");
}
