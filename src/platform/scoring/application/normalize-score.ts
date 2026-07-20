import { Score } from "../domain/score";
import { ScoreScale } from "../domain/score-scale";

/**
 * Converts a score to an equivalent value on another scale.
 */
export function normalizeScore(
  score: Score,
  targetScale: ScoreScale,
): Score {
  return score.normalizeTo(targetScale);
}
