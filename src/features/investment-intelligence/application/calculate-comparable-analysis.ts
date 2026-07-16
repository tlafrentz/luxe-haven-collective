import {
  ConfidenceLevel,
} from "../domain";

import type {
  ComparableAnalysis,
  ComparableProperty,
  RevenueProjection,
} from "../domain";

import {
  assertFiniteNonNegative,
  assertMoney,
  assertPercentage,
  roundCurrency,
} from "./calculation-guards";

import {
  calculateMedian,
} from "./statistical-calculations";

export type CalculateComparableAnalysisInput = {
  comparables: readonly ComparableProperty[];
  revenueProjection: RevenueProjection;
  availableNights?: number;
};

function roundScore(value: number): number {
  return Math.round(
    Math.min(
      Math.max(value, 0),
      100,
    ),
  );
}

function calculateMarketPositionScore(
  projectedAdr: number,
  projectedOccupancy: number,
  medianAdr: number,
  medianOccupancy: number,
): number {
  if (
    medianAdr === 0 ||
    medianOccupancy === 0
  ) {
    return 0;
  }

  const adrScore =
    (projectedAdr / medianAdr) * 50;

  const occupancyScore =
    (projectedOccupancy /
      medianOccupancy) *
    50;

  return roundScore(
    (adrScore + occupancyScore) / 2,
  );
}

function determineConfidence(
  comparableCount: number,
): ConfidenceLevel {
  if (comparableCount >= 20) {
    return ConfidenceLevel.VeryHigh;
  }

  if (comparableCount >= 10) {
    return ConfidenceLevel.High;
  }

  if (comparableCount >= 5) {
    return ConfidenceLevel.Moderate;
  }

  if (comparableCount >= 3) {
    return ConfidenceLevel.Low;
  }

  return ConfidenceLevel.VeryLow;
}

export function calculateComparableAnalysis({
  comparables,
  revenueProjection,
  availableNights = 365,
}: CalculateComparableAnalysisInput): ComparableAnalysis {
  if (comparables.length === 0) {
    throw new Error(
      "Comparable analysis requires at least one comparable property.",
    );
  }

  assertMoney(
    revenueProjection.projectedAdr,
    "Projected ADR",
  );

  assertMoney(
    revenueProjection.projectedAnnualRevenue,
    "Projected annual revenue",
  );

  assertPercentage(
    revenueProjection.projectedOccupancy,
    "Projected occupancy",
  );

  assertFiniteNonNegative(
    availableNights,
    "Available nights",
  );

  if (!Number.isInteger(availableNights)) {
    throw new Error(
      "Available nights must be a whole number.",
    );
  }

  for (const comparable of comparables) {
    assertMoney(
      comparable.averageDailyRate,
      `Comparable ${comparable.id} average daily rate`,
    );

    assertPercentage(
      comparable.occupancy,
      `Comparable ${comparable.id} occupancy`,
    );
  }

  const medianAverageDailyRate =
    calculateMedian(
      comparables.map(
        (comparable) =>
          comparable.averageDailyRate.amount,
      ),
      "Comparable ADR",
    );

  const medianOccupancy =
    calculateMedian(
      comparables.map(
        (comparable) =>
          comparable.occupancy.value,
      ),
      "Comparable occupancy",
    );

  const comparableAnnualRevenue =
    medianAverageDailyRate *
    (medianOccupancy / 100) *
    availableNights;

  const revenueDifference =
    revenueProjection
      .projectedAnnualRevenue.amount -
    comparableAnnualRevenue;

  const projectedRevenueUpside =
    Math.max(
      roundCurrency(revenueDifference),
      0,
    );

  const competitiveAdvantages: string[] = [];
  const competitiveDisadvantages: string[] = [];

  if (
    revenueProjection.projectedAdr.amount >
    medianAverageDailyRate
  ) {
    competitiveAdvantages.push(
      "Projected ADR exceeds the comparable median.",
    );
  } else if (
    revenueProjection.projectedAdr.amount <
    medianAverageDailyRate
  ) {
    competitiveDisadvantages.push(
      "Projected ADR is below the comparable median.",
    );
  }

  if (
    revenueProjection
      .projectedOccupancy.value >
    medianOccupancy
  ) {
    competitiveAdvantages.push(
      "Projected occupancy exceeds the comparable median.",
    );
  } else if (
    revenueProjection
      .projectedOccupancy.value <
    medianOccupancy
  ) {
    competitiveDisadvantages.push(
      "Projected occupancy is below the comparable median.",
    );
  }

  return {
    comparables,
    medianAverageDailyRate: {
      amount: roundCurrency(
        medianAverageDailyRate,
      ),
      currency: "USD",
    },
    medianOccupancy: {
      value: medianOccupancy,
    },
    marketPositionScore: {
      value:
        calculateMarketPositionScore(
          revenueProjection
            .projectedAdr.amount,
          revenueProjection
            .projectedOccupancy.value,
          medianAverageDailyRate,
          medianOccupancy,
        ),
      max: 100,
    },
    projectedRevenueUpside: {
      amount: projectedRevenueUpside,
      currency: "USD",
    },
    competitiveAdvantages,
    competitiveDisadvantages,
    confidence: determineConfidence(
      comparables.length,
    ),
  };
}
