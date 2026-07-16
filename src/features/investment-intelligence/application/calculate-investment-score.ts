import {
  ConfidenceLevel,
} from "../domain";

import type {
  ComparableAnalysis,
  FinancialPerformance,
  InvestmentScore,
  RevenueProjection,
  Score,
} from "../domain";

import {
  assertPercentage,
} from "./calculation-guards";

import {
  DEFAULT_INVESTMENT_SCORING_POLICY,
} from "./investment-scoring-policy";

import type {
  InvestmentScoringPolicy,
} from "./investment-scoring-policy";

import {
  calculateRatioScore,
  calculateWeightedScore,
  clampScore,
  roundScore,
} from "./score-calculations";

export type CalculateInvestmentScoreInput = {
  readonly revenueProjection: RevenueProjection;
  readonly financialPerformance: FinancialPerformance;
  readonly comparableAnalysis: ComparableAnalysis;
  readonly riskExposure: Score;
  readonly policy?: InvestmentScoringPolicy;
};

function confidenceToScore(
  confidence: ConfidenceLevel,
): number {
  switch (confidence) {
    case ConfidenceLevel.VeryHigh:
      return 100;

    case ConfidenceLevel.High:
      return 85;

    case ConfidenceLevel.Moderate:
      return 70;

    case ConfidenceLevel.Low:
      return 55;

    case ConfidenceLevel.VeryLow:
      return 40;
  }
}

function calculateRevenuePotential(
  revenueProjection: RevenueProjection,
  comparableAnalysis: ComparableAnalysis,
  policy: InvestmentScoringPolicy,
): number {
  const adrPositionScore =
    comparableAnalysis
      .medianAverageDailyRate.amount === 0
      ? 0
      : clampScore(
          (
            revenueProjection
              .projectedAdr.amount /
            comparableAnalysis
              .medianAverageDailyRate.amount
          ) * 50,
        );

  const occupancyPositionScore =
    comparableAnalysis
      .medianOccupancy.value === 0
      ? 0
      : clampScore(
          (
            revenueProjection
              .projectedOccupancy.value /
            comparableAnalysis
              .medianOccupancy.value
          ) * 50,
        );

  const annualRevenue =
    revenueProjection
      .projectedAnnualRevenue.amount;

  const revenueUpsidePercentage =
    annualRevenue === 0
      ? 0
      : (
          comparableAnalysis
            .projectedRevenueUpside.amount /
          annualRevenue
        ) * 100;

  const upsideScore =
    clampScore(
      50 +
        (
          revenueUpsidePercentage /
          policy.fullRevenueUpsidePercentage
        ) *
          50,
    );

  return calculateWeightedScore([
    {
      value: adrPositionScore,
      weight: 40,
    },
    {
      value: occupancyPositionScore,
      weight: 40,
    },
    {
      value: upsideScore,
      weight: 20,
    },
  ]);
}

function calculateFinancialStrength(
  financialPerformance: FinancialPerformance,
  policy: InvestmentScoringPolicy,
): number {
  const breakEvenScore =
    clampScore(
      100 -
        financialPerformance
          .breakEvenOccupancy.value,
    );

  return calculateWeightedScore([
    {
      value: calculateRatioScore(
        financialPerformance.capRate.value,
        policy.targetCapRate,
      ),
      weight: 30,
    },
    {
      value: calculateRatioScore(
        financialPerformance
          .cashOnCashReturn.value,
        policy.targetCashOnCashReturn,
      ),
      weight: 30,
    },
    {
      value: calculateRatioScore(
        financialPerformance
          .debtServiceCoverageRatio,
        policy
          .targetDebtServiceCoverageRatio,
      ),
      weight: 25,
    },
    {
      value: breakEvenScore,
      weight: 15,
    },
  ]);
}

function calculateMarketStrength(
  comparableAnalysis: ComparableAnalysis,
  policy: InvestmentScoringPolicy,
): number {
  return calculateWeightedScore([
    {
      value: calculateRatioScore(
        comparableAnalysis
          .medianOccupancy.value,
        policy.targetMarketOccupancy,
      ),
      weight: 70,
    },
    {
      value: confidenceToScore(
        comparableAnalysis.confidence,
      ),
      weight: 30,
    },
  ]);
}

export function calculateInvestmentScore({
  revenueProjection,
  financialPerformance,
  comparableAnalysis,
  riskExposure,
  policy = DEFAULT_INVESTMENT_SCORING_POLICY,
}: CalculateInvestmentScoreInput): InvestmentScore {
  assertPercentage(
    revenueProjection.projectedOccupancy,
    "Projected occupancy",
  );

  assertPercentage(
    financialPerformance.capRate,
    "Cap rate",
  );

  assertPercentage(
    financialPerformance
      .breakEvenOccupancy,
    "Break-even occupancy",
  );

  if (
    !Number.isFinite(riskExposure.value) ||
    riskExposure.value < 0 ||
    riskExposure.value >
      riskExposure.max
  ) {
    throw new Error(
      "Risk exposure must be between 0 and 100.",
    );
  }

  const revenuePotential =
    calculateRevenuePotential(
      revenueProjection,
      comparableAnalysis,
      policy,
    );

  const financialStrength =
    calculateFinancialStrength(
      financialPerformance,
      policy,
    );

  const marketStrength =
    calculateMarketStrength(
      comparableAnalysis,
      policy,
    );

  const competitivePosition =
    roundScore(
      comparableAnalysis
        .marketPositionScore.value,
    );

  const normalizedRiskExposure =
    roundScore(riskExposure.value);

  const riskResilience =
    100 - normalizedRiskExposure;

  const overall =
    calculateWeightedScore([
      {
        value: revenuePotential,
        weight: 25,
      },
      {
        value: financialStrength,
        weight: 30,
      },
      {
        value: marketStrength,
        weight: 20,
      },
      {
        value: competitivePosition,
        weight: 15,
      },
      {
        value: riskResilience,
        weight: 10,
      },
    ]);

  return {
    overall: {
      value: overall,
      max: 100,
    },
    revenuePotential: {
      value: revenuePotential,
      max: 100,
    },
    financialStrength: {
      value: financialStrength,
      max: 100,
    },
    marketStrength: {
      value: marketStrength,
      max: 100,
    },
    competitivePosition: {
      value: competitivePosition,
      max: 100,
    },
    riskExposure: {
      value: normalizedRiskExposure,
      max: 100,
    },
  };
}
