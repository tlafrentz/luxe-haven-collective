import { ConfidenceScore } from "../value-objects/confidence-score";
import { MarketScore } from "../value-objects/market-score";

export interface PropertyValuationRange {
  readonly low: number;
  readonly estimated: number;
  readonly high: number;
  readonly currency: string;
}

export interface PropertyIntelligenceInput {
  readonly propertyId: string;
  readonly propertyType: string;
  readonly bedrooms?: number;
  readonly bathrooms?: number;
  readonly squareFeet?: number;
  readonly yearBuilt?: number;
  readonly valuation?: PropertyValuationRange;
  readonly estimatedPricePerSquareFoot?: number;
  readonly propertyScore: MarketScore;
  readonly confidence: ConfidenceScore;
  readonly strengths?: readonly string[];
  readonly weaknesses?: readonly string[];
  readonly knownFacts?: readonly string[];
  readonly missingInformation?: readonly string[];
  readonly executiveSummary: string;
}

export class PropertyIntelligence {
  readonly propertyId: string;
  readonly propertyType: string;
  readonly bedrooms?: number;
  readonly bathrooms?: number;
  readonly squareFeet?: number;
  readonly yearBuilt?: number;
  readonly valuation?: PropertyValuationRange;
  readonly estimatedPricePerSquareFoot?: number;
  readonly propertyScore: MarketScore;
  readonly confidence: ConfidenceScore;
  readonly strengths: readonly string[];
  readonly weaknesses: readonly string[];
  readonly knownFacts: readonly string[];
  readonly missingInformation: readonly string[];
  readonly executiveSummary: string;

  private constructor(input: PropertyIntelligenceInput) {
    this.propertyId = input.propertyId.trim();
    this.propertyType = input.propertyType.trim();
    this.bedrooms = input.bedrooms;
    this.bathrooms = input.bathrooms;
    this.squareFeet = input.squareFeet;
    this.yearBuilt = input.yearBuilt;
    this.valuation = input.valuation
      ? Object.freeze({ ...input.valuation })
      : undefined;
    this.estimatedPricePerSquareFoot = input.estimatedPricePerSquareFoot;
    this.propertyScore = input.propertyScore;
    this.confidence = input.confidence;
    this.strengths = Object.freeze([...(input.strengths ?? [])]);
    this.weaknesses = Object.freeze([...(input.weaknesses ?? [])]);
    this.knownFacts = Object.freeze([...(input.knownFacts ?? [])]);
    this.missingInformation = Object.freeze([
      ...(input.missingInformation ?? []),
    ]);
    this.executiveSummary = input.executiveSummary.trim();
  }

  static create(input: PropertyIntelligenceInput): PropertyIntelligence {
    if (!input.propertyId.trim()) {
      throw new Error("PropertyIntelligence requires a propertyId.");
    }

    if (!input.propertyType.trim()) {
      throw new Error("PropertyIntelligence requires a propertyType.");
    }

    this.assertOptionalNonNegative(input.bedrooms, "bedrooms");
    this.assertOptionalNonNegative(input.bathrooms, "bathrooms");
    this.assertOptionalPositive(input.squareFeet, "squareFeet");
    this.assertOptionalPositive(input.yearBuilt, "yearBuilt");
    this.assertOptionalNonNegative(
      input.estimatedPricePerSquareFoot,
      "estimatedPricePerSquareFoot",
    );

    if (input.valuation) {
      this.assertValuation(input.valuation);
    }

    if (!input.executiveSummary.trim()) {
      throw new Error(
        "PropertyIntelligence requires an executiveSummary.",
      );
    }

    return new PropertyIntelligence(input);
  }

  get hasCompletePhysicalProfile(): boolean {
    return (
      this.bedrooms !== undefined &&
      this.bathrooms !== undefined &&
      this.squareFeet !== undefined &&
      this.yearBuilt !== undefined
    );
  }

  get hasValuation(): boolean {
    return this.valuation !== undefined;
  }

  get hasMaterialUnknowns(): boolean {
    return this.missingInformation.length > 0;
  }

  private static assertValuation(
    valuation: PropertyValuationRange,
  ): void {
    const values = [valuation.low, valuation.estimated, valuation.high];

    if (values.some((value) => !Number.isFinite(value) || value < 0)) {
      throw new Error(
        "Property valuation values must be finite, non-negative numbers.",
      );
    }

    if (
      valuation.low > valuation.estimated ||
      valuation.estimated > valuation.high
    ) {
      throw new Error(
        "Property valuation must satisfy low <= estimated <= high.",
      );
    }

    if (!valuation.currency.trim()) {
      throw new Error("Property valuation requires a currency.");
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

  private static assertOptionalPositive(
    value: number | undefined,
    field: string,
  ): void {
    if (
      value !== undefined &&
      (!Number.isFinite(value) || value <= 0)
    ) {
      throw new Error(`${field} must be a finite, positive number.`);
    }
  }
}
