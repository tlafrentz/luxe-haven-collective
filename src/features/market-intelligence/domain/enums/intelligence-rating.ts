export enum IntelligenceRating {
  Exceptional = "exceptional",
  Strong = "strong",
  Moderate = "moderate",
  Weak = "weak",
  Insufficient = "insufficient",
}

export function isIntelligenceRating(
  value: unknown,
): value is IntelligenceRating {
  return Object.values(IntelligenceRating).includes(
    value as IntelligenceRating,
  );
}
