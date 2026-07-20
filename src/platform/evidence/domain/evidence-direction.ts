/**
 * Describes how an evidence item relates to the proposition being evaluated.
 *
 * Direction is proposition-relative. It does not describe whether a fact is
 * universally good or bad.
 */
export enum EvidenceDirection {
  SUPPORTING = "supporting",
  OPPOSING = "opposing",
  NEUTRAL = "neutral",
  MIXED = "mixed",
}
