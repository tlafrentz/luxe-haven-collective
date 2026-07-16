import {
  ConfidenceLevel,
  EvidenceDirection,
  EvidenceType,
  MarketTrend,
} from "../domain";

import type {
  ComparableAnalysis,
  FinancialPerformance,
  InvestmentRisk,
  MarketSnapshot,
  RevenueProjection,
  SupportingEvidence,
} from "../domain";

import {
  DEFAULT_INVESTMENT_EVIDENCE_POLICY,
} from "./investment-evidence-policy";

import type {
  InvestmentEvidencePolicy,
} from "./investment-evidence-policy";

export type BuildSupportingEvidenceInput = {
  readonly revenueProjection: RevenueProjection;
  readonly financialPerformance: FinancialPerformance;
  readonly comparableAnalysis: ComparableAnalysis;
  readonly market: MarketSnapshot;
  readonly risks: readonly InvestmentRisk[];
  readonly policy?: InvestmentEvidencePolicy;
};

function calculatePercentageDifference(
  value: number,
  baseline: number,
): number {
  if (baseline === 0) {
    return 0;
  }

  return (
    ((value - baseline) / baseline) *
    100
  );
}

function formatPercentage(
  value: number,
): string {
  return `${Math.round(value * 10) / 10}%`;
}

function formatCurrency(
  value: number,
): string {
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    },
  ).format(value);
}

export function buildSupportingEvidence({
  revenueProjection,
  financialPerformance,
  comparableAnalysis,
  market,
  risks,
  policy = DEFAULT_INVESTMENT_EVIDENCE_POLICY,
}: BuildSupportingEvidenceInput): readonly SupportingEvidence[] {
  const evidence: SupportingEvidence[] = [];

  if (
    financialPerformance.capRate.value >=
    policy.strongCapRate
  ) {
    evidence.push({
      id: "strong-cap-rate",
      type: EvidenceType.FinancialModel,
      direction: EvidenceDirection.Positive,
      title: "Strong projected cap rate",
      description:
        `The projected cap rate is ${formatPercentage(
          financialPerformance.capRate.value,
        )}, meeting or exceeding the current acquisition target.`,
      source:
        "Financial performance model",
      confidence: ConfidenceLevel.High,
    });
  }

  if (
    financialPerformance
      .cashOnCashReturn.value >=
    policy.strongCashOnCashReturn
  ) {
    evidence.push({
      id: "strong-cash-on-cash-return",
      type: EvidenceType.FinancialModel,
      direction: EvidenceDirection.Positive,
      title: "Strong cash-on-cash return",
      description:
        `Projected cash-on-cash return is ${formatPercentage(
          financialPerformance
            .cashOnCashReturn.value,
        )}.`,
      source:
        "Financial performance model",
      confidence: ConfidenceLevel.High,
    });
  }

  if (
    financialPerformance
      .debtServiceCoverageRatio >=
    policy
      .healthyDebtServiceCoverageRatio
  ) {
    evidence.push({
      id: "healthy-debt-service-coverage",
      type: EvidenceType.FinancialModel,
      direction: EvidenceDirection.Positive,
      title: "Healthy debt-service coverage",
      description:
        `Projected DSCR is ${financialPerformance.debtServiceCoverageRatio}, indicating that projected NOI provides a meaningful debt-service cushion.`,
      source:
        "Financial performance model",
      confidence: ConfidenceLevel.High,
    });
  }

  if (
    financialPerformance
      .annualCashFlow.amount >=
    policy.strongAnnualCashFlow
  ) {
    evidence.push({
      id: "strong-annual-cash-flow",
      type: EvidenceType.FinancialModel,
      direction: EvidenceDirection.Positive,
      title: "Strong projected annual cash flow",
      description:
        `Projected annual cash flow is ${formatCurrency(
          financialPerformance
            .annualCashFlow.amount,
        )}.`,
      source:
        "Financial performance model",
      confidence: ConfidenceLevel.High,
    });
  }

  if (
    comparableAnalysis
      .projectedRevenueUpside.amount >=
    policy.meaningfulRevenueUpside
  ) {
    evidence.push({
      id: "meaningful-revenue-upside",
      type: EvidenceType.RevenueProjection,
      direction: EvidenceDirection.Positive,
      title: "Meaningful projected revenue upside",
      description:
        `The operating plan projects ${formatCurrency(
          comparableAnalysis
            .projectedRevenueUpside.amount,
        )} in annual revenue above the comparable-market baseline.`,
      source:
        "Revenue projection and comparable analysis",
      confidence:
        comparableAnalysis.confidence,
    });
  }

  const adrPremiumPercentage =
    calculatePercentageDifference(
      revenueProjection.projectedAdr.amount,
      comparableAnalysis
        .medianAverageDailyRate.amount,
    );

  if (
    adrPremiumPercentage >=
    policy.materialAdrPremiumPercentage
  ) {
    evidence.push({
      id: "above-market-adr",
      type: EvidenceType.Comparable,
      direction: EvidenceDirection.Positive,
      title: "Projected ADR exceeds the comparable median",
      description:
        `Projected ADR is ${formatPercentage(
          adrPremiumPercentage,
        )} above the comparable median.`,
      source:
        "Comparable property analysis",
      confidence:
        comparableAnalysis.confidence,
    });
  }

  const occupancyPremiumPoints =
    revenueProjection
      .projectedOccupancy.value -
    comparableAnalysis
      .medianOccupancy.value;

  if (
    occupancyPremiumPoints >=
    policy.materialOccupancyPremiumPoints
  ) {
    evidence.push({
      id: "above-market-occupancy",
      type: EvidenceType.Comparable,
      direction: EvidenceDirection.Positive,
      title: "Projected occupancy exceeds the comparable median",
      description:
        `Projected occupancy is ${Math.round(
          occupancyPremiumPoints * 10,
        ) / 10} percentage points above the comparable median.`,
      source:
        "Comparable property analysis",
      confidence:
        comparableAnalysis.confidence,
    });
  }

  if (
    market.trend === MarketTrend.Growing
  ) {
    evidence.push({
      id: "growing-market",
      type: EvidenceType.MarketTrend,
      direction: EvidenceDirection.Positive,
      title: "Growing market conditions",
      description:
        "The current market snapshot indicates improving demand or performance conditions.",
      source:
        "Market snapshot",
      confidence: ConfidenceLevel.Moderate,
    });
  }

  if (
    comparableAnalysis.confidence ===
      ConfidenceLevel.High ||
    comparableAnalysis.confidence ===
      ConfidenceLevel.VeryHigh
  ) {
    evidence.push({
      id: "strong-comparable-confidence",
      type: EvidenceType.Comparable,
      direction: EvidenceDirection.Positive,
      title: "Strong comparable support",
      description:
        "The comparable-property dataset provides strong support for the projected operating assumptions.",
      source:
        "Comparable property analysis",
      confidence:
        comparableAnalysis.confidence,
    });
  }

  for (const risk of risks) {
    evidence.push({
      id: `risk-${risk.id}`,
      type: EvidenceType.FinancialModel,
      direction: EvidenceDirection.Caution,
      title: risk.title,
      description: risk.description,
      source:
        "Investment risk assessment",
      confidence:
        risk.probability.value >= 80
          ? ConfidenceLevel.High
          : risk.probability.value >= 60
            ? ConfidenceLevel.Moderate
            : ConfidenceLevel.Low,
    });
  }

  return evidence;
}
