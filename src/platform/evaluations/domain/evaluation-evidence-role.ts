/**
 * Describes how Evidence influenced an Evaluation.
 *
 * These roles are evaluation-process concepts. They do not replace Evidence
 * direction or strength, Claim evidence roles, confidence, recommendations,
 * or decisions.
 */
export enum EvaluationEvidenceRole {
  CONSIDERED = "considered",
  SUPPORTING = "supporting",
  CONTRADICTING = "contradicting",
  DISCARDED = "discarded",
}
