import type {
  WeightedComparable,
} from "../domain/entities/weighted-comparable";

import {
  ValuationConfidence,
} from "../domain/value-objects/valuation-confidence";

export interface CalculateValuationConfidenceInput {
  readonly comparables:
    readonly WeightedComparable[];
  readonly estimatedValue: number;
}

export function calculateValuationConfidence(
  input:
    CalculateValuationConfidenceInput,
): ValuationConfidence {
  if (
    !Number.isFinite(
      input.estimatedValue,
    ) ||
    input.estimatedValue < 0
  ) {
    throw new Error(
      "Estimated value must be a finite non-negative number.",
    );
  }

  const comparableCount =
    input.comparables.length;

  const averageSimilarity =
    comparableCount === 0
      ? 0
      : input.comparables.reduce(
          (
            total,
            comparable,
          ) =>
            total +
            comparable
              .similarityScore
              .value,
          0,
        ) /
        comparableCount;

  const adjustedValues =
    input.comparables
      .map(
        (comparable) =>
          comparable.adjustedValue,
      )
      .filter(
        (
          value,
        ): value is number =>
          value !==
            undefined &&
          Number.isFinite(value),
      );

  const dispersionRatio =
    calculateDispersionRatio(
      adjustedValues,
      input.estimatedValue,
    );

  const countScore =
    Math.min(
      comparableCount / 5,
      1,
    ) * 30;

  const similarityScore =
    (
      averageSimilarity /
      100
    ) * 45;

  const dispersionScore =
    Math.max(
      0,
      1 -
        Math.min(
          dispersionRatio /
            0.35,
          1,
        ),
    ) * 25;

  const score =
    countScore +
    similarityScore +
    dispersionScore;

  const reasons: string[] =
    [];

  if (
    comparableCount < 3
  ) {
    reasons.push(
      "Fewer than three supporting comparables.",
    );
  }

  if (
    averageSimilarity < 70
  ) {
    reasons.push(
      "Average comparable similarity is below 70.",
    );
  }

  if (
    dispersionRatio > 0.2
  ) {
    reasons.push(
      "Comparable values show meaningful dispersion.",
    );
  }

  return new ValuationConfidence({
    score,
    comparableCount,
    averageSimilarity,
    dispersionRatio,
    reasons,
  });
}

function calculateDispersionRatio(
  values:
    readonly number[],
  estimatedValue: number,
): number {
  if (
    values.length === 0 ||
    estimatedValue <= 0
  ) {
    return 1;
  }

  const mean =
    values.reduce(
      (sum, value) =>
        sum + value,
      0,
    ) /
    values.length;

  const variance =
    values.reduce(
      (sum, value) =>
        sum +
        (
          value - mean
        ) ** 2,
      0,
    ) /
    values.length;

  const standardDeviation =
    Math.sqrt(
      variance,
    );

  return (
    standardDeviation /
    estimatedValue
  );
}
