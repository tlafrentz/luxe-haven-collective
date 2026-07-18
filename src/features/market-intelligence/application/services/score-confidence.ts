import { ConfidenceScore } from "../../domain/value-objects/confidence-score";
import { MarketObservation } from "../../domain/entities/market-observation";

export function scoreConfidence(
  observations: readonly MarketObservation[],
): ConfidenceScore {
  if (observations.length === 0) {
    return ConfidenceScore.zero();
  }

  const total = observations.reduce(
    (sum, observation) =>
      sum + observation.confidence.value,
    0,
  );

  return new ConfidenceScore(
    Math.round(total / observations.length),
  );
}
