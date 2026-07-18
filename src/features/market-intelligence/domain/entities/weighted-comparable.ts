import type {
  ComparableProperty,
} from "./comparable-property";

import {
  ComparableAdjustment,
} from "../value-objects/comparable-adjustment";

import {
  ComparableWeight,
} from "../value-objects/comparable-weight";

import {
  SimilarityScore,
} from "../value-objects/similarity-score";

export interface WeightedComparableInput {
  readonly comparable:
    ComparableProperty;

  readonly similarityScore:
    SimilarityScore;

  readonly weight:
    ComparableWeight;

  readonly adjustments?:
    readonly ComparableAdjustment[];

  readonly baseValue?: number;
}

export class WeightedComparable {
  readonly comparable:
    ComparableProperty;

  readonly similarityScore:
    SimilarityScore;

  readonly weight:
    ComparableWeight;

  readonly adjustments:
    readonly ComparableAdjustment[];

  readonly baseValue?: number;

  constructor(
    input: WeightedComparableInput,
  ) {
    if (
      input.baseValue !== undefined &&
      (
        !Number.isFinite(
          input.baseValue,
        ) ||
        input.baseValue < 0
      )
    ) {
      throw new Error(
        "Weighted comparable base value must be a finite non-negative number.",
      );
    }

    this.comparable =
      input.comparable;

    this.similarityScore =
      input.similarityScore;

    this.weight =
      input.weight;

    this.adjustments =
      Object.freeze([
        ...(input.adjustments ?? []),
      ]);

    this.baseValue =
      input.baseValue;
  }

  get totalAdjustment():
    number {
    return this.adjustments.reduce(
      (
        total,
        adjustment,
      ) =>
        total +
        adjustment.amount,
      0,
    );
  }

  get adjustedValue():
    number | undefined {
    if (
      this.baseValue ===
      undefined
    ) {
      return undefined;
    }

    return (
      this.baseValue +
      this.totalAdjustment
    );
  }

  get weightedValue():
    number | undefined {
    const adjustedValue =
      this.adjustedValue;

    if (
      adjustedValue ===
      undefined
    ) {
      return undefined;
    }

    return (
      adjustedValue *
      this.weight.value
    );
  }
}
