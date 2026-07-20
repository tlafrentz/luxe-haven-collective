import { Score } from "../domain/score";

export type ScoreThreshold<TValue extends string> = Readonly<{
  minimum: number;
  value: TValue;
}>;

/**
 * Maps a score to the matching threshold value.
 *
 * Thresholds are inclusive at their minimum and must be ordered from highest
 * minimum to lowest minimum.
 */
export function evaluateScoreThreshold<
  TValue extends string,
>(
  score: Score,
  thresholds: readonly ScoreThreshold<TValue>[],
): TValue {
  if (thresholds.length === 0) {
    throw new RangeError(
      "Score threshold evaluation requires at least one threshold.",
    );
  }

  assertValidThresholds(score, thresholds);

  const match = thresholds.find(
    (threshold) => score.value >= threshold.minimum,
  );

  if (!match) {
    throw new RangeError(
      "Score is below the lowest configured threshold.",
    );
  }

  return match.value;
}

function assertValidThresholds<TValue extends string>(
  score: Score,
  thresholds: readonly ScoreThreshold<TValue>[],
): void {
  let previousMinimum = Number.POSITIVE_INFINITY;

  for (const threshold of thresholds) {
    if (!Number.isFinite(threshold.minimum)) {
      throw new TypeError(
        "Score threshold minimum must be a finite number.",
      );
    }

    if (!score.scale.contains(threshold.minimum)) {
      throw new RangeError(
        "Score threshold minimum must fall within the score scale.",
      );
    }

    if (threshold.minimum >= previousMinimum) {
      throw new RangeError(
        "Score thresholds must be ordered from highest minimum to lowest minimum.",
      );
    }

    previousMinimum = threshold.minimum;
  }
}
