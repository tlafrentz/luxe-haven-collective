import type {
  Money,
  Percentage,
  RentalArbitrageExpenseProjection,
  RentalArbitrageFinancialPerformance,
  RevenueProjection,
} from "../domain";

import {
  assertFiniteNonNegative,
  assertMoney,
  assertPercentage,
  roundCurrency,
} from "../application/calculation-guards";

export type CalculateRentalArbitrageFinancialPerformanceInput = {
  readonly revenueProjection: RevenueProjection;

  readonly monthlyLease: Money;
  readonly securityDeposit: Money;
  readonly furnishingBudget: Money;
  readonly startupCosts: Money;

  readonly cleaning: Money;
  readonly utilities: Money;
  readonly insurance: Money;
  readonly management: Money;
  readonly maintenance: Money;
  readonly software: Money;
  readonly supplies: Money;
  readonly capitalReserve: Money;

  readonly confidence: Percentage;
  readonly availableNights?: number;
};

export type RentalArbitrageUnderwritingResult = {
  readonly expenseProjection:
    RentalArbitrageExpenseProjection;

  readonly financialPerformance:
    RentalArbitrageFinancialPerformance;
};

const OPERATING_EXPENSE_FIELDS = [
  "cleaning",
  "utilities",
  "insurance",
  "management",
  "maintenance",
  "software",
  "supplies",
  "capitalReserve",
] as const;

function roundRatio(
  value: number,
): number {
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

function formatFieldName(
  field: string,
): string {
  return field
    .replace(
      /([A-Z])/g,
      " $1",
    )
    .replace(/^./, (character) =>
      character.toUpperCase(),
    );
}

export function calculateRentalArbitrageFinancialPerformance(
  input: CalculateRentalArbitrageFinancialPerformanceInput,
): RentalArbitrageUnderwritingResult {
  assertMoney(
    input.revenueProjection
      .projectedAnnualRevenue,
    "Projected annual revenue",
  );

  assertMoney(
    input.revenueProjection.projectedAdr,
    "Projected ADR",
  );

  assertMoney(
    input.monthlyLease,
    "Monthly lease",
  );

  assertMoney(
    input.securityDeposit,
    "Security deposit",
  );

  assertMoney(
    input.furnishingBudget,
    "Furnishing budget",
  );

  assertMoney(
    input.startupCosts,
    "Startup costs",
  );

  for (
    const field of
    OPERATING_EXPENSE_FIELDS
  ) {
    assertMoney(
      input[field],
      formatFieldName(field),
    );
  }

  assertPercentage(
    input.confidence,
    "Confidence",
  );

  const availableNights =
    input.availableNights ?? 365;

  assertFiniteNonNegative(
    availableNights,
    "Available nights",
  );

  if (!Number.isInteger(availableNights)) {
    throw new Error(
      "Available nights must be a whole number.",
    );
  }

  const annualGrossRevenue =
    input.revenueProjection
      .projectedAnnualRevenue.amount;

  const annualLeaseExpense =
    roundCurrency(
      input.monthlyLease.amount * 12,
    );

  const annualOperatingExpenses =
    roundCurrency(
      OPERATING_EXPENSE_FIELDS.reduce(
        (total, field) =>
          total + input[field].amount,
        0,
      ),
    );

  const totalAnnualExpenses =
    roundCurrency(
      annualLeaseExpense +
        annualOperatingExpenses,
    );

  const annualCashFlow =
    roundCurrency(
      annualGrossRevenue -
        totalAnnualExpenses,
    );

  const monthlyOperatingMargin =
    roundCurrency(
      annualCashFlow / 12,
    );

  const initialCashInvested =
    roundCurrency(
      input.securityDeposit.amount +
        input.furnishingBudget.amount +
        input.startupCosts.amount,
    );

  const cashOnCashReturn =
    calculatePercentage(
      annualCashFlow,
      initialCashInvested,
      "Cash-on-cash return",
    );

  const incomeAvailableForLease =
    annualGrossRevenue -
    annualOperatingExpenses;

  const leaseCoverageRatio =
    annualLeaseExpense === 0
      ? 0
      : roundRatio(
          incomeAvailableForLease /
            annualLeaseExpense,
        );

  const potentialGrossRevenue =
    input.revenueProjection
      .projectedAdr.amount *
    availableNights;

  const breakEvenOccupancy =
    calculatePercentage(
      totalAnnualExpenses,
      potentialGrossRevenue,
      "Break-even occupancy",
    );

  return {
    expenseProjection: {
      lease: {
        amount:
          annualLeaseExpense,
        currency: "USD",
      },
      cleaning: input.cleaning,
      utilities: input.utilities,
      insurance: input.insurance,
      management: input.management,
      maintenance: input.maintenance,
      software: input.software,
      supplies: input.supplies,
      capitalReserve:
        input.capitalReserve,
      totalOperatingExpenses: {
        amount:
          annualOperatingExpenses,
        currency: "USD",
      },
      totalAnnualExpenses: {
        amount:
          totalAnnualExpenses,
        currency: "USD",
      },
      confidence:
        input.confidence,
    },
    financialPerformance: {
      annualGrossRevenue: {
        amount:
          annualGrossRevenue,
        currency: "USD",
      },
      annualLeaseExpense: {
        amount:
          annualLeaseExpense,
        currency: "USD",
      },
      annualOperatingExpenses: {
        amount:
          annualOperatingExpenses,
        currency: "USD",
      },
      totalAnnualExpenses: {
        amount:
          totalAnnualExpenses,
        currency: "USD",
      },
      annualCashFlow: {
        amount:
          annualCashFlow,
        currency: "USD",
      },
      monthlyOperatingMargin: {
        amount:
          monthlyOperatingMargin,
        currency: "USD",
      },
      initialCashInvested: {
        amount:
          initialCashInvested,
        currency: "USD",
      },
      cashOnCashReturn: {
        value:
          cashOnCashReturn,
      },
      leaseCoverageRatio,
      breakEvenOccupancy: {
        value:
          breakEvenOccupancy,
      },
    },
  };
}
