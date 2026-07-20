/**
 * Lifecycle state of a canonical platform Claim.
 *
 * Status describes whether the proposition is participating in the reasoning
 * process. It does not describe whether the Claim is true, false, supported,
 * opposed, or confidently evaluated.
 */
export enum ClaimStatus {
  PROPOSED = "proposed",
  ACTIVE = "active",
}
