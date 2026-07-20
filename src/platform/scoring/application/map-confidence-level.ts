import { ConfidenceLevel } from "../domain/confidence-level";
import { ConfidenceScore } from "../domain/confidence-score";
import {
  evaluateScoreThreshold,
  type ScoreThreshold,
} from "./score-thresholds";

const CONFIDENCE_THRESHOLDS = [
  {
    minimum: 80,
    value: ConfidenceLevel.VERY_HIGH,
  },
  {
    minimum: 60,
    value: ConfidenceLevel.HIGH,
  },
  {
    minimum: 40,
    value: ConfidenceLevel.MODERATE,
  },
  {
    minimum: 20,
    value: ConfidenceLevel.LOW,
  },
  {
    minimum: 0,
    value: ConfidenceLevel.VERY_LOW,
  },
] as const satisfies readonly ScoreThreshold<ConfidenceLevel>[];

/**
 * Maps a confidence score to the platform's canonical confidence level.
 */
export function mapConfidenceLevel(
  score: ConfidenceScore,
): ConfidenceLevel {
  return evaluateScoreThreshold(
    score.score,
    CONFIDENCE_THRESHOLDS,
  );
}
