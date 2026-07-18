import { ConfidenceLevel } from "../enums/confidence-level";
import { ConfidenceScore } from "../value-objects/confidence-score";

export interface MarketConfidenceInput {
  readonly overall: ConfidenceScore;
  readonly property: ConfidenceScore;
  readonly comparables: ConfidenceScore;
  readonly neighborhood: ConfidenceScore;
  readonly supply: ConfidenceScore;
  readonly demand: ConfidenceScore;
  readonly trends: ConfidenceScore;
  readonly providerCoveragePercent?: number;
  readonly missingData?: readonly string[];
  readonly explanations?: readonly string[];
  readonly executiveSummary: string;
}

export class MarketConfidence {
  readonly overall: ConfidenceScore;
  readonly property: ConfidenceScore;
  readonly comparables: ConfidenceScore;
  readonly neighborhood: ConfidenceScore;
  readonly supply: ConfidenceScore;
  readonly demand: ConfidenceScore;
  readonly trends: ConfidenceScore;
  readonly providerCoveragePercent?: number;
  readonly missingData: readonly string[];
  readonly explanations: readonly string[];
  readonly executiveSummary: string;

  private constructor(input: MarketConfidenceInput) {
    this.overall = input.overall;
    this.property = input.property;
    this.comparables = input.comparables;
    this.neighborhood = input.neighborhood;
    this.supply = input.supply;
    this.demand = input.demand;
    this.trends = input.trends;
    this.providerCoveragePercent = input.providerCoveragePercent;
    this.missingData = Object.freeze([...(input.missingData ?? [])]);
    this.explanations = Object.freeze([...(input.explanations ?? [])]);
    this.executiveSummary = input.executiveSummary.trim();
  }

  static create(input: MarketConfidenceInput): MarketConfidence {
    if (
      input.providerCoveragePercent !== undefined &&
      (
        !Number.isFinite(input.providerCoveragePercent) ||
        input.providerCoveragePercent < 0 ||
        input.providerCoveragePercent > 100
      )
    ) {
      throw new Error(
        "providerCoveragePercent must be between 0 and 100.",
      );
    }

    if (!input.executiveSummary.trim()) {
      throw new Error("MarketConfidence requires an executiveSummary.");
    }

    return new MarketConfidence(input);
  }

  get level(): ConfidenceLevel {
    return this.overall.level;
  }

  get hasMaterialGaps(): boolean {
    return this.missingData.length > 0;
  }

  get weakestDimension(): {
    readonly name: string;
    readonly score: ConfidenceScore;
  } {
    const dimensions = [
      { name: "property", score: this.property },
      { name: "comparables", score: this.comparables },
      { name: "neighborhood", score: this.neighborhood },
      { name: "supply", score: this.supply },
      { name: "demand", score: this.demand },
      { name: "trends", score: this.trends },
    ] as const;

    return dimensions.reduce((weakest, current) =>
      current.score.lessThan(weakest.score) ? current : weakest,
    );
  }
}
