import {
  RiskSeverity,
} from "../domain";

import type {
  InvestmentRisk,
  MarketSnapshot,
  RentalArbitrageFinancialPerformance,
  RentalArbitrageAssumptions,
} from "../domain";

function usd(amount: number) {
  return {
    amount:
      Math.round(
        (amount + Number.EPSILON) * 100,
      ) / 100,
    currency: "USD" as const,
  };
}

function probability(value: number) {
  return {
    value:
      Math.max(
        0,
        Math.min(100, value),
      ),
  };
}

export type RentalArbitrageRiskAssessment = {
  readonly risks: readonly InvestmentRisk[];
  readonly riskExposure: number;
};

export function assessRentalArbitrageRisks({
  assumptions,
  financialPerformance,
  market,
}: {
  readonly assumptions:
    RentalArbitrageAssumptions;
  readonly financialPerformance:
    RentalArbitrageFinancialPerformance;
  readonly market: MarketSnapshot;
}): RentalArbitrageRiskAssessment {
  const risks: InvestmentRisk[] = [];

  if (
    financialPerformance
      .annualCashFlow.amount <= 0
  ) {
    risks.push({
      id: "negative-cash-flow",
      title:
        "Operating plan produces negative cash flow",
      description:
        "Projected revenue does not cover the lease commitment and annual operating expenses.",
      severity: RiskSeverity.Critical,
      probability: probability(90),
      estimatedFinancialImpact:
        usd(
          Math.abs(
            financialPerformance
              .annualCashFlow.amount,
          ),
        ),
      mitigation:
        "Renegotiate the lease, reduce operating costs, or reject the opportunity unless stronger revenue evidence is available.",
    });
  }

  if (
    financialPerformance
      .leaseCoverageRatio < 1
  ) {
    risks.push({
      id: "lease-not-covered",
      title:
        "Revenue does not support the lease",
      description:
        "Revenue remaining after operating expenses is insufficient to cover the annual lease expense.",
      severity: RiskSeverity.Critical,
      probability: probability(85),
      estimatedFinancialImpact:
        usd(
          Math.max(
            0,
            financialPerformance
              .annualLeaseExpense.amount -
              (
                financialPerformance
                  .annualGrossRevenue.amount -
                financialPerformance
                  .annualOperatingExpenses.amount
              ),
          ),
        ),
      mitigation:
        "Do not sign the lease without a lower rent, stronger documented demand, or a materially improved operating plan.",
    });
  } else if (
    financialPerformance
      .leaseCoverageRatio < 1.2
  ) {
    risks.push({
      id: "thin-lease-coverage",
      title:
        "Lease coverage has limited margin for error",
      description:
        "The operating plan covers the lease, but a modest revenue decline or expense increase could eliminate cash flow.",
      severity: RiskSeverity.High,
      probability: probability(65),
      mitigation:
        "Negotiate rent concessions, maintain additional working capital, and validate revenue assumptions before signing.",
    });
  } else if (
    financialPerformance
      .leaseCoverageRatio < 1.35
  ) {
    risks.push({
      id: "moderate-lease-coverage",
      title:
        "Lease coverage requires active monitoring",
      description:
        "The lease is supportable, but performance should be monitored closely during ramp-up and seasonal demand shifts.",
      severity: RiskSeverity.Medium,
      probability: probability(45),
      mitigation:
        "Use conservative launch pricing, track weekly booking pace, and preserve a lease reserve.",
    });
  }

  if (
    financialPerformance
      .breakEvenOccupancy.value >
    market.medianOccupancy.value
  ) {
    risks.push({
      id: "break-even-above-market",
      title:
        "Break-even occupancy exceeds the market median",
      description:
        "The property must outperform the market's typical occupancy level before the operating plan reaches break-even.",
      severity:
        financialPerformance
          .breakEvenOccupancy.value -
          market.medianOccupancy.value >=
        10
          ? RiskSeverity.High
          : RiskSeverity.Medium,
      probability: probability(60),
      mitigation:
        "Reduce fixed costs or require stronger comparable evidence that the property can outperform market occupancy.",
    });
  }

  if (
    financialPerformance
      .cashOnCashReturn.value < 10
  ) {
    risks.push({
      id: "low-cash-on-cash",
      title:
        "Startup capital earns a weak return",
      description:
        "Projected cash-on-cash return does not adequately compensate for lease exposure and operating execution risk.",
      severity:
        financialPerformance
          .cashOnCashReturn.value <= 0
          ? RiskSeverity.High
          : RiskSeverity.Medium,
      probability: probability(55),
      mitigation:
        "Lower furnishing and startup costs, negotiate lease concessions, or target a higher-margin opportunity.",
    });
  }

  if (
    assumptions.leaseTermMonths > 12
  ) {
    risks.push({
      id: "extended-lease-commitment",
      title:
        "Long lease term increases fixed exposure",
      description:
        "The operator remains committed to the lease beyond a standard twelve-month validation period.",
      severity: RiskSeverity.Medium,
      probability: probability(40),
      estimatedFinancialImpact:
        usd(
          assumptions
            .monthlyLease.amount *
            assumptions.leaseTermMonths,
        ),
      mitigation:
        "Seek an early termination clause, performance contingency, or shorter initial term.",
    });
  }

  const severityWeight = {
    [RiskSeverity.Critical]: 35,
    [RiskSeverity.High]: 22,
    [RiskSeverity.Medium]: 12,
    [RiskSeverity.Low]: 5,
  };

  const riskExposure =
    Math.max(
      0,
      Math.min(
        100,
        Math.round(
          risks.reduce(
            (total, risk) =>
              total +
              severityWeight[
                risk.severity
              ] *
                (
                  risk.probability
                    .value /
                  100
                ),
            0,
          ),
        ),
      ),
    );

  return {
    risks,
    riskExposure,
  };
}
