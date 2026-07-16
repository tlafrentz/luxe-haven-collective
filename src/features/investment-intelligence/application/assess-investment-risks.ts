import {
  ConfidenceLevel,
  MarketTrend,
  RiskSeverity,
} from "../domain";

import type {
  ComparableAnalysis,
  FinancialPerformance,
  InvestmentRisk,
  MarketSnapshot,
  RevenueProjection,
  Score,
} from "../domain";

import {
  DEFAULT_INVESTMENT_RISK_POLICY,
} from "./investment-risk-policy";

import type {
  InvestmentRiskPolicy,
} from "./investment-risk-policy";

import {
  clampScore,
  roundScore,
} from "./score-calculations";

export type AssessInvestmentRisksInput = {
  readonly revenueProjection: RevenueProjection;
  readonly financialPerformance: FinancialPerformance;
  readonly comparableAnalysis: ComparableAnalysis;
  readonly market: MarketSnapshot;
  readonly policy?: InvestmentRiskPolicy;
};

export type AssessInvestmentRisksResult = {
  readonly risks: readonly InvestmentRisk[];
  readonly riskExposure: Score;
};

function severityScore(
  severity: RiskSeverity,
): number {
  switch (severity) {
    case RiskSeverity.Critical:
      return 100;

    case RiskSeverity.High:
      return 75;

    case RiskSeverity.Medium:
      return 50;

    case RiskSeverity.Low:
      return 25;
  }
}

function calculateRiskExposure(
  risks: readonly InvestmentRisk[],
): Score {
  if (risks.length === 0) {
    return {
      value: 0,
      max: 100,
    };
  }

  const weightedExposure =
    risks.reduce(
      (total, risk) =>
        total +
        severityScore(risk.severity) *
          (risk.probability.value / 100),
      0,
    ) / risks.length;

  const concentrationAdjustment =
    Math.max(risks.length - 1, 0) * 4;

  return {
    value: roundScore(
      clampScore(
        weightedExposure +
          concentrationAdjustment,
      ),
    ),
    max: 100,
  };
}

function calculateAdrPremiumPercentage(
  projectedAdr: number,
  medianAdr: number,
): number {
  if (medianAdr === 0) {
    return 0;
  }

  return (
    ((projectedAdr - medianAdr) /
      medianAdr) *
    100
  );
}

