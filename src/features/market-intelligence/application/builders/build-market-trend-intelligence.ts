import { MarketTrendIntelligence } from "../../domain/entities/market-trend-intelligence";
import { TrendDirection } from "../../domain/enums/trend-direction";
import { ConfidenceScore } from "../../domain/value-objects/confidence-score";
import { MarketScore } from "../../domain/value-objects/market-score";
import {
  calculateMomentumScore,
  deriveOverallTrend,
  describeTrend,
  isNegativeTrend,
  isPositiveTrend,
  type WeightedTrend,
} from "./helpers/trend-utils";

export interface BuildMarketTrendIntelligenceInput {
  readonly averageDailyRateTrend: TrendDirection;
  readonly occupancyTrend: TrendDirection;
  readonly revenueTrend: TrendDirection;
  readonly inventoryTrend: TrendDirection;
  readonly pricingPowerTrend: TrendDirection;
  readonly demandTrend: TrendDirection;
  readonly overallDirection?: TrendDirection;
  readonly momentumScore?: number;
  readonly confidenceScore: number;
  readonly supportingSignals?: readonly string[];
  readonly conflictingSignals?: readonly string[];
  readonly missingInformation?: readonly string[];
}

export function buildMarketTrendIntelligence(
  input: BuildMarketTrendIntelligenceInput,
): MarketTrendIntelligence {
  const weightedTrends = buildWeightedTrends(input);

  const overallDirection =
    input.overallDirection ??
    deriveOverallTrend(weightedTrends);

  const momentumScore = MarketScore.create(
    input.momentumScore ??
      calculateMomentumScore(weightedTrends),
  );

  const supportingSignals =
    input.supportingSignals ??
    deriveSupportingSignals(input);

  const conflictingSignals =
    input.conflictingSignals ??
    deriveConflictingSignals(input, overallDirection);

  const missingInformation =
    input.missingInformation ?? [];

  return MarketTrendIntelligence.create({
    averageDailyRateTrend: input.averageDailyRateTrend,
    occupancyTrend: input.occupancyTrend,
    revenueTrend: input.revenueTrend,
    inventoryTrend: input.inventoryTrend,
    pricingPowerTrend: input.pricingPowerTrend,
    demandTrend: input.demandTrend,
    overallDirection,
    momentumScore,
    confidence: new ConfidenceScore(input.confidenceScore),
    supportingSignals,
    conflictingSignals,
    missingInformation,
    executiveSummary: buildExecutiveSummary({
      overallDirection,
      momentumScore: momentumScore.value,
      supportingSignals,
      conflictingSignals,
      missingInformation,
    }),
  });
}

function buildWeightedTrends(
  input: BuildMarketTrendIntelligenceInput,
): readonly WeightedTrend[] {
  return [
    { direction: input.revenueTrend, weight: 0.25 },
    { direction: input.demandTrend, weight: 0.2 },
    { direction: input.occupancyTrend, weight: 0.15 },
    { direction: input.averageDailyRateTrend, weight: 0.15 },
    { direction: input.pricingPowerTrend, weight: 0.15 },
    {
      direction: input.inventoryTrend,
      weight: 0.1,
    },
  ];
}

function deriveSupportingSignals(
  input: BuildMarketTrendIntelligenceInput,
): readonly string[] {
  const signals: string[] = [];

  addPositiveSignal(
    signals,
    "Average daily rate",
    input.averageDailyRateTrend,
  );
  addPositiveSignal(
    signals,
    "Occupancy",
    input.occupancyTrend,
  );
  addPositiveSignal(
    signals,
    "Revenue",
    input.revenueTrend,
  );
  addPositiveSignal(
    signals,
    "Pricing power",
    input.pricingPowerTrend,
  );
  addPositiveSignal(
    signals,
    "Demand",
    input.demandTrend,
  );

  if (isNegativeTrend(input.inventoryTrend)) {
    signals.push(
      `Inventory is ${describeTrend(
        input.inventoryTrend,
      )}, reducing incremental supply pressure.`,
    );
  }

  return signals;
}

function deriveConflictingSignals(
  input: BuildMarketTrendIntelligenceInput,
  overallDirection: TrendDirection,
): readonly string[] {
  const conflicts: string[] = [];
  const overallIsPositive = isPositiveTrend(overallDirection);
  const overallIsNegative = isNegativeTrend(overallDirection);

  addConflict(
    conflicts,
    "Average daily rate",
    input.averageDailyRateTrend,
    overallIsPositive,
    overallIsNegative,
  );
  addConflict(
    conflicts,
    "Occupancy",
    input.occupancyTrend,
    overallIsPositive,
    overallIsNegative,
  );
  addConflict(
    conflicts,
    "Revenue",
    input.revenueTrend,
    overallIsPositive,
    overallIsNegative,
  );
  addConflict(
    conflicts,
    "Pricing power",
    input.pricingPowerTrend,
    overallIsPositive,
    overallIsNegative,
  );
  addConflict(
    conflicts,
    "Demand",
    input.demandTrend,
    overallIsPositive,
    overallIsNegative,
  );

  if (
    overallIsPositive &&
    isPositiveTrend(input.inventoryTrend)
  ) {
    conflicts.push(
      `Inventory is ${describeTrend(
        input.inventoryTrend,
      )}, which may offset otherwise positive market momentum.`,
    );
  }

  return conflicts;
}

function addPositiveSignal(
  signals: string[],
  label: string,
  direction: TrendDirection,
): void {
  if (isPositiveTrend(direction)) {
    signals.push(
      `${label} is ${describeTrend(direction)}.`,
    );
  }
}

function addConflict(
  conflicts: string[],
  label: string,
  direction: TrendDirection,
  overallIsPositive: boolean,
  overallIsNegative: boolean,
): void {
  if (
    (overallIsPositive && isNegativeTrend(direction)) ||
    (overallIsNegative && isPositiveTrend(direction))
  ) {
    conflicts.push(
      `${label} is ${describeTrend(
        direction,
      )}, conflicting with the overall market direction.`,
    );
  }
}

function buildExecutiveSummary({
  overallDirection,
  momentumScore,
  supportingSignals,
  conflictingSignals,
  missingInformation,
}: {
  readonly overallDirection: TrendDirection;
  readonly momentumScore: number;
  readonly supportingSignals: readonly string[];
  readonly conflictingSignals: readonly string[];
  readonly missingInformation: readonly string[];
}): string {
  return `The market direction is ${describeTrend(
    overallDirection,
  )}, with a momentum score of ${momentumScore}. ${supportingSignals.length} supporting ${
    supportingSignals.length === 1 ? "signal was" : "signals were"
  } identified. ${conflictingSignals.length} ${
    conflictingSignals.length === 1
      ? "conflicting signal requires"
      : "conflicting signals require"
  } attention. ${missingInformation.length} ${
    missingInformation.length === 1 ? "data gap remains" : "data gaps remain"
  }.`;
}
