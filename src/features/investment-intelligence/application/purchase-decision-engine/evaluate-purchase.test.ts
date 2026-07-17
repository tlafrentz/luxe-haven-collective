import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  PurchaseInvestmentAnalysis,
} from "../../domain";

import {
  evaluatePurchase,
} from "./evaluate-purchase";

function usd(amount: number) {
  return {
    amount,
    currency: "USD" as const,
  };
}

const analysis = {
  property: {
    purchasePrice: usd(400000),
    closingCosts: usd(12000),
    furnishingBudget: usd(18000),
  },
  assumptions: {
    downPayment: { value: 20 },
    interestRate: { value: 6.5 },
    loanTermYears: 30,
  },
  revenueProjection: {
    projectedAdr: usd(200),
    projectedOccupancy: { value: 75 },
    projectedMonthlyRevenue: usd(4562.5),
    projectedAnnualRevenue: usd(54750),
    confidence: { value: 85 },
  },
  expenseProjection: {
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
    confidence: { value: 80 },
  },
  financialPerformance: {
    netOperatingIncome: usd(29750),
    annualCashFlow: usd(11750),
    capRate: { value: 7.44 },
    cashOnCashReturn: { value: 11.75 },
    debtServiceCoverageRatio: 1.65,
    breakEvenOccupancy: { value: 58.9 },
  },
} as PurchaseInvestmentAnalysis;

describe("evaluatePurchase", () => {
  it("produces one complete explainable purchase decision", () => {
    const result =
      evaluatePurchase(analysis);

    expect(result.scenarios).toHaveLength(3);
    expect(result.evidence.length)
      .toBeGreaterThan(0);
    expect(result.opportunities.length)
      .toBeGreaterThan(0);
    expect(result.confidence.score)
      .toBeGreaterThan(0);
    expect(result.thesis.headline)
      .toContain("Positive economics");
    expect(
      result.recommendation
        .recommendation,
    ).toBe("buy-with-conditions");
  });

  it("passes a purchase with negative base cash flow", () => {
    const result = evaluatePurchase({
      ...analysis,
      financialPerformance: {
        ...analysis.financialPerformance,
        annualCashFlow: usd(-5000),
        debtServiceCoverageRatio: 0.8,
      },
      revenueProjection: {
        ...analysis.revenueProjection,
        projectedAnnualRevenue:
          usd(38000),
      },
    });

    expect(
      result.recommendation
        .recommendation,
    ).toBe("pass");
  });

  it("keeps recommendation inputs visible in the report", () => {
    const result =
      evaluatePurchase(analysis);

    expect(result.failurePoints)
      .toBeDefined();
    expect(
      result.confidence.factors,
    ).toHaveLength(4);
    expect(
      result.recommendation.nextActions,
    ).toHaveLength(4);
  });
});
