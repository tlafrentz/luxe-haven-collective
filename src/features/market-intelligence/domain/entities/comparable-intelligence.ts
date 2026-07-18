import { PropertyComparable } from "./property-comparable";
import { ConfidenceScore } from "../value-objects/confidence-score";
import { MarketScore } from "../value-objects/market-score";

export interface ExcludedComparable {
  readonly comparableId: string;
  readonly reason: string;
}

export interface ComparableIntelligenceInput {
  readonly totalComparableCount: number;
  readonly strongMatchCount: number;
  readonly moderateMatchCount: number;
  readonly weakMatchCount: number;
  readonly excludedMatchCount: number;
  readonly averageSimilarity: number;
  readonly medianSimilarity: number;
  readonly averageDistanceMiles?: number;
  readonly averageAgeDifferenceYears?: number;
  readonly averageSizeDifferencePercent?: number;
  readonly weightedEstimatedValue?: number;
  readonly medianComparableValue?: number;
  readonly currency?: string;
  readonly comparableScore: MarketScore;
  readonly confidence: ConfidenceScore;
  readonly topComparables?: readonly PropertyComparable[];
  readonly excludedComparables?: readonly ExcludedComparable[];
  readonly executiveSummary: string;
}

export class ComparableIntelligence {
  readonly totalComparableCount: number;
  readonly strongMatchCount: number;
  readonly moderateMatchCount: number;
  readonly weakMatchCount: number;
  readonly excludedMatchCount: number;
  readonly averageSimilarity: number;
  readonly medianSimilarity: number;
  readonly averageDistanceMiles?: number;
  readonly averageAgeDifferenceYears?: number;
  readonly averageSizeDifferencePercent?: number;
  readonly weightedEstimatedValue?: number;
  readonly medianComparableValue?: number;
  readonly currency?: string;
  readonly comparableScore: MarketScore;
  readonly confidence: ConfidenceScore;
  readonly topComparables: readonly PropertyComparable[];
  readonly excludedComparables: readonly ExcludedComparable[];
  readonly executiveSummary: string;

  private constructor(input: ComparableIntelligenceInput) {
    this.totalComparableCount = input.totalComparableCount;
    this.strongMatchCount = input.strongMatchCount;
    this.moderateMatchCount = input.moderateMatchCount;
    this.weakMatchCount = input.weakMatchCount;
    this.excludedMatchCount = input.excludedMatchCount;
    this.averageSimilarity = input.averageSimilarity;
    this.medianSimilarity = input.medianSimilarity;
    this.averageDistanceMiles = input.averageDistanceMiles;
    this.averageAgeDifferenceYears = input.averageAgeDifferenceYears;
    this.averageSizeDifferencePercent = input.averageSizeDifferencePercent;
    this.weightedEstimatedValue = input.weightedEstimatedValue;
    this.medianComparableValue = input.medianComparableValue;
    this.currency = input.currency?.trim();
    this.comparableScore = input.comparableScore;
    this.confidence = input.confidence;
    this.topComparables = Object.freeze([...(input.topComparables ?? [])]);
    this.excludedComparables = Object.freeze(
      (input.excludedComparables ?? []).map((item) =>
        Object.freeze({ ...item }),
      ),
    );
    this.executiveSummary = input.executiveSummary.trim();
  }

  static create(
    input: ComparableIntelligenceInput,
  ): ComparableIntelligence {
    const counts = [
      input.totalComparableCount,
      input.strongMatchCount,
      input.moderateMatchCount,
      input.weakMatchCount,
      input.excludedMatchCount,
    ];

    if (
      counts.some(
        (value) => !Number.isInteger(value) || value < 0,
      )
    ) {
      throw new Error(
        "Comparable counts must be non-negative integers.",
      );
    }

    const classifiedCount =
      input.strongMatchCount +
      input.moderateMatchCount +
      input.weakMatchCount +
      input.excludedMatchCount;

    if (classifiedCount > input.totalComparableCount) {
      throw new Error(
        "Classified comparable counts cannot exceed the total comparable count.",
      );
    }

    this.assertPercentage(input.averageSimilarity, "averageSimilarity");
    this.assertPercentage(input.medianSimilarity, "medianSimilarity");
    this.assertOptionalNonNegative(
      input.averageDistanceMiles,
      "averageDistanceMiles",
    );
    this.assertOptionalNonNegative(
      input.averageAgeDifferenceYears,
      "averageAgeDifferenceYears",
    );
    this.assertOptionalNonNegative(
      input.averageSizeDifferencePercent,
      "averageSizeDifferencePercent",
    );
    this.assertOptionalNonNegative(
      input.weightedEstimatedValue,
      "weightedEstimatedValue",
    );
    this.assertOptionalNonNegative(
      input.medianComparableValue,
      "medianComparableValue",
    );

    if (
      (input.weightedEstimatedValue !== undefined ||
        input.medianComparableValue !== undefined) &&
      !input.currency?.trim()
    ) {
      throw new Error(
        "ComparableIntelligence requires a currency when valuation values are present.",
      );
    }

    if (!input.executiveSummary.trim()) {
      throw new Error(
        "ComparableIntelligence requires an executiveSummary.",
      );
    }

    return new ComparableIntelligence(input);
  }

  get includedComparableCount(): number {
    return Math.max(
      0,
      this.totalComparableCount - this.excludedMatchCount,
    );
  }

  get strongMatchRatio(): number {
    if (this.includedComparableCount === 0) {
      return 0;
    }

    return this.strongMatchCount / this.includedComparableCount;
  }

  get hasSufficientComparableEvidence(): boolean {
    return this.includedComparableCount >= 3;
  }

  private static assertPercentage(
    value: number,
    field: string,
  ): void {
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new Error(`${field} must be between 0 and 100.`);
    }
  }

  private static assertOptionalNonNegative(
    value: number | undefined,
    field: string,
  ): void {
    if (
      value !== undefined &&
      (!Number.isFinite(value) || value < 0)
    ) {
      throw new Error(`${field} must be a finite, non-negative number.`);
    }
  }
}
