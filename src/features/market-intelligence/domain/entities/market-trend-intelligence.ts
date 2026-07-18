import { TrendDirection } from "../enums/trend-direction";
import { ConfidenceScore } from "../value-objects/confidence-score";
import { MarketScore } from "../value-objects/market-score";

export interface MarketTrendIntelligenceInput {
  readonly averageDailyRateTrend: TrendDirection;
  readonly occupancyTrend: TrendDirection;
  readonly revenueTrend: TrendDirection;
  readonly inventoryTrend: TrendDirection;
  readonly pricingPowerTrend: TrendDirection;
  readonly demandTrend: TrendDirection;
  readonly overallDirection: TrendDirection;
  readonly momentumScore: MarketScore;
  readonly confidence: ConfidenceScore;
  readonly supportingSignals?: readonly string[];
  readonly conflictingSignals?: readonly string[];
  readonly missingInformation?: readonly string[];
  readonly executiveSummary: string;
}

export class MarketTrendIntelligence {
  readonly averageDailyRateTrend: TrendDirection;
  readonly occupancyTrend: TrendDirection;
  readonly revenueTrend: TrendDirection;
  readonly inventoryTrend: TrendDirection;
  readonly pricingPowerTrend: TrendDirection;
  readonly demandTrend: TrendDirection;
  readonly overallDirection: TrendDirection;
  readonly momentumScore: MarketScore;
  readonly confidence: ConfidenceScore;
  readonly supportingSignals: readonly string[];
  readonly conflictingSignals: readonly string[];
  readonly missingInformation: readonly string[];
  readonly executiveSummary: string;

  private constructor(input: MarketTrendIntelligenceInput) {
    this.averageDailyRateTrend = input.averageDailyRateTrend;
    this.occupancyTrend = input.occupancyTrend;
    this.revenueTrend = input.revenueTrend;
    this.inventoryTrend = input.inventoryTrend;
    this.pricingPowerTrend = input.pricingPowerTrend;
    this.demandTrend = input.demandTrend;
    this.overallDirection = input.overallDirection;
    this.momentumScore = input.momentumScore;
    this.confidence = input.confidence;
    this.supportingSignals = Object.freeze([
      ...(input.supportingSignals ?? []),
    ]);
    this.conflictingSignals = Object.freeze([
      ...(input.conflictingSignals ?? []),
    ]);
    this.missingInformation = Object.freeze([
      ...(input.missingInformation ?? []),
    ]);
    this.executiveSummary = input.executiveSummary.trim();
  }

  static create(
    input: MarketTrendIntelligenceInput,
  ): MarketTrendIntelligence {
    if (!input.executiveSummary.trim()) {
      throw new Error(
        "MarketTrendIntelligence requires an executiveSummary.",
      );
    }

    return new MarketTrendIntelligence(input);
  }

  get isPositive(): boolean {
    return (
      this.overallDirection === TrendDirection.Positive ||
      this.overallDirection === TrendDirection.StronglyPositive
    );
  }

  get hasConflictingEvidence(): boolean {
    return this.conflictingSignals.length > 0;
  }

  get hasMaterialUnknowns(): boolean {
    return this.missingInformation.length > 0;
  }
}
