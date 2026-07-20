import { ConfidenceAssessment } from "../domain/confidence-assessment";
import { ConfidenceScore } from "../domain/confidence-score";
import { Weight } from "../domain/weight";

export type ConfidenceFactor = Readonly<{
  score: ConfidenceScore;
  weight: Weight;
  rationale?: string;
}>;

const WEIGHT_TOLERANCE = 1e-10;

/**
 * Calculates a complete confidence assessment from weighted confidence
 * factors.
 *
 * Factors must contain at least one entry and weights must total 100%.
 */
export function calculateConfidence(
  factors: readonly ConfidenceFactor[],
): ConfidenceAssessment {
  if (factors.length === 0) {
    throw new RangeError(
      "Confidence calculation requires at least one factor.",
    );
  }

  const totalWeight = factors.reduce(
    (total, factor) => total + factor.weight.ratio,
    0,
  );

  if (Math.abs(totalWeight - 1) > WEIGHT_TOLERANCE) {
    throw new RangeError(
      "Confidence factor weights must total 100%.",
    );
  }

  const scoreValue = factors.reduce(
    (total, factor) =>
      total + factor.score.value * factor.weight.ratio,
    0,
  );

  const rationale = factors.flatMap((factor) => {
    const entry = factor.rationale?.trim();

    return entry ? [entry] : [];
  });

  return ConfidenceAssessment.create({
    score: ConfidenceScore.create(scoreValue),
    rationale,
  });
}
