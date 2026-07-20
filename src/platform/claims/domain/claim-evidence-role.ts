/**
 * Describes how a referenced Evidence item participates in evaluating a Claim.
 *
 * This role is traceability metadata only. It does not replace the canonical
 * Evidence direction, strength, or future Claim Evaluation result.
 */
export enum ClaimEvidenceRole {
  PRIMARY = "primary",
  SUPPORTING = "supporting",
  OPPOSING = "opposing",
  CONTEXTUAL = "contextual",
}
