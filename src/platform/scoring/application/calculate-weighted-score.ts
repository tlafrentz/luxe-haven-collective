import { Score } from "../domain/score";
import { ScoreScale } from "../domain/score-scale";
import { WeightedScore } from "../domain/weighted-score";

const WEIGHT_TOLERANCE = 1e-10;

/**
 * Calculates a composite score from weighted scores.
 *
 * All scores must use the same scale and weights must total 100%.
 */
export function calculateWeightedScore(
  weightedScores: readonly WeightedScore[],
): Score {
  if (weightedScores.length === 0) {
    throw new RangeError(
      "Weighted score calculation requires at least one value.",
    );
  }

  const expectedScale = weightedScores[0].score.scale;

  for (const weightedScore of weightedScores.slice(1)) {
    if (!weightedScore.score.scale.equals(expectedScale)) {
      throw new RangeError(
        "Weighted scores must use the same score scale.",
      );
    }
  }

  const totalWeight = weightedScores.reduce(
    (total, weightedScore) =>
      total + weightedScore.weight.ratio,
    0,
  );

  if (Math.abs(totalWeight - 1) > WEIGHT_TOLERANCE) {
    throw new RangeError(
      "Weighted score weights must total 100%.",
    );
  }

  const scoreValue = weightedScores.reduce(
    (total, weightedScore) =>
      total + weightedScore.contribution,
    0,
  );

  return Score.create(
    scoreValue,
    ScoreScale.create(
      expectedScale.minimum,
      expectedScale.maximum,
    ),
  );
}
