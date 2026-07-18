import { IntelligenceRating } from "../enums/intelligence-rating";
import { ConfidenceScore } from "../value-objects/confidence-score";
import { MarketScore } from "../value-objects/market-score";

export interface SupplyIntelligenceInput {
  readonly activeListingCount?: number;
  readonly professionalOperatorSharePercent?: number;
  readonly luxuryInventorySharePercent?: number;
  readonly inventoryGrowthPercent?: number;
  readonly saturationScore: MarketScore;
  readonly competitionRating: IntelligenceRating;
  readonly supplyScore: MarketScore;
  readonly confidence: ConfidenceScore;
  readonly opportunities?: readonly string[];
  readonly risks?: readonly string[];
  readonly missingInformation?: readonly string[];
  readonly executiveSummary: string;
}

export class SupplyIntelligence {
  readonly activeListingCount?: number;
  readonly professionalOperatorSharePercent?: number;
  readonly luxuryInventorySharePercent?: number;
  readonly inventoryGrowthPercent?: number;
  readonly saturationScore: MarketScore;
  readonly competitionRating: IntelligenceRating;
  readonly supplyScore: MarketScore;
  readonly confidence: ConfidenceScore;
  readonly opportunities: readonly string[];
  readonly risks: readonly string[];
  readonly missingInformation: readonly string[];
  readonly executiveSummary: string;

  private constructor(input: SupplyIntelligenceInput) {
    this.activeListingCount = input.activeListingCount;
    this.professionalOperatorSharePercent =
      input.professionalOperatorSharePercent;
    this.luxuryInventorySharePercent = input.luxuryInventorySharePercent;
    this.inventoryGrowthPercent = input.inventoryGrowthPercent;
    this.saturationScore = input.saturationScore;
    this.competitionRating = input.competitionRating;
    this.supplyScore = input.supplyScore;
    this.confidence = input.confidence;
    this.opportunities = Object.freeze([...(input.opportunities ?? [])]);
    this.risks = Object.freeze([...(input.risks ?? [])]);
    this.missingInformation = Object.freeze([
      ...(input.missingInformation ?? []),
    ]);
    this.executiveSummary = input.executiveSummary.trim();
  }

  static create(input: SupplyIntelligenceInput): SupplyIntelligence {
    this.assertOptionalNonNegativeInteger(
      input.activeListingCount,
      "activeListingCount",
    );
    this.assertOptionalPercentage(
      input.professionalOperatorSharePercent,
      "professionalOperatorSharePercent",
    );
    this.assertOptionalPercentage(
      input.luxuryInventorySharePercent,
      "luxuryInventorySharePercent",
    );
    this.assertOptionalFinite(
      input.inventoryGrowthPercent,
      "inventoryGrowthPercent",
    );

    if (!input.executiveSummary.trim()) {
      throw new Error("SupplyIntelligence requires an executiveSummary.");
    }

    return new SupplyIntelligence(input);
  }

  get isHighlyCompetitive(): boolean {
    return (
      this.competitionRating === IntelligenceRating.Exceptional ||
      this.competitionRating === IntelligenceRating.Strong
    );
  }

  get hasMaterialUnknowns(): boolean {
    return this.missingInformation.length > 0;
  }

  private static assertOptionalNonNegativeInteger(
    value: number | undefined,
    field: string,
  ): void {
    if (
      value !== undefined &&
      (!Number.isInteger(value) || value < 0)
    ) {
      throw new Error(`${field} must be a non-negative integer.`);
    }
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

  private static assertOptionalFinite(
    value: number | undefined,
    field: string,
  ): void {
    if (value !== undefined && !Number.isFinite(value)) {
      throw new Error(`${field} must be a finite number.`);
    }
  }
}
