import type {
  PurchaseInvestmentAnalysis,
  PurchaseScenario,
} from "../domain";

const AVAILABLE_NIGHTS = 365;

const SCENARIOS = [
  {
    type: "downside" as const,
    label: "Downside",
    adrChangePercentage: -10,
    occupancyChangePoints: -10,
    operatingExpenseChangePercentage: 5,
  },
  {
    type: "base" as const,
    label: "Base",
    adrChangePercentage: 0,
    occupancyChangePoints: 0,
    operatingExpenseChangePercentage: 0,
  },
  {
    type: "upside" as const,
    label: "Upside",
    adrChangePercentage: 10,
    occupancyChangePoints: 5,
    operatingExpenseChangePercentage: 0,
  },
] as const;

function round(value: number): number {
  return Math.round(
    (value + Number.EPSILON) * 100,
  ) / 100;
}

function usd(amount: number) {
  return {
    amount: round(amount),
    currency: "USD" as const,
  };
}

function percentage(value: number) {
  return { value: round(value) };
}

function safePercentage(
  numerator: number,
  denominator: number,
): number {
  return denominator === 0
    ? 0
    : (numerator / denominator) * 100;
}

export function buildPurchaseScenarios(
  analysis: PurchaseInvestmentAnalysis,
): readonly PurchaseScenario[] {
  const baseAdr =
    analysis.revenueProjection.projectedAdr.amount;
  const baseOccupancy =
    analysis.revenueProjection.projectedOccupancy.value;
  const baseOperatingExpenses =
    analysis.expenseProjection.totalOperatingExpenses.amount;
  const annualDebtService =
    analysis.expenseProjection.mortgage.amount;
  const purchasePrice =
    analysis.property.purchasePrice.amount;
  const cashInvested =
    purchasePrice *
      (analysis.assumptions.downPayment.value / 100) +
    analysis.property.closingCosts.amount +
    analysis.property.furnishingBudget.amount;
  const baseCashFlow =
    analysis.financialPerformance.annualCashFlow.amount;

  return SCENARIOS.map((scenario) => {
    const projectedAdr =
      baseAdr *
      (1 + scenario.adrChangePercentage / 100);
    const projectedOccupancy =
      Math.min(
        100,
        Math.max(
          0,
          baseOccupancy +
            scenario.occupancyChangePoints,
        ),
      );
    const annualRevenue =
      projectedAdr *
      AVAILABLE_NIGHTS *
      (projectedOccupancy / 100);
    const annualOperatingExpenses =
      baseOperatingExpenses *
      (
        1 +
        scenario.operatingExpenseChangePercentage /
          100
      );
    const netOperatingIncome =
      annualRevenue -
      annualOperatingExpenses;
    const annualCashFlow =
      netOperatingIncome -
      annualDebtService;
    const potentialGrossRevenue =
      projectedAdr * AVAILABLE_NIGHTS;

    return {
      type: scenario.type,
      label: scenario.label,
      assumptions: {
        adrChangePercentage:
          scenario.adrChangePercentage,
        occupancyChangePoints:
          scenario.occupancyChangePoints,
        operatingExpenseChangePercentage:
          scenario.operatingExpenseChangePercentage,
      },
      projectedAdr: usd(projectedAdr),
      projectedOccupancy:
        percentage(projectedOccupancy),
      annualRevenue: usd(annualRevenue),
      annualOperatingExpenses:
        usd(annualOperatingExpenses),
      netOperatingIncome:
        usd(netOperatingIncome),
      annualDebtService:
        usd(annualDebtService),
      annualCashFlow:
        usd(annualCashFlow),
      cashFlowChangeFromBase:
        usd(annualCashFlow - baseCashFlow),
      capRate:
        percentage(
          safePercentage(
            netOperatingIncome,
            purchasePrice,
          ),
        ),
      cashOnCashReturn:
        percentage(
          safePercentage(
            annualCashFlow,
            cashInvested,
          ),
        ),
      debtServiceCoverageRatio:
        annualDebtService === 0
          ? 0
          : round(
              netOperatingIncome /
                annualDebtService,
            ),
      breakEvenOccupancy:
        percentage(
          safePercentage(
            annualOperatingExpenses +
              annualDebtService,
            potentialGrossRevenue,
          ),
        ),
    };
  });
}
