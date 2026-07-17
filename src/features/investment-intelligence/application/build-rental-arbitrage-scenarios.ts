import {
  AcquisitionRecommendation,
} from "../domain";

import type {
  InvestmentScenario,
  InvestmentScenarioType,
  RentalArbitrageInvestmentAnalysis,
} from "../domain";

const AVAILABLE_NIGHTS = 365;

const SCENARIO_CONFIGURATIONS = [
  {
    type: "downside",
    label: "Downside",
    description:
      "ADR declines 10%, occupancy falls 10 points, and operating expenses increase 5%.",
    adrChangePercentage: -10,
    occupancyChangePoints: -10,
    operatingExpenseChangePercentage: 5,
  },
  {
    type: "base",
    label: "Base",
    description:
      "Current underwriting assumptions and projected operating plan.",
    adrChangePercentage: 0,
    occupancyChangePoints: 0,
    operatingExpenseChangePercentage: 0,
  },
  {
    type: "upside",
    label: "Upside",
    description:
      "ADR improves 10% and occupancy increases 5 points with current expenses.",
    adrChangePercentage: 10,
    occupancyChangePoints: 5,
    operatingExpenseChangePercentage: 0,
  },
] as const;

function roundCurrency(
  amount: number,
): number {
  return (
    Math.round(
      (amount + Number.EPSILON) * 100,
    ) / 100
  );
}

function roundRatio(
  value: number,
): number {
  return (
    Math.round(
      (value + Number.EPSILON) * 100,
    ) / 100
  );
}

function clampPercentage(
  value: number,
): number {
  return Math.max(
    0,
    Math.min(100, value),
  );
}

function usd(amount: number) {
  return {
    amount: roundCurrency(amount),
    currency: "USD" as const,
  };
}

function recommendationFromScenario({
  annualCashFlow,
  leaseCoverageRatio,
  cashOnCashReturn,
}: {
  readonly annualCashFlow: number;
  readonly leaseCoverageRatio: number;
  readonly cashOnCashReturn: number;
}): AcquisitionRecommendation {
  if (
    annualCashFlow <= 0 ||
    leaseCoverageRatio < 1
  ) {
    return AcquisitionRecommendation.Pass;
  }

  if (
    leaseCoverageRatio >= 1.35 &&
    cashOnCashReturn >= 20
  ) {
    return AcquisitionRecommendation.StrongBuy;
  }

  if (
    leaseCoverageRatio >= 1.2 &&
    cashOnCashReturn >= 12
  ) {
    return AcquisitionRecommendation.Buy;
  }

  if (
    leaseCoverageRatio >= 1.05 &&
    cashOnCashReturn > 0
  ) {
    return AcquisitionRecommendation.BuyWithConditions;
  }

  return AcquisitionRecommendation.Wait;
}

function buildScenario({
  analysis,
  type,
  label,
  description,
  adrChangePercentage,
  occupancyChangePoints,
  operatingExpenseChangePercentage,
  baseCashFlow,
}: {
  readonly analysis:
    RentalArbitrageInvestmentAnalysis;
  readonly type:
    InvestmentScenarioType;
  readonly label: string;
  readonly description: string;
  readonly adrChangePercentage: number;
  readonly occupancyChangePoints: number;
  readonly operatingExpenseChangePercentage: number;
  readonly baseCashFlow: number;
}): InvestmentScenario {
  const baseAdr =
    analysis.revenueProjection
      .projectedAdr.amount;

  const baseOccupancy =
    analysis.revenueProjection
      .projectedOccupancy.value;

  const projectedAdr =
    roundCurrency(
      baseAdr *
        (
          1 +
          adrChangePercentage /
            100
        ),
    );

  const projectedOccupancy =
    roundRatio(
      clampPercentage(
        baseOccupancy +
          occupancyChangePoints,
      ),
    );

  const projectedAnnualRevenue =
    roundCurrency(
      projectedAdr *
        AVAILABLE_NIGHTS *
        (
          projectedOccupancy /
          100
        ),
    );

  const baseOperatingExpenses =
    analysis.expenseProjection
      .totalOperatingExpenses.amount;

  const projectedOperatingExpenses =
    roundCurrency(
      baseOperatingExpenses *
        (
          1 +
          operatingExpenseChangePercentage /
            100
        ),
    );

  const annualLeaseExpense =
    analysis.expenseProjection
      .lease.amount;

  const totalAnnualExpenses =
    roundCurrency(
      annualLeaseExpense +
        projectedOperatingExpenses,
    );

  const annualCashFlow =
    roundCurrency(
      projectedAnnualRevenue -
        totalAnnualExpenses,
    );

  const initialCashInvested =
    analysis.financialPerformance
      .initialCashInvested.amount;

  const cashOnCashReturn =
    initialCashInvested === 0
      ? 0
      : roundRatio(
          (
            annualCashFlow /
            initialCashInvested
          ) * 100,
        );

  const leaseCoverageRatio =
    annualLeaseExpense === 0
      ? 0
      : roundRatio(
          (
            projectedAnnualRevenue -
            projectedOperatingExpenses
          ) /
            annualLeaseExpense,
        );

  const potentialGrossRevenue =
    projectedAdr *
    AVAILABLE_NIGHTS;

  const breakEvenOccupancy =
    potentialGrossRevenue === 0
      ? 0
      : roundRatio(
          (
            totalAnnualExpenses /
            potentialGrossRevenue
          ) * 100,
        );

  return {
    type,
    label,
    description,
    assumptions: {
      adrChangePercentage,
      occupancyChangePoints,
      operatingExpenseChangePercentage,
    },
    projectedAdr:
      usd(projectedAdr),
    projectedOccupancy: {
      value:
        projectedOccupancy,
    },
    projectedAnnualRevenue:
      usd(projectedAnnualRevenue),
    totalAnnualExpenses:
      usd(totalAnnualExpenses),
    annualCashFlow:
      usd(annualCashFlow),
    cashFlowChangeFromBase:
      usd(
        annualCashFlow -
          baseCashFlow,
      ),
    cashOnCashReturn: {
      value:
        cashOnCashReturn,
    },
    leaseCoverageRatio,
    breakEvenOccupancy: {
      value:
        breakEvenOccupancy,
    },
    recommendation:
      recommendationFromScenario({
        annualCashFlow,
        leaseCoverageRatio,
        cashOnCashReturn,
      }),
  };
}

export function buildRentalArbitrageScenarios(
  analysis:
    RentalArbitrageInvestmentAnalysis,
): readonly InvestmentScenario[] {
  const baseCashFlow =
    analysis.financialPerformance
      .annualCashFlow.amount;

  return SCENARIO_CONFIGURATIONS.map(
    (configuration) =>
      buildScenario({
        analysis,
        ...configuration,
        baseCashFlow,
      }),
  );
}
