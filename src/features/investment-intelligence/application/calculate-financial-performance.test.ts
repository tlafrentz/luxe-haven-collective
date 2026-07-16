import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  ExpenseProjection,
  RevenueProjection,
} from "../domain";

import {
  calculateFinancialPerformance,
} from "./calculate-financial-performance";

function usd(amount: number) {
  return {
    amount,
    currency: "USD" as const,
  };
}

function createRevenueProjection(
  overrides: Partial<RevenueProjection> = {},
): RevenueProjection {
  return {
    projectedAdr: usd(200),
    projectedOccupancy: {
      value: 75,
    },
    projectedMonthlyRevenue: usd(4562.5),
    projectedAnnualRevenue: usd(54750),
    confidence: {
      value: 85,
    },
    ...overrides,
  };
}

function createExpenseProjection(
  overrides: Partial<ExpenseProjection> = {},
): ExpenseProjection {
  return {
    mortgage: usd(18000),
    cleaning: usd(6000),
    utilities: usd(3000),
    insurance: usd(1500),
    taxes: usd(3500),
    management: usd(5000),
    maintenance: usd(2000),
    software: usd(500),
    supplies: usd(1000),
    capitalReserve: usd(2500),
    totalOperatingExpenses: usd(25000),
    confidence: {
      value: 80,
    },
    ...overrides,
  };
}

describe("calculateFinancialPerformance", () => {
  it("calculates core investment performance metrics", () => {
    const result =
      calculateFinancialPerformance({
        revenueProjection:
          createRevenueProjection(),
        expenseProjection:
          createExpenseProjection(),
        purchasePrice: usd(400000),
        cashInvested: usd(100000),
      });

    expect(result).toEqual({
      netOperatingIncome: usd(29750),
      annualCashFlow: usd(11750),
      capRate: {
        value: 7.44,
      },
      cashOnCashReturn: {
        value: 11.75,
      },
      debtServiceCoverageRatio: 1.65,
      breakEvenOccupancy: {
        value: 58.9,
      },
    });
  });

  it("excludes mortgage debt service from NOI", () => {
    const result =
      calculateFinancialPerformance({
        revenueProjection:
          createRevenueProjection(),
        expenseProjection:
          createExpenseProjection({
            mortgage: usd(24000),
          }),
        purchasePrice: usd(400000),
        cashInvested: usd(100000),
      });

    expect(
      result.netOperatingIncome.amount,
    ).toBe(29750);

    expect(
      result.annualCashFlow.amount,
    ).toBe(5750);
  });

  it("returns a zero DSCR for a debt-free acquisition", () => {
    const result =
      calculateFinancialPerformance({
        revenueProjection:
          createRevenueProjection(),
        expenseProjection:
          createExpenseProjection({
            mortgage: usd(0),
          }),
        purchasePrice: usd(400000),
        cashInvested: usd(400000),
      });

    expect(
      result.debtServiceCoverageRatio,
    ).toBe(0);

    expect(
      result.annualCashFlow.amount,
    ).toBe(29750);
  });

  it("supports negative cash flow and cash-on-cash return", () => {
    const result =
      calculateFinancialPerformance({
        revenueProjection:
          createRevenueProjection({
            projectedAnnualRevenue:
              usd(30000),
          }),
        expenseProjection:
          createExpenseProjection({
            mortgage: usd(20000),
            totalOperatingExpenses:
              usd(25000),
          }),
        purchasePrice: usd(400000),
        cashInvested: usd(100000),
      });

    expect(
      result.netOperatingIncome.amount,
    ).toBe(5000);

    expect(
      result.annualCashFlow.amount,
    ).toBe(-15000);

    expect(
      result.cashOnCashReturn.value,
    ).toBe(-15);
  });

  it("rejects a zero purchase price", () => {
    expect(() =>
      calculateFinancialPerformance({
        revenueProjection:
          createRevenueProjection(),
        expenseProjection:
          createExpenseProjection(),
        purchasePrice: usd(0),
        cashInvested: usd(100000),
      }),
    ).toThrow(
      "Cap rate cannot be calculated with a zero denominator.",
    );
  });

  it("rejects zero cash invested", () => {
    expect(() =>
      calculateFinancialPerformance({
        revenueProjection:
          createRevenueProjection(),
        expenseProjection:
          createExpenseProjection(),
        purchasePrice: usd(400000),
        cashInvested: usd(0),
      }),
    ).toThrow(
      "Cash-on-cash return cannot be calculated with a zero denominator.",
    );
  });

  it("rejects zero potential gross revenue", () => {
    expect(() =>
      calculateFinancialPerformance({
        revenueProjection:
          createRevenueProjection({
            projectedAdr: usd(0),
          }),
        expenseProjection:
          createExpenseProjection(),
        purchasePrice: usd(400000),
        cashInvested: usd(100000),
      }),
    ).toThrow(
      "Break-even occupancy cannot be calculated with a zero denominator.",
    );
  });
});
