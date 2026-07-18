import type {
  WeightedComparable,
} from "../domain/entities/weighted-comparable";

export interface DetectComparableOutliersInput {
  readonly comparables:
    readonly WeightedComparable[];
  readonly maximumDeviationRatio?: number;
}

export interface ComparableOutlierResult {
  readonly included:
    readonly WeightedComparable[];
  readonly excluded:
    readonly WeightedComparable[];
}

export function detectComparableOutliers(
  input:
    DetectComparableOutliersInput,
): ComparableOutlierResult {
  const maximumDeviationRatio =
    input.maximumDeviationRatio ??
    0.35;

  if (
    !Number.isFinite(
      maximumDeviationRatio,
    ) ||
    maximumDeviationRatio < 0
  ) {
    throw new Error(
      "Maximum deviation ratio must be a finite non-negative number.",
    );
  }

  const comparableValues =
    input.comparables
      .map(
        (comparable) => ({
          comparable,
          value:
            comparable.adjustedValue,
        }),
      )
      .filter(
        (
          item,
        ): item is {
          comparable:
            WeightedComparable;
          value: number;
        } =>
          item.value !==
            undefined &&
          Number.isFinite(
            item.value,
          ) &&
          item.value >= 0,
      );

  if (
    comparableValues.length < 3
  ) {
    return {
      included:
        input.comparables,
      excluded: [],
    };
  }

  const median =
    calculateMedian(
      comparableValues.map(
        (item) =>
          item.value,
      ),
    );

  if (
    median <= 0
  ) {
    return {
      included:
        input.comparables,
      excluded: [],
    };
  }

  const excludedSet =
    new Set<
      WeightedComparable
    >();

  for (
    const item of
    comparableValues
  ) {
    const deviationRatio =
      Math.abs(
        item.value -
        median,
      ) /
      median;

    if (
      deviationRatio >
        maximumDeviationRatio
    ) {
      excludedSet.add(
        item.comparable,
      );
    }
  }

  return {
    included:
      input.comparables.filter(
        (comparable) =>
          !excludedSet.has(
            comparable,
          ),
      ),
    excluded:
      input.comparables.filter(
        (comparable) =>
          excludedSet.has(
            comparable,
          ),
      ),
  };
}

function calculateMedian(
  values:
    readonly number[],
): number {
  const sorted =
    [...values].sort(
      (left, right) =>
        left - right,
    );

  const midpoint =
    Math.floor(
      sorted.length / 2,
    );

  if (
    sorted.length % 2 === 0
  ) {
    return (
      (
        sorted[
          midpoint - 1
        ] +
        sorted[midpoint]
      ) /
      2
    );
  }

  return sorted[midpoint];
}
