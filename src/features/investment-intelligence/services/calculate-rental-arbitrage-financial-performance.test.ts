import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  RevenueProjection,
} from "../domain";

import {
  calculateRentalArbitrageFinancialPerformance,
} from "./calculate-rental-arbitrage-financial-performance";

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
    projectedMonthlyRevenue:
      usd(4562.5),
    projectedAnnualRevenue:
      usd(54750),
    confidence: {
      value: 85,
    },
    ...overrides,
  };
}

function createInput() {
  return {
    revenueProjection:
      createRevenueProjection(),

    monthlyLease: usd(2000),
    securityDeposit: usd(2000),
    furnishingBudget: usd(15000),
    startupCosts: usd(3000),

    cleaning: usd(6000),
    utilities: usd(3000),
    insurance: usd(1200),
    management: usd(5000),
    maintenance: usd(1500),
    software: usd(600),
    supplies: usd(1200),
    capitalReserve: usd(2000),

    confidence: {
      value: 80,
    },
  };
}

describe(
  "calculateRentalArbitrageFinancialPerformance",
  () => {
    it("calculates rental arbitrage performance without mortgage metrics", () => {
      const result =
        calculateRentalArbitrageFinancialPerformance(
          createInput(),
        );

      expect(
        result.expenseProjection,
      ).toEqual({
        lease: usd(24000),
        cleaning: usd(6000),
        utilities: usd(3000),
        insurance: usd(1200),
        management: usd(5000),
        maintenance: usd(1500),
        software: usd(600),
        supplies: usd(1200),
        capitalReserve:
          usd(2000),
        totalOperatingExpenses:
          usd(20500),
        totalAnnualExpenses:
          usd(44500),
        confidence: {
          value: 80,
        },
      });

      expect(
        result.financialPerformance,
      ).toEqual({
        annualGrossRevenue:
          usd(54750),
        annualLeaseExpense:
          usd(24000),
        annualOperatingExpenses:
          usd(20500),
        totalAnnualExpenses:
          usd(44500),
        annualCashFlow:
          usd(10250),
        monthlyOperatingMargin:
          usd(854.17),
        initialCashInvested:
          usd(20000),
        cashOnCashReturn: {
          value: 51.25,
        },
        leaseCoverageRatio: 1.43,
        breakEvenOccupancy: {
          value: 60.96,
        },
      });
    });

    it("supports negative operating cash flow", () => {
      const result =
        calculateRentalArbitrageFinancialPerformance({
          ...createInput(),
          revenueProjection:
            createRevenueProjection({
              projectedAnnualRevenue:
                usd(35000),
            }),
        });

      expect(
        result.financialPerformance
          .annualCashFlow.amount,
      ).toBe(-9500);

      expect(
        result.financialPerformance
          .cashOnCashReturn.value,
      ).toBe(-47.5);
    });

    it("does not treat the security deposit as an annual expense", () => {
      const result =
        calculateRentalArbitrageFinancialPerformance({
          ...createInput(),
          securityDeposit:
            usd(10000),
        });

      expect(
        result.expenseProjection
          .totalAnnualExpenses.amount,
      ).toBe(44500);

      expect(
        result.financialPerformance
          .initialCashInvested.amount,
      ).toBe(28000);
    });

    it("returns zero lease coverage for a rent-free lease", () => {
      const result =
        calculateRentalArbitrageFinancialPerformance({
          ...createInput(),
          monthlyLease: usd(0),
        });

      expect(
        result.financialPerformance
          .leaseCoverageRatio,
      ).toBe(0);
    });

    it("rejects zero initial cash invested", () => {
      expect(() =>
        calculateRentalArbitrageFinancialPerformance({
          ...createInput(),
          securityDeposit: usd(0),
          furnishingBudget:
            usd(0),
          startupCosts: usd(0),
        }),
      ).toThrow(
        "Cash-on-cash return cannot be calculated with a zero denominator.",
      );
    });

    it("rejects zero potential gross revenue", () => {
      expect(() =>
        calculateRentalArbitrageFinancialPerformance({
          ...createInput(),
          revenueProjection:
            createRevenueProjection({
              projectedAdr: usd(0),
            }),
        }),
      ).toThrow(
        "Break-even occupancy cannot be calculated with a zero denominator.",
      );
    });
  },
);