export function assessInvestmentRisks({
  revenueProjection,
  financialPerformance,
  comparableAnalysis,
  market,
  policy = DEFAULT_INVESTMENT_RISK_POLICY,
}: AssessInvestmentRisksInput): AssessInvestmentRisksResult {
  const risks: InvestmentRisk[] = [];

  if (
    financialPerformance
      .annualCashFlow.amount < 0
  ) {
    risks.push({
      id: "negative-annual-cash-flow",
      title: "Negative annual cash flow",
      description:
        "Projected operating performance does not cover operating expenses and annual debt service.",
      severity: RiskSeverity.Critical,
      probability: {
        value: 90,
      },
      estimatedFinancialImpact: {
        amount: Math.abs(
          financialPerformance
            .annualCashFlow.amount,
        ),
        currency: "USD",
      },
      mitigation:
        "Reduce the acquisition price, improve the operating plan, increase revenue assumptions only with supporting evidence, or change the financing structure.",
    });
  }

  if (
    financialPerformance
      .debtServiceCoverageRatio <
    policy.minimumDebtServiceCoverageRatio
  ) {
    risks.push({
      id: "insufficient-debt-service-coverage",
      title: "Insufficient debt-service coverage",
      description:
        "Projected net operating income does not fully cover annual mortgage debt service.",
      severity: RiskSeverity.Critical,
      probability: {
        value: 85,
      },
      mitigation:
        "Reduce debt service, increase the down payment, negotiate a lower purchase price, or improve verified operating income.",
    });
  } else if (
    financialPerformance
      .debtServiceCoverageRatio <
    policy.warningDebtServiceCoverageRatio
  ) {
    risks.push({
      id: "limited-debt-service-buffer",
      title: "Limited debt-service buffer",
      description:
        "Projected debt-service coverage leaves limited room for operating underperformance.",
      severity: RiskSeverity.High,
      probability: {
        value: 70,
      },
      mitigation:
        "Model a more conservative financing structure and maintain a larger operating reserve.",
    });
  }

  const breakEvenOccupancy =
    financialPerformance
      .breakEvenOccupancy.value;

  if (
    breakEvenOccupancy >=
    policy.criticalBreakEvenOccupancy
  ) {
    risks.push({
      id: "critical-break-even-occupancy",
      title: "Critical break-even occupancy",
      description:
        "The property requires an exceptionally high occupancy level to cover projected operating costs and debt service.",
      severity: RiskSeverity.Critical,
      probability: {
        value: 80,
      },
      mitigation:
        "Lower fixed costs, reduce debt service, negotiate the purchase price, or adopt a materially stronger operating plan supported by comparable evidence.",
    });
  } else if (
    breakEvenOccupancy >=
    policy.highBreakEvenOccupancy
  ) {
    risks.push({
      id: "high-break-even-occupancy",
      title: "High break-even occupancy",
      description:
        "The property has a narrow operating margin and may become cash-flow negative during softer demand periods.",
      severity: RiskSeverity.High,
      probability: {
        value: 70,
      },
      mitigation:
        "Reduce fixed expenses and test the investment against lower-occupancy scenarios.",
    });
  } else if (
    breakEvenOccupancy >=
    policy.warningBreakEvenOccupancy
  ) {
    risks.push({
      id: "elevated-break-even-occupancy",
      title: "Elevated break-even occupancy",
      description:
        "The projected break-even point leaves a limited cushion below expected occupancy.",
      severity: RiskSeverity.Medium,
      probability: {
        value: 55,
      },
      mitigation:
        "Maintain sufficient reserves and validate occupancy assumptions against seasonal comparable data.",
    });
  }

  if (
    financialPerformance.capRate.value <
    policy.minimumCapRate
  ) {
    risks.push({
      id: "low-cap-rate",
      title: "Low projected cap rate",
      description:
        "Projected net operating income is low relative to the acquisition price.",
      severity: RiskSeverity.Medium,
      probability: {
        value: 65,
      },
      mitigation:
        "Negotiate a lower acquisition price or identify verified opportunities to increase net operating income.",
    });
  }

  if (
    comparableAnalysis.confidence ===
      ConfidenceLevel.Low ||
    comparableAnalysis.confidence ===
      ConfidenceLevel.VeryLow
  ) {
    risks.push({
      id: "limited-comparable-confidence",
      title: "Limited comparable confidence",
      description:
        "The comparable-property dataset may be too limited to support a high-confidence acquisition decision.",
      severity:
        comparableAnalysis.confidence ===
        ConfidenceLevel.VeryLow
          ? RiskSeverity.Medium
          : RiskSeverity.Low,
      probability: {
        value:
          comparableAnalysis.confidence ===
          ConfidenceLevel.VeryLow
            ? 75
            : 60,
      },
      mitigation:
        "Expand the comparable set and validate performance with additional market or historical reservation data.",
    });
  }

  const adrPremiumPercentage =
    calculateAdrPremiumPercentage(
      revenueProjection.projectedAdr.amount,
      comparableAnalysis
        .medianAverageDailyRate.amount,
    );

  if (
    adrPremiumPercentage >
    policy.maximumAdrPremiumPercentage
  ) {
    risks.push({
      id: "aggressive-adr-assumption",
      title: "Aggressive ADR assumption",
      description:
        "Projected ADR materially exceeds the comparable-property median and may depend on unverified positioning or amenity advantages.",
      severity: RiskSeverity.Medium,
      probability: {
        value: 65,
      },
      estimatedFinancialImpact: {
        amount: Math.round(
          revenueProjection
            .projectedAnnualRevenue.amount *
            0.1 *
            100,
        ) / 100,
        currency: "USD",
      },
      mitigation:
        "Document the specific property advantages supporting the premium and test the investment using comparable-median ADR.",
    });
  }

  const occupancyPremiumPoints =
    revenueProjection
      .projectedOccupancy.value -
    comparableAnalysis
      .medianOccupancy.value;

  if (
    occupancyPremiumPoints >
    policy.maximumOccupancyPremiumPoints
  ) {
    risks.push({
      id: "aggressive-occupancy-assumption",
      title: "Aggressive occupancy assumption",
      description:
        "Projected occupancy materially exceeds the comparable-property median.",
      severity: RiskSeverity.Medium,
      probability: {
        value: 60,
      },
      mitigation:
        "Validate the occupancy premium using booking pace, seasonality, property quality, and distribution assumptions.",
    });
  }

  if (
    market.trend === MarketTrend.Declining
  ) {
    risks.push({
      id: "declining-market-demand",
      title: "Declining market conditions",
      description:
        "The market snapshot indicates weakening demand or performance conditions.",
      severity: RiskSeverity.High,
      probability: {
        value: 70,
      },
      mitigation:
        "Use conservative revenue assumptions, evaluate supply growth, and require a larger margin of safety before acquisition.",
    });
  }

  return {
    risks,
    riskExposure:
      calculateRiskExposure(risks),
  };
}
