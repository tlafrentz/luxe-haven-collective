import { ComparableIntelligence } from "../../domain/entities/comparable-intelligence";
import { DemandIntelligence } from "../../domain/entities/demand-intelligence";
import { MarketConfidence } from "../../domain/entities/market-confidence";
import { MarketTrendIntelligence } from "../../domain/entities/market-trend-intelligence";
import { NeighborhoodIntelligence } from "../../domain/entities/neighborhood-intelligence";
import { PropertyIntelligence } from "../../domain/entities/property-intelligence";
import { SupplyIntelligence } from "../../domain/entities/supply-intelligence";
import { MarketScore } from "../../domain/value-objects/market-score";
import { calculateWeightedScore } from "./helpers/market-readiness-utils";

export interface OverallMarketScoreWeights {
  readonly property: number;
  readonly comparables: number;
  readonly neighborhood: number;
  readonly supply: number;
  readonly demand: number;
  readonly trends: number;
  readonly confidence: number;
}

export interface CalculateOverallMarketScoreInput {
  readonly property: PropertyIntelligence;
  readonly comparables: ComparableIntelligence;
  readonly neighborhood: NeighborhoodIntelligence;
  readonly supply: SupplyIntelligence;
  readonly demand: DemandIntelligence;
  readonly trends: MarketTrendIntelligence;
  readonly confidence: MarketConfidence;
  readonly weights?: Partial<OverallMarketScoreWeights>;
}

export const DEFAULT_OVERALL_MARKET_SCORE_WEIGHTS: OverallMarketScoreWeights =
  Object.freeze({
    property: 0.15,
    comparables: 0.2,
    neighborhood: 0.15,
    supply: 0.1,
    demand: 0.2,
    trends: 0.1,
    confidence: 0.1,
  });

export function calculateOverallMarketScore(
  input: CalculateOverallMarketScoreInput,
): MarketScore {
  const weights = normalizeWeights({
    ...DEFAULT_OVERALL_MARKET_SCORE_WEIGHTS,
    ...input.weights,
  });

  return MarketScore.create(
    calculateWeightedScore([
      {
        score: input.property.propertyScore.value,
        weight: weights.property,
      },
      {
        score: input.comparables.comparableScore.value,
        weight: weights.comparables,
      },
      {
        score: input.neighborhood.neighborhoodScore.value,
        weight: weights.neighborhood,
      },
      {
        score: input.supply.supplyScore.value,
        weight: weights.supply,
      },
      {
        score: input.demand.demandScore.value,
        weight: weights.demand,
      },
      {
        score: input.trends.momentumScore.value,
        weight: weights.trends,
      },
      {
        score: input.confidence.overall.value,
        weight: weights.confidence,
      },
    ]),
  );
}

function normalizeWeights(
  weights: OverallMarketScoreWeights,
): OverallMarketScoreWeights {
  const entries = Object.entries(weights) as [
    keyof OverallMarketScoreWeights,
    number,
  ][];

  for (const [name, weight] of entries) {
    if (!Number.isFinite(weight) || weight < 0) {
      throw new Error(
        `Overall market score weight "${name}" must be a finite, non-negative number.`,
      );
    }
  }

  const totalWeight = entries.reduce(
    (sum, [, weight]) => sum + weight,
    0,
  );

  if (totalWeight <= 0) {
    throw new Error(
      "Overall market score weights must contain at least one positive value.",
    );
  }

  return {
    property: weights.property / totalWeight,
    comparables: weights.comparables / totalWeight,
    neighborhood: weights.neighborhood / totalWeight,
    supply: weights.supply / totalWeight,
    demand: weights.demand / totalWeight,
    trends: weights.trends / totalWeight,
    confidence: weights.confidence / totalWeight,
  };
}
