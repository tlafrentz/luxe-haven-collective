import { IntelligenceRating } from "../enums/intelligence-rating";
import { TrendDirection } from "../enums/trend-direction";
import { ConfidenceScore } from "../value-objects/confidence-score";
import { MarketScore } from "../value-objects/market-score";

export interface DemandIntelligenceInput {
  readonly occupancyPercent?: number;
  readonly averageDailyRate?: number;
  readonly revenuePerAvailableNight?: number;
  readonly bookingPacePercent?: number;
  readonly weekendStrength: IntelligenceRating;
  readonly weekdayStrength: IntelligenceRating;
  readonly seasonalityStrength: IntelligenceRating;
  readonly demandOutlook: TrendDirection;
  readonly demandScore: MarketScore;
  readonly confidence: ConfidenceScore;
  readonly strengths?: readonly string[];
  readonly risks?: readonly string[];
  readonly missingInformation?: readonly string[];
  readonly executiveSummary: string;
}

export class DemandIntelligence {
  readonly occupancyPercent?: number;
  readonly averageDailyRate?: number;
  readonly revenuePerAvailableNight?: number;
  readonly bookingPacePercent?: number;
  readonly weekendStrength: IntelligenceRating;
  readonly weekdayStrength: IntelligenceRating;
  readonly seasonalityStrength: IntelligenceRating;
  readonly demandOutlook: TrendDirection;
  readonly demandScore: MarketScore;
  readonly confidence: ConfidenceScore;
  readonly strengths: readonly string[];
  readonly risks: readonly string[];
  readonly missingInformation: readonly string[];
  readonly executiveSummary: string;

  private constructor(input: DemandIntelligenceInput) {
    this.occupancyPercent = input.occupancyPercent;
    this.averageDailyRate = input.averageDailyRate;
    this.revenuePerAvailableNight = input.revenuePerAvailableNight;
    this.bookingPacePercent = input.bookingPacePercent;
    this.weekendStrength = input.weekendStrength;
    this.weekdayStrength = input.weekdayStrength;
    this.seasonalityStrength = input.seasonalityStrength;
    this.demandOutlook = input.demandOutlook;
    this.demandScore = input.demandScore;
    this.confidence = input.confidence;
    this.strengths = Object.freeze([...(input.strengths ?? [])]);
    this.risks = Object.freeze([...(input.risks ?? [])]);
    this.missingInformation = Object.freeze([
      ...(input.missingInformation ?? []),
    ]);
    this.executiveSummary = input.executiveSummary.trim();
  }

  static create(input: DemandIntelligenceInput): DemandIntelligence {
    this.assertOptionalPercentage(
      input.occupancyPercent,
      "occupancyPercent",
    );
    this.assertOptionalNonNegative(
      input.averageDailyRate,
      "averageDailyRate",
    );
    this.assertOptionalNonNegative(
      input.revenuePerAvailableNight,
      "revenuePerAvailableNight",
    );
    this.assertOptionalPercentage(
      input.bookingPacePercent,
      "bookingPacePercent",
    );

    if (!input.executiveSummary.trim()) {
      throw new Error("DemandIntelligence requires an executiveSummary.");
    }

    return new DemandIntelligence(input);
  }

  get hasCorePerformanceMetrics(): boolean {
    return (
      this.occupancyPercent !== undefined &&
      this.averageDailyRate !== undefined &&
      this.revenuePerAvailableNight !== undefined
    );
  }

  get hasMaterialUnknowns(): boolean {
    return this.missingInformation.length > 0;
  }

  private static assertOptionalPercentage(
    value: number | undefined,
    field: string,
  ): void {
    if (
      value !== undefined &&
      (!Number.isFinite(value) || value < 0 || value > 100)
    ) {
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
