import { ComparableIntelligence } from "../../domain/entities/comparable-intelligence";
import { DemandIntelligence } from "../../domain/entities/demand-intelligence";
import { ExecutiveMarketSummary } from "../../domain/entities/executive-market-summary";
import { MarketConfidence } from "../../domain/entities/market-confidence";
import { MarketIntelligenceAggregate } from "../../domain/entities/market-intelligence-aggregate";
import { MarketTrendIntelligence } from "../../domain/entities/market-trend-intelligence";
import { NeighborhoodIntelligence } from "../../domain/entities/neighborhood-intelligence";
import { PropertyIntelligence } from "../../domain/entities/property-intelligence";
import { SupplyIntelligence } from "../../domain/entities/supply-intelligence";
import { MarketScore } from "../../domain/value-objects/market-score";
import {
  calculateOverallMarketScore,
  type OverallMarketScoreWeights,
} from "./calculate-overall-market-score";
import {
  validateMarketIntelligenceReadiness,
  type MarketIntelligenceReadiness,
} from "./validate-market-intelligence-readiness";

export interface BuildMarketIntelligenceAggregateInput {
  readonly reportId: string;
  readonly marketName: string;
  readonly generatedAt?: Date;
  readonly property: PropertyIntelligence;
  readonly comparables: ComparableIntelligence;
  readonly neighborhood: NeighborhoodIntelligence;
  readonly supply: SupplyIntelligence;
  readonly demand: DemandIntelligence;
  readonly trends: MarketTrendIntelligence;
  readonly confidence: MarketConfidence;
  readonly executiveSummary: ExecutiveMarketSummary;
  readonly overallMarketScore?: MarketScore;
  readonly scoreWeights?: Partial<OverallMarketScoreWeights>;
}

export interface BuildMarketIntelligenceAggregateResult {
  readonly aggregate: MarketIntelligenceAggregate;
  readonly readiness: MarketIntelligenceReadiness;
}

export function buildMarketIntelligenceAggregate(
  input: BuildMarketIntelligenceAggregateInput,
): BuildMarketIntelligenceAggregateResult {
  const overallMarketScore =
    input.overallMarketScore ??
    calculateOverallMarketScore({
      property: input.property,
      comparables: input.comparables,
      neighborhood: input.neighborhood,
      supply: input.supply,
      demand: input.demand,
      trends: input.trends,
      confidence: input.confidence,
      weights: input.scoreWeights,
    });

  const aggregate = MarketIntelligenceAggregate.create({
    reportId: input.reportId,
    generatedAt: input.generatedAt ?? new Date(),
    marketName: input.marketName,
    property: input.property,
    comparables: input.comparables,
    neighborhood: input.neighborhood,
    supply: input.supply,
    demand: input.demand,
    trends: input.trends,
    confidence: input.confidence,
    executiveSummary: input.executiveSummary,
    overallMarketScore,
  });

  const readiness = validateMarketIntelligenceReadiness({
    property: input.property,
    comparables: input.comparables,
    neighborhood: input.neighborhood,
    supply: input.supply,
    demand: input.demand,
    trends: input.trends,
    confidence: input.confidence,
  });

  return Object.freeze({
    aggregate,
    readiness,
  });
}
