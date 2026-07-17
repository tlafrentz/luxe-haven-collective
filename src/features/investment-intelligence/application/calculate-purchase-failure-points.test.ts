import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  PurchaseInvestmentAnalysis,
} from "../domain";

import {
  calculatePurchaseFailurePoints,
} from "./calculate-purchase-failure-points";

const analysis = {
  property: {
    purchasePrice: {
      amount: 400000,
      currency: "USD",
    },
  },
  assumptions: {
    downPayment: { value: 20 },
    interestRate: { value: 6.5 },
    loanTermYears: 30,
  },
  revenueProjection: {
    projectedAdr: {
      amount: 200,
      currency: "USD",
    },
    projectedOccupancy: {
      value: 75,
    },
    projectedAnnualRevenue: {
      amount: 54750,
      currency: "USD",
    },
  },
  expenseProjection: {
    mortgage: {
      amount: 18000,
      currency: "USD",
    },
    totalOperatingExpenses: {
      amount: 25000,
      currency: "USD",
    },
  },
  financialPerformance: {
    annualCashFlow: {
      amount: 11750,
      currency: "USD",
    },
  },
} as PurchaseInvestmentAnalysis;

describe(
  "calculatePurchaseFailurePoints",
  () => {
    it("calculates sustainable ADR and occupancy thresholds", () => {
      const result =
        calculatePurchaseFailurePoints(
          analysis,
        );

      expect(
        result.minimumSustainableAdr.amount,
      ).toBe(157.08);

      expect(
        result.minimumSustainableOccupancy
          .value,
      ).toBe(58.9);

      expect(
        result.occupancySafetyMargin.value,
      ).toBe(16.1);
    });

    it("calculates expense and debt-service capacity", () => {
      const result =
        calculatePurchaseFailurePoints(
          analysis,
        );

      expect(
        result.operatingExpenseCapacity
          .amount,
      ).toBe(11750);

      expect(
        result.debtServiceCapacity.amount,
      ).toBe(11750);
    });

    it("calculates the maximum supported purchase price using current financing", () => {
      const result =
        calculatePurchaseFailurePoints(
          analysis,
        );
    expect(
  result.maximumSupportedLoanAmount
    .amount,
).toBe(392230.99);

expect(
  result
    .maximumSupportedPurchasePrice
    .amount,
).toBe(490288.74);

expect(
  result.purchasePriceSafetyMargin
    .amount,
).toBe(90288.74);  
    });

    it("classifies the fixture as strong", () => {
      const result =
        calculatePurchaseFailurePoints(
          analysis,
        );

      expect(
        result.resilienceStatus,
      ).toBe("strong");
    });
  },
);
