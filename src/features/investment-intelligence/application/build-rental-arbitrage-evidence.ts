import {
  ConfidenceLevel,
  EvidenceDirection,
  EvidenceType,
  MarketTrend,
} from "../domain";

import type {
  ComparableAnalysis,
  MarketSnapshot,
  RentalArbitrageFinancialPerformance,
  RevenueProjection,
  SupportingEvidence,
} from "../domain";

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

function formatCurrency(
  amount: number,
): string {
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    },
  ).format(amount);
}

export function buildRentalArbitrageEvidence({
  revenueProjection,
  financialPerformance,
  comparableAnalysis,
  market,
}: {
  readonly revenueProjection:
    RevenueProjection;
  readonly financialPerformance:
    RentalArbitrageFinancialPerformance;
  readonly comparableAnalysis:
    ComparableAnalysis;
  readonly market: MarketSnapshot;
}): readonly SupportingEvidence[] {
  const evidence: SupportingEvidence[] =
    [];

  if (
    financialPerformance
      .leaseCoverageRatio >= 1.35
  ) {
    evidence.push({
      id: "strong-lease-coverage",
      type: EvidenceType.FinancialModel,
      direction:
        EvidenceDirection.Positive,
      title:
        "Projected revenue provides strong lease coverage",
      description:
        `The operating plan produces a ${financialPerformance.leaseCoverageRatio.toFixed(2)} lease coverage ratio, providing a meaningful cushion above the fixed lease commitment.`,
      source:
        "Rental arbitrage financial model",
      confidence:
        confidenceFromPercentage(
          revenueProjection
            .confidence.value,
        ),
    });
  } else if (
    financialPerformance
      .leaseCoverageRatio < 1.2
  ) {
    evidence.push({
      id: "weak-lease-coverage",
      type: EvidenceType.FinancialModel,
      direction:
        EvidenceDirection.Caution,
      title:
        "Lease coverage leaves limited downside protection",
      description:
        `The operating plan produces a ${financialPerformance.leaseCoverageRatio.toFixed(2)} lease coverage ratio, leaving little protection against revenue volatility or cost overruns.`,
      source:
        "Rental arbitrage financial model",
      confidence:
        confidenceFromPercentage(
          revenueProjection
            .confidence.value,
        ),
    });
  }

  if (
    financialPerformance
      .annualCashFlow.amount > 0
  ) {
    evidence.push({
      id: "positive-cash-flow",
      type: EvidenceType.FinancialModel,
      direction:
        EvidenceDirection.Positive,
      title:
        "The operating plan produces positive annual cash flow",
      description:
        `Projected annual cash flow is ${formatCurrency(financialPerformance.annualCashFlow.amount)} after lease and operating expenses.`,
      source:
        "Rental arbitrage financial model",
      confidence:
        confidenceFromPercentage(
          revenueProjection
            .confidence.value,
        ),
    });
  } else {
    evidence.push({
      id: "negative-cash-flow",
      type: EvidenceType.FinancialModel,
      direction:
        EvidenceDirection.Caution,
      title:
        "The operating plan does not produce positive cash flow",
      description:
        `Projected annual cash flow is ${formatCurrency(financialPerformance.annualCashFlow.amount)} after lease and operating expenses.`,
      source:
        "Rental arbitrage financial model",
      confidence:
        confidenceFromPercentage(
          revenueProjection
            .confidence.value,
        ),
    });
  }

  if (
    financialPerformance
      .breakEvenOccupancy.value <=
    market.medianOccupancy.value
  ) {
    evidence.push({
      id: "break-even-supported",
      type: EvidenceType.MarketTrend,
      direction:
        EvidenceDirection.Positive,
      title:
        "Market occupancy supports the break-even threshold",
      description:
        `Break-even occupancy is ${financialPerformance.breakEvenOccupancy.value}% compared with a ${market.medianOccupancy.value}% market median.`,
      source:
        "Market snapshot and financial model",
      confidence: ConfidenceLevel.Moderate,
    });
  } else {
    evidence.push({
      id: "break-even-above-market",
      type: EvidenceType.MarketTrend,
      direction:
        EvidenceDirection.Caution,
      title:
        "The plan requires above-market occupancy",
      description:
        `Break-even occupancy is ${financialPerformance.breakEvenOccupancy.value}% compared with a ${market.medianOccupancy.value}% market median.`,
      source:
        "Market snapshot and financial model",
      confidence: ConfidenceLevel.Moderate,
    });
  }

  if (
    comparableAnalysis
      .projectedRevenueUpside.amount > 0
  ) {
    evidence.push({
      id: "comparable-revenue-upside",
      type: EvidenceType.Comparable,
      direction:
        EvidenceDirection.Positive,
      title:
        "Comparable performance indicates revenue upside",
      description:
        `Comparable analysis indicates ${formatCurrency(comparableAnalysis.projectedRevenueUpside.amount)} of projected annual revenue upside.`,
      source:
        "Comparable property analysis",
      confidence:
        comparableAnalysis.confidence,
    });
  }

  if (
    market.trend ===
    MarketTrend.Growing
  ) {
    evidence.push({
      id: "growing-market",
      type: EvidenceType.MarketTrend,
      direction:
        EvidenceDirection.Positive,
      title:
        "Market demand trend is supportive",
      description:
        "The market snapshot identifies a growing demand environment that may support the operating plan.",
      source:
        "Market snapshot",
      confidence: ConfidenceLevel.Moderate,
    });
  } else if (
    market.trend ===
    MarketTrend.Declining
  ) {
    evidence.push({
      id: "declining-market",
      type: EvidenceType.MarketTrend,
      direction:
        EvidenceDirection.Caution,
      title:
        "Declining market conditions increase execution risk",
      description:
        "The market snapshot indicates weakening demand, which could reduce occupancy or pricing power.",
      source:
        "Market snapshot",
      confidence: ConfidenceLevel.Moderate,
    });
  }

  return evidence;
}
