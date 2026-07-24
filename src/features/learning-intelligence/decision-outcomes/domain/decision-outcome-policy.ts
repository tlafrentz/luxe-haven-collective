import type { DecisionOutcomePolicy } from "./assessment-model";
import { DecisionOutcomeError } from "./assessment-errors";

export const DEFAULT_DECISION_OUTCOME_POLICY: DecisionOutcomePolicy = Object.freeze({
  version: "decision-outcome-policy/v1",
  successfulPrimaryRatio: 1,
  partialPrimaryRatio: 0.5,
  guardrailPrecedence: "partial",
  harmOverride: true,
  minimumConfidenceForConclusion: 40,
  minimumConfidenceForLearning: 65,
  minimumEvidenceCoverage: 60,
  attributionRequiredForLearning: true,
  acceptedAttributionForLearning: Object.freeze(["established", "supported", "plausible"] as const),
  confidenceWeights: Object.freeze({ measurement: 0.3, evidence: 0.2, attribution: 0.2, coverage: 0.2, freshness: 0.1 }),
  materialHarm: Object.freeze({ unexpectedNegativeCount: 1, categories: Object.freeze(["risk-condition", "unexpected-effect"] as const) }),
});

export function validateDecisionOutcomePolicy(policy: DecisionOutcomePolicy): void {
  if (!policy.version.trim()) throw new DecisionOutcomeError("POLICY_INVALID", "Policy version is required.");
  for (const [field, value] of Object.entries({
    successfulPrimaryRatio: policy.successfulPrimaryRatio,
    partialPrimaryRatio: policy.partialPrimaryRatio,
    minimumEvidenceCoverage: policy.minimumEvidenceCoverage / 100,
  })) if (!Number.isFinite(value) || value < 0 || value > 1) throw new DecisionOutcomeError("POLICY_INVALID", `${field} must be between 0 and 1.`);
  if (policy.partialPrimaryRatio > policy.successfulPrimaryRatio) throw new DecisionOutcomeError("POLICY_INVALID", "Partial threshold cannot exceed successful threshold.");
  const total = Object.values(policy.confidenceWeights).reduce((sum, value) => sum + value, 0);
  if (Math.abs(total - 1) > 1e-10) throw new DecisionOutcomeError("POLICY_INVALID", "Confidence weights must total 1.");
  if (!Number.isInteger(policy.materialHarm.unexpectedNegativeCount) || policy.materialHarm.unexpectedNegativeCount < 1) throw new DecisionOutcomeError("POLICY_INVALID", "Material harm count must be positive.");
}
