import type {
  ExpenseProjection,
  FinancialPerformance,
  Money,
  RevenueProjection,
} from "../domain";

import {
  assertFiniteNonNegative,
  assertMoney,
  roundCurrency,
} from "./calculation-guards";

export type CalculateFinancialPerformanceInput = {
  revenueProjection: RevenueProjection;
  expenseProjection: ExpenseProjection;
  purchasePrice: Money;
  cashInvested: Money;
  availableNights?: number;
};

function roundRatio(value: number): number {
  return (
    Math.round(
      (value + Number.EPSILON) * 100,
    ) / 100
  );
}

function calculatePercentage(
  numerator: number,
  denominator: number,
  fieldName: string,
): number {
  if (denominator === 0) {
    throw new Error(
      `${fieldName} cannot be calculated with a zero denominator.`,
    );
  }

  return roundRatio(
    (numerator / denominator) * 100,
  );
}

export function calculateFinancialPerformance({
  revenueProjection,
  expenseProjection,
  purchasePrice,
  cashInvested,
  availableNights = 365,
}: CalculateFinancialPerformanceInput): FinancialPerformance {
  assertMoney(
    revenueProjection.projectedAnnualRevenue,
    "Projected annual revenue",
  );

  assertMoney(
    revenueProjection.projectedAdr,
    "Projected ADR",
  );

  assertMoney(
    expenseProjection.totalOperatingExpenses,
    "Total operating expenses",
  );

  assertMoney(
    expenseProjection.mortgage,
    "Mortgage",
  );

  assertMoney(
    purchasePrice,
    "Purchase price",
  );

  assertMoney(
    cashInvested,
    "Cash invested",
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

  const annualRevenue =
    revenueProjection.projectedAnnualRevenue.amount;

  const operatingExpenses =
    expenseProjection.totalOperatingExpenses.amount;

  const annualDebtService =
    expenseProjection.mortgage.amount;

  const netOperatingIncome =
    roundCurrency(
      annualRevenue - operatingExpenses,
    );

  const annualCashFlow =
    roundCurrency(
      netOperatingIncome - annualDebtService,
    );

  const capRate =
    calculatePercentage(
      netOperatingIncome,
      purchasePrice.amount,
      "Cap rate",
    );

  const cashOnCashReturn =
    calculatePercentage(
      annualCashFlow,
      cashInvested.amount,
      "Cash-on-cash return",
    );

  const debtServiceCoverageRatio =
    annualDebtService === 0
      ? 0
      : roundRatio(
          netOperatingIncome /
            annualDebtService,
        );

  const potentialGrossRevenue =
    revenueProjection.projectedAdr.amount *
    availableNights;

  const breakEvenOccupancy =
    calculatePercentage(
      operatingExpenses +
        annualDebtService,
      potentialGrossRevenue,
      "Break-even occupancy",
    );

  return {
    netOperatingIncome: {
      amount: netOperatingIncome,
      currency: "USD",
    },
    annualCashFlow: {
      amount: annualCashFlow,
      currency: "USD",
    },
    capRate: {
      value: capRate,
    },
    cashOnCashReturn: {
      value: cashOnCashReturn,
    },
    debtServiceCoverageRatio,
    breakEvenOccupancy: {
      value: breakEvenOccupancy,
    },
  };
}
