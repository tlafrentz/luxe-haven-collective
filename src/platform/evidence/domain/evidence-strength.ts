/**
 * Describes how materially an evidence item affects the proposition being
 * evaluated.
 *
 * Strength is distinct from confidence. Confidence belongs to Platform
 * Scoring and measures certainty in an assessment.
 */
export enum EvidenceStrength {
  WEAK = "weak",
  MODERATE = "moderate",
  STRONG = "strong",
  DECISIVE = "decisive",
}
