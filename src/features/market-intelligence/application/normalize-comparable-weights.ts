import {
  ComparableWeight,
} from "../domain/value-objects/comparable-weight";

import type {
  SimilarityScore,
} from "../domain/value-objects/similarity-score";

export interface NormalizeComparableWeightsInput {
  readonly scores:
    readonly SimilarityScore[];
  readonly minimumSimilarity?: number;
}

export function normalizeComparableWeights(
  input:
    NormalizeComparableWeightsInput,
): readonly ComparableWeight[] {
  const minimumSimilarity =
    input.minimumSimilarity ??
    0;

  if (
    !Number.isFinite(
      minimumSimilarity,
    ) ||
    minimumSimilarity < 0 ||
    minimumSimilarity > 100
  ) {
    throw new Error(
      "Minimum similarity must be between 0 and 100.",
    );
  }

  if (
    input.scores.length === 0
  ) {
    return [];
  }

  const eligibleScores =
    input.scores.map(
      (score) =>
        score.value >=
        minimumSimilarity
          ? score.value
          : 0,
    );

  const total =
    eligibleScores.reduce(
      (sum, score) =>
        sum + score,
      0,
    );

  if (
    total <= 0
  ) {
    const equalWeight =
      1 /
      input.scores.length;

    return input.scores.map(
      () =>
        new ComparableWeight(
          equalWeight,
        ),
    );
  }

  const rawWeights =
    eligibleScores.map(
      (score) =>
        score / total,
    );

  return correctRounding(
    rawWeights,
  ).map(
    (weight) =>
      new ComparableWeight(
        weight,
      ),
  );
}

function correctRounding(
  weights:
    readonly number[],
): readonly number[] {
  const rounded =
    weights.map(
      (weight) =>
        Math.round(
          weight * 10000,
        ) / 10000,
    );

  const total =
    rounded.reduce(
      (sum, weight) =>
        sum + weight,
      0,
    );

  const difference =
    Math.round(
      (
        1 - total
      ) * 10000,
    ) / 10000;

  if (
    difference === 0 ||
    rounded.length === 0
  ) {
    return rounded;
  }

  const highestIndex =
    weights.reduce(
      (
        bestIndex,
        weight,
        index,
      ) =>
        weight >
        weights[bestIndex]
          ? index
          : bestIndex,
      0,
    );

  return rounded.map(
    (weight, index) =>
      index ===
      highestIndex
        ? weight +
          difference
        : weight,
  );
}
