import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  PurchaseInvestmentAnalysis,
} from "../domain";

import {
  buildPurchaseScenarios,
} from "./build-purchase-scenarios";

const analysis = {
  property: {
    purchasePrice: {
      amount: 400000,
      currency: "USD",
    },
    closingCosts: {
      amount: 12000,
      currency: "USD",
    },
    furnishingBudget: {
      amount: 18000,
      currency: "USD",
    },
  },
  assumptions: {
    downPayment: { value: 20 },
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

describe("buildPurchaseScenarios", () => {
  it("builds downside, base, and upside scenarios", () => {
    const result =
      buildPurchaseScenarios(analysis);

    expect(result.map(({ type }) => type))
      .toEqual([
        "downside",
        "base",
        "upside",
      ]);
  });

  it("preserves the current underwriting in the base scenario", () => {
    const base = buildPurchaseScenarios(
      analysis,
    )[1];

    expect(base.annualRevenue.amount)
      .toBe(54750);
    expect(base.netOperatingIncome.amount)
      .toBe(29750);
    expect(base.annualCashFlow.amount)
      .toBe(11750);
    expect(base.capRate.value)
      .toBe(7.44);
    expect(base.cashOnCashReturn.value)
      .toBe(10.68);
    expect(
      base.debtServiceCoverageRatio,
    ).toBe(1.65);
  });

  it("recalculates the downside scenario", () => {
    const downside =
      buildPurchaseScenarios(
        analysis,
      )[0];

    expect(downside.projectedAdr.amount)
      .toBe(180);
    expect(
      downside.projectedOccupancy.value,
    ).toBe(65);
    expect(downside.annualRevenue.amount)
      .toBe(42705);
    expect(downside.annualCashFlow.amount)
      .toBe(-1545);
  });
});
