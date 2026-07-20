/**
 * Canonical judgment reached when evaluating a Claim.
 *
 * Disposition describes the relationship between the available Evidence and
 * the Claim. It is not a recommendation or final business decision.
 */
export enum EvaluationDisposition {
  SUPPORTED = "supported",
  OPPOSED = "opposed",
  MIXED = "mixed",
  INSUFFICIENT = "insufficient",
}
