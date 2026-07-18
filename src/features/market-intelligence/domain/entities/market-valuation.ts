import type {
  WeightedComparable,
} from "./weighted-comparable";

import {
  MarketValueRange,
} from "../value-objects/market-value-range";

import {
  ValuationConfidence,
} from "../value-objects/valuation-confidence";

export interface MarketValuationInput {
  readonly valueRange:
    MarketValueRange;
  readonly averagePricePerSquareFoot?:
    number;
  readonly medianPricePerSquareFoot?:
    number;
  readonly weightedPricePerSquareFoot?:
    number;
  readonly confidence:
    ValuationConfidence;
  readonly supportingComparables:
    readonly WeightedComparable[];
  readonly excludedComparableIds?:
    readonly string[];
  readonly calculatedAt?: Date;
}

export class MarketValuation {
  readonly valueRange:
    MarketValueRange;

  readonly averagePricePerSquareFoot?:
    number;

  readonly medianPricePerSquareFoot?:
    number;

  readonly weightedPricePerSquareFoot?:
    number;

  readonly confidence:
    ValuationConfidence;

  readonly supportingComparables:
    readonly WeightedComparable[];

  readonly excludedComparableIds:
    readonly string[];

  readonly calculatedAt: Date;

  constructor(
    input:
      MarketValuationInput,
  ) {
    validateOptionalMetric(
      input.averagePricePerSquareFoot,
      "Average price per square foot",
    );

    validateOptionalMetric(
      input.medianPricePerSquareFoot,
      "Median price per square foot",
    );

    validateOptionalMetric(
      input.weightedPricePerSquareFoot,
      "Weighted price per square foot",
    );

    if (
      input.supportingComparables.length === 0
    ) {
      throw new Error(
        "Market valuation requires at least one supporting comparable.",
      );
    }

    this.valueRange =
      input.valueRange;

    this.averagePricePerSquareFoot =
      roundOptional(
        input.averagePricePerSquareFoot,
      );

    this.medianPricePerSquareFoot =
      roundOptional(
        input.medianPricePerSquareFoot,
      );

    this.weightedPricePerSquareFoot =
      roundOptional(
        input.weightedPricePerSquareFoot,
      );

    this.confidence =
      input.confidence;

    this.supportingComparables =
      Object.freeze([
        ...input.supportingComparables,
      ]);

    this.excludedComparableIds =
      Object.freeze([
        ...(
          input.excludedComparableIds ??
          []
        ),
      ]);

    this.calculatedAt =
      input.calculatedAt ??
      new Date();
  }
}

function validateOptionalMetric(
  value: number | undefined,
  label: string,
): void {
  if (
    value !== undefined &&
    (
      !Number.isFinite(value) ||
      value < 0
    )
  ) {
    throw new Error(
      `${label} must be a finite non-negative number.`,
    );
  }
}

function roundOptional(
  value: number | undefined,
): number | undefined {
  if (
    value === undefined
  ) {
    return undefined;
  }

  return (
    Math.round(
      value * 100,
    ) / 100
  );
}
