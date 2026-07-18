import { IntelligenceRating } from "../enums/intelligence-rating";
import { ConfidenceScore } from "../value-objects/confidence-score";
import { MarketScore } from "../value-objects/market-score";

export interface NeighborhoodDimension {
  readonly score: MarketScore;
  readonly rating: IntelligenceRating;
  readonly explanation?: string;
}

export interface NeighborhoodIntelligenceInput {
  readonly neighborhoodName: string;
  readonly walkability: NeighborhoodDimension;
  readonly dining: NeighborhoodDimension;
  readonly entertainment: NeighborhoodDimension;
  readonly businessTravel: NeighborhoodDimension;
  readonly airportAccess: NeighborhoodDimension;
  readonly medicalAccess: NeighborhoodDimension;
  readonly universityAccess: NeighborhoodDimension;
  readonly conventionDemand: NeighborhoodDimension;
  readonly hospitalitySuitability: NeighborhoodDimension;
  readonly neighborhoodScore: MarketScore;
  readonly confidence: ConfidenceScore;
  readonly strengths?: readonly string[];
  readonly risks?: readonly string[];
  readonly missingInformation?: readonly string[];
  readonly executiveSummary: string;
}

export class NeighborhoodIntelligence {
  readonly neighborhoodName: string;
  readonly walkability: NeighborhoodDimension;
  readonly dining: NeighborhoodDimension;
  readonly entertainment: NeighborhoodDimension;
  readonly businessTravel: NeighborhoodDimension;
  readonly airportAccess: NeighborhoodDimension;
  readonly medicalAccess: NeighborhoodDimension;
  readonly universityAccess: NeighborhoodDimension;
  readonly conventionDemand: NeighborhoodDimension;
  readonly hospitalitySuitability: NeighborhoodDimension;
  readonly neighborhoodScore: MarketScore;
  readonly confidence: ConfidenceScore;
  readonly strengths: readonly string[];
  readonly risks: readonly string[];
  readonly missingInformation: readonly string[];
  readonly executiveSummary: string;

  private constructor(input: NeighborhoodIntelligenceInput) {
    this.neighborhoodName = input.neighborhoodName.trim();
    this.walkability = this.freezeDimension(input.walkability);
    this.dining = this.freezeDimension(input.dining);
    this.entertainment = this.freezeDimension(input.entertainment);
    this.businessTravel = this.freezeDimension(input.businessTravel);
    this.airportAccess = this.freezeDimension(input.airportAccess);
    this.medicalAccess = this.freezeDimension(input.medicalAccess);
    this.universityAccess = this.freezeDimension(input.universityAccess);
    this.conventionDemand = this.freezeDimension(input.conventionDemand);
    this.hospitalitySuitability = this.freezeDimension(
      input.hospitalitySuitability,
    );
    this.neighborhoodScore = input.neighborhoodScore;
    this.confidence = input.confidence;
    this.strengths = Object.freeze([...(input.strengths ?? [])]);
    this.risks = Object.freeze([...(input.risks ?? [])]);
    this.missingInformation = Object.freeze([
      ...(input.missingInformation ?? []),
    ]);
    this.executiveSummary = input.executiveSummary.trim();
  }

  static create(
    input: NeighborhoodIntelligenceInput,
  ): NeighborhoodIntelligence {
    if (!input.neighborhoodName.trim()) {
      throw new Error(
        "NeighborhoodIntelligence requires a neighborhoodName.",
      );
    }

    const dimensions: readonly NeighborhoodDimension[] = [
      input.walkability,
      input.dining,
      input.entertainment,
      input.businessTravel,
      input.airportAccess,
      input.medicalAccess,
      input.universityAccess,
      input.conventionDemand,
      input.hospitalitySuitability,
    ];

    for (const dimension of dimensions) {
      if (dimension.rating !== dimension.score.rating) {
        throw new Error(
          "Neighborhood dimension rating must match its MarketScore rating.",
        );
      }
    }

    if (!input.executiveSummary.trim()) {
      throw new Error(
        "NeighborhoodIntelligence requires an executiveSummary.",
      );
    }

    return new NeighborhoodIntelligence(input);
  }

  get opportunityCount(): number {
    return this.strengths.length;
  }

  get riskCount(): number {
    return this.risks.length;
  }

  get hasMaterialUnknowns(): boolean {
    return this.missingInformation.length > 0;
  }

  private freezeDimension(
    dimension: NeighborhoodDimension,
  ): NeighborhoodDimension {
    return Object.freeze({
      ...dimension,
      explanation: dimension.explanation?.trim(),
    });
  }
}
