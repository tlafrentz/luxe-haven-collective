import { ComparableSubject } from "./comparable-subject";
import { WeightedComparable } from "./weighted-comparable";

export interface ComparableAnalysisInput {
  readonly subject: ComparableSubject;
  readonly comparables: readonly WeightedComparable[];
  readonly analyzedAt?: Date;
}

export class ComparableAnalysis {
  readonly subject: ComparableSubject;
  readonly comparables: readonly WeightedComparable[];
  readonly analyzedAt: Date;

  constructor(input: ComparableAnalysisInput) {
    if (input.comparables.length === 0) {
      throw new Error("Comparable analysis requires at least one comparable.");
    }

    this.subject = input.subject;
    this.comparables = Object.freeze([...input.comparables]);
    this.analyzedAt = input.analyzedAt ?? new Date();
  }

  get comparableCount(): number {
    return this.comparables.length;
  }

  get totalWeight(): number {
    return this.comparables.reduce(
      (total, comparable) =>
        total + comparable.weight.value,
      0,
    );
  }

  get averageSimilarity(): number {
    const total = this.comparables.reduce(
      (sum, comparable) =>
        sum + comparable.similarityScore.value,
      0,
    );

    return (
      Math.round(
        (total / this.comparables.length) *
          100,
      ) / 100
    );
  }

  get weightedEstimatedValue(): number | undefined {
    const weightedValues =
      this.comparables.map(
        (comparable) =>
          comparable.weightedValue,
      );

    if (
      weightedValues.some(
        (value) =>
          value === undefined,
      )
    ) {
      return undefined;
    }

    const totalWeight =
      this.totalWeight;

    if (totalWeight <= 0) {
      return undefined;
    }

    const definedWeightedValues =
      weightedValues.filter(
        (value): value is number =>
          value !== undefined,
      );

    const weightedTotal =
      definedWeightedValues.reduce(
        (sum, value) =>
          sum + value,
        0,
      );

    return (
      Math.round(
        (
          weightedTotal /
          totalWeight
        ) * 100,
      ) / 100
    );
  }
}
