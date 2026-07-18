import type {
  ComparableAnalysis,
} from "../domain/entities/comparable-analysis";

import {
  MarketValuation,
} from "../domain/entities/market-valuation";

import {
  MarketValueRange,
} from "../domain/value-objects/market-value-range";

import {
  calculateValuationConfidence,
} from "./calculate-valuation-confidence";

import {
  detectComparableOutliers,
} from "./detect-comparable-outliers";

export interface CalculateMarketValuationInput {
  readonly analysis:
    ComparableAnalysis;
  readonly lowPercentile?: number;
  readonly highPercentile?: number;
  readonly maximumOutlierDeviationRatio?: number;
}

export function calculateMarketValuation(
  input:
    CalculateMarketValuationInput,
): MarketValuation {
  const lowPercentile =
    input.lowPercentile ??
    0.25;

  const highPercentile =
    input.highPercentile ??
    0.75;

  validatePercentile(
    lowPercentile,
    "Low percentile",
  );

  validatePercentile(
    highPercentile,
    "High percentile",
  );

  if (
    lowPercentile >
      highPercentile
  ) {
    throw new Error(
      "Low percentile cannot exceed high percentile.",
    );
  }

  const outliers =
    detectComparableOutliers({
      comparables:
        input.analysis
          .comparables,
      maximumDeviationRatio:
        input.maximumOutlierDeviationRatio,
    });

  if (
    outliers.included.length === 0
  ) {
    throw new Error(
      "Market valuation requires at least one usable comparable.",
    );
  }

  const adjustedValues =
    outliers.included
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
          Number.isFinite(value) &&
          value >= 0,
      );

  if (
    adjustedValues.length === 0
  ) {
    throw new Error(
      "Market valuation requires comparable values.",
    );
  }

  const weightedEstimatedValue =
    calculateWeightedEstimate(
      outliers.included,
    );

  const low =
    percentile(
      adjustedValues,
      lowPercentile,
    );

  const high =
    percentile(
      adjustedValues,
      highPercentile,
    );

  const pricePerSquareFootValues =
    calculatePricePerSquareFootValues(
      outliers.included,
    );

  const subjectSquareFeet =
    input.analysis
      .subject
      .squareFeet;

  const weightedPricePerSquareFoot =
    (
      subjectSquareFeet !==
        undefined &&
      subjectSquareFeet > 0
    )
      ? weightedEstimatedValue /
        subjectSquareFeet
      : undefined;

  const confidence =
    calculateValuationConfidence({
      comparables:
        outliers.included,
      estimatedValue:
        weightedEstimatedValue,
    });

  return new MarketValuation({
    valueRange:
      new MarketValueRange({
        low:
          Math.min(
            low,
            weightedEstimatedValue,
          ),
        estimated:
          weightedEstimatedValue,
        high:
          Math.max(
            high,
            weightedEstimatedValue,
          ),
      }),
    averagePricePerSquareFoot:
      average(
        pricePerSquareFootValues,
      ),
    medianPricePerSquareFoot:
      median(
        pricePerSquareFootValues,
      ),
    weightedPricePerSquareFoot,
    confidence,
    supportingComparables:
      outliers.included,
    excludedComparableIds:
      outliers.excluded.map(
        (comparable) =>
          comparable
            .comparable
            .id,
      ),
  });
}

function calculateWeightedEstimate(
  comparables:
    readonly import(
      "../domain/entities/weighted-comparable"
    ).WeightedComparable[],
): number {
  const usable =
    comparables.filter(
      (comparable) =>
        comparable.adjustedValue !==
          undefined &&
        comparable.weight.value >
          0,
    );

  if (
    usable.length === 0
  ) {
    throw new Error(
      "Market valuation requires weighted comparable values.",
    );
  }

  const totalWeight =
    usable.reduce(
      (sum, comparable) =>
        sum +
        comparable.weight.value,
      0,
    );

  if (
    totalWeight <= 0
  ) {
    throw new Error(
      "Market valuation requires positive comparable weight.",
    );
  }

  return (
    usable.reduce(
      (
        sum,
        comparable,
      ) =>
        sum +
        (
          comparable
            .adjustedValue ??
          0
        ) *
        comparable
          .weight
          .value,
      0,
    ) /
    totalWeight
  );
}

function calculatePricePerSquareFootValues(
  comparables:
    readonly import(
      "../domain/entities/weighted-comparable"
    ).WeightedComparable[],
): readonly number[] {
  return comparables
    .map(
      (comparable) => {
        const value =
          comparable
            .adjustedValue;

        const squareFeet =
          comparable
            .comparable
            .squareFeet;

        if (
          value === undefined ||
          squareFeet ===
            undefined ||
          squareFeet <= 0
        ) {
          return undefined;
        }

        return (
          value /
          squareFeet
        );
      },
    )
    .filter(
      (
        value,
      ): value is number =>
        value !==
        undefined &&
        Number.isFinite(value),
    );
}

function average(
  values:
    readonly number[],
): number | undefined {
  if (
    values.length === 0
  ) {
    return undefined;
  }

  return (
    values.reduce(
      (sum, value) =>
        sum + value,
      0,
    ) /
    values.length
  );
}

function median(
  values:
    readonly number[],
): number | undefined {
  if (
    values.length === 0
  ) {
    return undefined;
  }

  return percentile(
    values,
    0.5,
  );
}

function percentile(
  values:
    readonly number[],
  target: number,
): number {
  const sorted =
    [...values].sort(
      (left, right) =>
        left - right,
    );

  if (
    sorted.length === 1
  ) {
    return sorted[0];
  }

  const index =
    (
      sorted.length - 1
    ) *
    target;

  const lower =
    Math.floor(index);

  const upper =
    Math.ceil(index);

  if (
    lower === upper
  ) {
    return sorted[lower];
  }

  const fraction =
    index - lower;

  return (
    sorted[lower] +
    (
      sorted[upper] -
      sorted[lower]
    ) *
    fraction
  );
}

function validatePercentile(
  value: number,
  label: string,
): void {
  if (
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1
  ) {
    throw new Error(
      `${label} must be between 0 and 1.`,
    );
  }
}
