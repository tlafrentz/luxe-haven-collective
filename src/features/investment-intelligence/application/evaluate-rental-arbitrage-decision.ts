import {
  AcquisitionRecommendation,
  ConfidenceLevel,
} from "../domain";

import type {
  ComparableAnalysis,
  InvestmentRisk,
  InvestmentScore,
  MarketSnapshot,
  RentalArbitrageFinancialPerformance,
  RevenueProjection,
  SupportingEvidence,
} from "../domain";

function clampScore(
  value: number,
): number {
  return Math.max(
    0,
    Math.min(
      100,
      Math.round(value),
    ),
  );
}

function score(value: number) {
  return {
    value: clampScore(value),
    max: 100 as const,
  };
}

function confidenceFromPercentage(
  value: number,
): ConfidenceLevel {
  if (value >= 90) {
    return ConfidenceLevel.VeryHigh;
  }

  if (value >= 75) {
    return ConfidenceLevel.High;
  }

  if (value >= 60) {
    return ConfidenceLevel.Moderate;
  }

  if (value >= 40) {
    return ConfidenceLevel.Low;
  }

  return ConfidenceLevel.VeryLow;
}

function confidenceLevelToPercentage(
  confidence: ConfidenceLevel,
): number {
  switch (confidence) {
    case ConfidenceLevel.VeryHigh:
      return 95;

    case ConfidenceLevel.High:
      return 82;

    case ConfidenceLevel.Moderate:
      return 67;

    case ConfidenceLevel.Low:
      return 47;

    case ConfidenceLevel.VeryLow:
      return 25;
  }
}

export type RentalArbitrageDecisionEvaluation = {
  readonly score: InvestmentScore;
  readonly recommendation:
    AcquisitionRecommendation;
  readonly confidence: ConfidenceLevel;
};

export function evaluateRentalArbitrageDecision({
  revenueProjection,
  financialPerformance,
  comparableAnalysis,
  market,
  riskExposure,
  risks,
  supportingEvidence,
}: {
  readonly revenueProjection:
    RevenueProjection;
  readonly financialPerformance:
    RentalArbitrageFinancialPerformance;
  readonly comparableAnalysis:
    ComparableAnalysis;
  readonly market: MarketSnapshot;
  readonly riskExposure: number;
  readonly risks:
    readonly InvestmentRisk[];
  readonly supportingEvidence:
    readonly SupportingEvidence[];
}): RentalArbitrageDecisionEvaluation {
  const revenuePotential =
    clampScore(
      (
        revenueProjection
          .projectedOccupancy.value +
        Math.min(
          100,
          (
            revenueProjection
              .projectedAdr.amount /
            Math.max(
              1,
              market.medianAdr.amount,
            )
          ) * 75,
        )
      ) / 2,
    );

  const leaseCoverageScore =
    clampScore(
      (
        financialPerformance
          .leaseCoverageRatio /
        1.5
      ) * 100,
    );

  const cashFlowScore =
    financialPerformance
      .annualGrossRevenue.amount <= 0
      ? 0
      : clampScore(
          (
            financialPerformance
              .annualCashFlow.amount /
            financialPerformance
              .annualGrossRevenue.amount
          ) * 500,
        );

  const returnScore =
    clampScore(
      financialPerformance
        .cashOnCashReturn.value * 2,
    );

  const financialStrength =
    clampScore(
      (
        leaseCoverageScore *
          0.4 +
        cashFlowScore * 0.25 +
        returnScore * 0.35
      ),
    );

  const marketStrength =
    clampScore(
      (
        market
          .medianOccupancy.value *
          0.7 +
        (
          financialPerformance
            .breakEvenOccupancy.value <=
          market
            .medianOccupancy.value
            ? 85
            : 45
        ) *
          0.3
      ),
    );

  const competitivePosition =
    comparableAnalysis
      .marketPositionScore.value;

  const overall =
    clampScore(
      revenuePotential * 0.2 +
        financialStrength * 0.35 +
        marketStrength * 0.15 +
        competitivePosition * 0.15 +
        (100 - riskExposure) *
          0.15,
    );

  const investmentScore: InvestmentScore =
    {
      overall: score(overall),
      revenuePotential:
        score(revenuePotential),
      financialStrength:
        score(financialStrength),
      marketStrength:
        score(marketStrength),
      competitivePosition:
        score(competitivePosition),
      riskExposure:
        score(riskExposure),
    };

  const hasCriticalRisk =
    risks.some(
      ({ severity }) =>
        severity === "critical",
    );

  const positiveEvidenceCount =
    supportingEvidence.filter(
      ({ direction }) =>
        direction === "positive",
    ).length;

  let recommendation:
    AcquisitionRecommendation;

  if (
    hasCriticalRisk ||
    financialPerformance
      .annualCashFlow.amount <= 0 ||
    financialPerformance
      .leaseCoverageRatio < 1
  ) {
    recommendation =
      AcquisitionRecommendation.Pass;
  } else if (
    overall >= 80 &&
    financialPerformance
      .leaseCoverageRatio >= 1.35 &&
    financialPerformance
      .cashOnCashReturn.value >= 20 &&
    riskExposure <= 25
  ) {
    recommendation =
      AcquisitionRecommendation.StrongBuy;
  } else if (
    overall >= 65 &&
    financialPerformance
      .leaseCoverageRatio >= 1.2 &&
    financialPerformance
      .cashOnCashReturn.value >= 12
  ) {
    recommendation =
      AcquisitionRecommendation.Buy;
  } else if (
    overall >= 50 &&
    financialPerformance
      .leaseCoverageRatio >= 1.05 &&
    positiveEvidenceCount >= 2
  ) {
    recommendation =
      AcquisitionRecommendation.BuyWithConditions;
  } else {
    recommendation =
      AcquisitionRecommendation.Wait;
  }

  const combinedConfidence =
    (
      revenueProjection
        .confidence.value *
        0.55 +
      confidenceLevelToPercentage(
        comparableAnalysis.confidence,
      ) *
        0.3 +
      (
        supportingEvidence.length >= 4
          ? 85
          : supportingEvidence.length >= 2
            ? 70
            : 50
      ) *
        0.15
    );

  return {
    score: investmentScore,
    recommendation,
    confidence:
      confidenceFromPercentage(
        combinedConfidence,
      ),
  };
}
