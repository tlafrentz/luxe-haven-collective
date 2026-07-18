import type { ComparableIntelligence } from "../../domain/entities/comparable-intelligence";
import type { DemandIntelligence } from "../../domain/entities/demand-intelligence";
import type { ExecutiveMarketSummary } from "../../domain/entities/executive-market-summary";
import type { MarketConfidence } from "../../domain/entities/market-confidence";
import type { MarketTrendIntelligence } from "../../domain/entities/market-trend-intelligence";
import type { NeighborhoodIntelligence } from "../../domain/entities/neighborhood-intelligence";
import type { PropertyIntelligence } from "../../domain/entities/property-intelligence";
import type { SupplyIntelligence } from "../../domain/entities/supply-intelligence";

function score(value: number) {
  return {
    value,
    rating: "test-rating",
  };
}

function confidence(value: number) {
  return {
    value,
    level: "test-level",
    lessThan(other: { value: number }) {
      return value < other.value;
    },
  };
}

export function createMarketIntelligenceFixtures(
  overrides: {
    readonly comparableCount?: number;
    readonly overallConfidence?: number;
    readonly confidenceMissingData?: readonly string[];
    readonly propertyMissingInformation?: readonly string[];
    readonly demandMissingInformation?: readonly string[];
    readonly trendConflicts?: readonly string[];
  } = {},
) {
  const comparableCount = overrides.comparableCount ?? 5;
  const overallConfidence =
    overrides.overallConfidence ?? 82;

  const property = {
    propertyScore: score(78),
    confidence: confidence(80),
    missingInformation:
      overrides.propertyMissingInformation ?? [],
    hasMaterialUnknowns:
      (overrides.propertyMissingInformation?.length ?? 0) > 0,
    hasValuation: true,
  } as unknown as PropertyIntelligence;

  const comparables = {
    comparableScore: score(84),
    confidence: confidence(83),
    includedComparableCount: comparableCount,
    hasSufficientComparableEvidence:
      comparableCount >= 3,
  } as unknown as ComparableIntelligence;

  const neighborhood = {
    neighborhoodScore: score(76),
    confidence: confidence(78),
    missingInformation: [],
    hasMaterialUnknowns: false,
  } as unknown as NeighborhoodIntelligence;

  const supply = {
    supplyScore: score(68),
    confidence: confidence(72),
    missingInformation: [],
    hasMaterialUnknowns: false,
  } as unknown as SupplyIntelligence;

  const demandMissingInformation =
    overrides.demandMissingInformation ?? [];

  const demand = {
    demandScore: score(88),
    confidence: confidence(86),
    missingInformation: demandMissingInformation,
    hasMaterialUnknowns:
      demandMissingInformation.length > 0,
  } as unknown as DemandIntelligence;

  const conflictingSignals =
    overrides.trendConflicts ?? [];

  const trends = {
    momentumScore: score(81),
    confidence: confidence(79),
    missingInformation: [],
    conflictingSignals,
    hasMaterialUnknowns: false,
    hasConflictingEvidence:
      conflictingSignals.length > 0,
  } as unknown as MarketTrendIntelligence;

  const confidenceMissingData =
    overrides.confidenceMissingData ?? [];

  const marketConfidence = {
    overall: confidence(overallConfidence),
    property: confidence(80),
    comparables: confidence(83),
    neighborhood: confidence(78),
    supply: confidence(72),
    demand: confidence(86),
    trends: confidence(79),
    missingData: confidenceMissingData,
    hasMaterialGaps: confidenceMissingData.length > 0,
  } as unknown as MarketConfidence;

  const executiveSummary = {
    headline: "Balanced market opportunity",
    summary: "Demand is healthy and evidence coverage is strong.",
  } as unknown as ExecutiveMarketSummary;

  return {
    property,
    comparables,
    neighborhood,
    supply,
    demand,
    trends,
    confidence: marketConfidence,
    executiveSummary,
  };
}
