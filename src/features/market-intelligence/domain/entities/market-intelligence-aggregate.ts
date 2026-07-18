import { ComparableIntelligence } from "./comparable-intelligence";
import { DemandIntelligence } from "./demand-intelligence";
import { ExecutiveMarketSummary } from "./executive-market-summary";
import { MarketConfidence } from "./market-confidence";
import { MarketTrendIntelligence } from "./market-trend-intelligence";
import { NeighborhoodIntelligence } from "./neighborhood-intelligence";
import { PropertyIntelligence } from "./property-intelligence";
import { SupplyIntelligence } from "./supply-intelligence";
import { MarketScore } from "../value-objects/market-score";

export interface MarketIntelligenceAggregateInput {
  readonly reportId: string;
  readonly generatedAt: Date;
  readonly marketName: string;
  readonly property: PropertyIntelligence;
  readonly comparables: ComparableIntelligence;
  readonly neighborhood: NeighborhoodIntelligence;
  readonly supply: SupplyIntelligence;
  readonly demand: DemandIntelligence;
  readonly trends: MarketTrendIntelligence;
  readonly confidence: MarketConfidence;
  readonly executiveSummary: ExecutiveMarketSummary;
  readonly overallMarketScore: MarketScore;
}

export class MarketIntelligenceAggregate {
  readonly reportId: string;
  readonly generatedAt: Date;
  readonly marketName: string;
  readonly property: PropertyIntelligence;
  readonly comparables: ComparableIntelligence;
  readonly neighborhood: NeighborhoodIntelligence;
  readonly supply: SupplyIntelligence;
  readonly demand: DemandIntelligence;
  readonly trends: MarketTrendIntelligence;
  readonly confidence: MarketConfidence;
  readonly executiveSummary: ExecutiveMarketSummary;
  readonly overallMarketScore: MarketScore;

  private constructor(input: MarketIntelligenceAggregateInput) {
    this.reportId = input.reportId.trim();
    this.generatedAt = new Date(input.generatedAt);
    this.marketName = input.marketName.trim();
    this.property = input.property;
    this.comparables = input.comparables;
    this.neighborhood = input.neighborhood;
    this.supply = input.supply;
    this.demand = input.demand;
    this.trends = input.trends;
    this.confidence = input.confidence;
    this.executiveSummary = input.executiveSummary;
    this.overallMarketScore = input.overallMarketScore;
  }

  static create(
    input: MarketIntelligenceAggregateInput,
  ): MarketIntelligenceAggregate {
    if (!input.reportId.trim()) {
      throw new Error("MarketIntelligenceAggregate requires a reportId.");
    }

    if (!input.marketName.trim()) {
      throw new Error("MarketIntelligenceAggregate requires a marketName.");
    }

    if (Number.isNaN(input.generatedAt.getTime())) {
      throw new Error(
        "MarketIntelligenceAggregate requires a valid generatedAt date.",
      );
    }

    return new MarketIntelligenceAggregate(input);
  }

  get hasMaterialUnknowns(): boolean {
    return (
      this.property.hasMaterialUnknowns ||
      this.neighborhood.hasMaterialUnknowns ||
      this.supply.hasMaterialUnknowns ||
      this.demand.hasMaterialUnknowns ||
      this.trends.hasMaterialUnknowns ||
      this.confidence.hasMaterialGaps
    );
  }

  get isDecisionReady(): boolean {
    return (
      this.comparables.hasSufficientComparableEvidence &&
      !this.confidence.hasMaterialGaps &&
      this.confidence.overall.value >= 50
    );
  }
}
