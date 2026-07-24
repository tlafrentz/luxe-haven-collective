import type { PortfolioLearningPolicy } from "./model";

export const DEFAULT_PORTFOLIO_LEARNING_POLICY: PortfolioLearningPolicy = Object.freeze({
  version: "portfolio-learning-policy/v1",
  sample: Object.freeze({ emerging: 3, supported: 5, validated: 10, minimumDistinctSubjects: 2, validatedDistinctSubjects: 3, validatedDistinctPeriods: 2 }),
  consistency: Object.freeze({ highSupportRate: 80, moderateSupportRate: 60 }),
  contradiction: Object.freeze({ minorRate: 10, materialRate: 25, dominantRate: 50, invalidationRate: 70 }),
  confidence: Object.freeze({ minimumEligible: 40, supported: 60, validated: 80 }),
  recency: Object.freeze({ currentDays: 90, agingDays: 180, staleDays: 365 }),
  segmentation: Object.freeze({
    approvedDimensions: Object.freeze(["market", "property-type", "operating-model", "seasonality", "portfolio-stage", "capital-posture", "health-band", "execution-speed", "recommendation-type", "decision-type"] as const),
    minimumSegmentSample: 2, maximumSegments: 10,
  }),
  limits: Object.freeze({ decisionAssessments: 500, effectivenessAssessments: 100, candidates: 50, learnings: 25, supportingReferences: 30, contradictingReferences: 20, conditions: 10, changes: 25 }),
  allowLimitedDecisionAssessments: false,
  allowLimitedEffectivenessAssessments: false,
  compatibleDecisionPolicyVersions: Object.freeze(["decision-outcome-policy/v1"]),
  compatibleEffectivenessPolicyVersions: Object.freeze(["recommendation-effectiveness-policy/v1"]),
});

export function validatePortfolioLearningPolicy(policy: PortfolioLearningPolicy): void {
  if (!policy.version.trim()) throw new TypeError("Portfolio Learning policy version is required.");
  if (!(policy.sample.emerging >= 1 && policy.sample.supported >= policy.sample.emerging && policy.sample.validated >= policy.sample.supported)) throw new RangeError("Learning sample thresholds must ascend.");
  if (!(policy.contradiction.minorRate <= policy.contradiction.materialRate && policy.contradiction.materialRate <= policy.contradiction.dominantRate && policy.contradiction.dominantRate <= policy.contradiction.invalidationRate)) throw new RangeError("Contradiction thresholds must ascend.");
  for (const value of Object.values(policy.limits)) if (!Number.isInteger(value) || value < 1) throw new RangeError("Learning collection limits must be positive integers.");
  if (policy.segmentation.maximumSegments > policy.limits.conditions) throw new RangeError("Segment limit cannot exceed condition limit.");
}
