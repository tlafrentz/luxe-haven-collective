import {
  describe,
  expect,
  it,
} from "vitest";

import {
  AcquisitionRecommendation,
  ConfidenceLevel,
  EvidenceDirection,
  MarketTrend,
  PropertyType,
} from "../domain";

import type {
  ComparableAnalysis,
  ExpenseProjection,
  FinancialPerformance,
  InvestmentAssumptions,
  MarketSnapshot,
  PropertyProfile,
  RevenueProjection,
} from "../domain";

import {
  buildInvestmentDecision,
} from "./build-investment-decision";

function usd(amount: number) {
  return {
    amount,
    currency: "USD" as const,
  };
}

function createPropertyProfile(
  overrides: Partial<PropertyProfile> = {},
): PropertyProfile {
  return {
    id: "property-1",
    location: {
      address1: "123 Main Street",
      city: "Mesa",
      state: "AZ",
      postalCode: "85201",
    },
    purchasePrice: usd(400000),
    closingCosts: usd(12000),
    furnishingBudget: usd(25000),
    propertyType:
      PropertyType.Apartment,
    bedrooms: 2,
    bathrooms: 1,
    squareFeet: 950,
    ...overrides,
  };
}

function createMarketSnapshot(
  overrides: Partial<MarketSnapshot> = {},
): MarketSnapshot {
  return {
    market: "Mesa",
    submarket: "Downtown Mesa",
    medianAdr: usd(180),
    medianOccupancy: {
      value: 70,
    },
    trend: MarketTrend.Growing,
    ...overrides,
  };
}

function createAssumptions(
  overrides: Partial<InvestmentAssumptions> = {},
): InvestmentAssumptions {
  return {
    downPayment: {
      value: 25,
    },
    interestRate: {
      value: 6.5,
    },
    loanTermYears: 30,
    averageLengthOfStay: 4,
    managementFee: {
      value: 10,
    },
    maintenanceReserve: {
      value: 5,
    },
    capitalReserve: {
      value: 3,
    },
    estimatedUtilities: usd(3600),
    estimatedInsurance: usd(1800),
    estimatedTaxes: usd(4200),
    ...overrides,
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
      value: 90,
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
    totalOperatingExpenses:
      usd(25000),
    confidence: {
      value: 85,
    },
    ...overrides,
  };
}

function createFinancialPerformance(
  overrides: Partial<FinancialPerformance> = {},
): FinancialPerformance {
  return {
    netOperatingIncome: usd(34000),
    annualCashFlow: usd(16000),
    capRate: {
      value: 8.5,
    },
    cashOnCashReturn: {
      value: 16,
    },
    debtServiceCoverageRatio: 1.89,
    breakEvenOccupancy: {
      value: 52,
    },
    ...overrides,
  };
}

function createComparableAnalysis(
  overrides: Partial<ComparableAnalysis> = {},
): ComparableAnalysis {
  return {
    comparables: [],
    medianAverageDailyRate:
      usd(180),
    medianOccupancy: {
      value: 70,
    },
    marketPositionScore: {
      value: 82,
      max: 100,
    },
    projectedRevenueUpside:
      usd(8760),
    competitiveAdvantages: [
      "Projected ADR exceeds the comparable median.",
      "Projected occupancy exceeds the comparable median.",
    ],
    competitiveDisadvantages: [],
    confidence:
      ConfidenceLevel.High,
    ...overrides,
  };
}

describe("buildInvestmentDecision", () => {
  it("builds a complete explainable investment decision", () => {
    const result =
      buildInvestmentDecision({
        property:
          createPropertyProfile(),
        market:
          createMarketSnapshot(),
        assumptions:
          createAssumptions(),
        revenueProjection:
          createRevenueProjection(),
        expenseProjection:
          createExpenseProjection(),
        financialPerformance:
          createFinancialPerformance(),
        comparableAnalysis:
          createComparableAnalysis(),
      });

    expect(result.property.id).toBe(
      "property-1",
    );

    expect(result.risks).toEqual([]);

    expect(
      result.supportingEvidence.length,
    ).toBeGreaterThanOrEqual(3);

    expect(
      result.supportingEvidence.every(
        ({ direction }) =>
          direction ===
          EvidenceDirection.Positive,
      ),
    ).toBe(true);

    expect(
      result.score.overall.value,
    ).toBeGreaterThanOrEqual(70);

    expect(
      result.recommendation,
    ).toBe(
      AcquisitionRecommendation.StrongBuy,
    );

    expect(result.confidence).toBe(
      ConfidenceLevel.High,
    );
  });

  it("produces a Pass recommendation when critical risks exist", () => {
    const result =
      buildInvestmentDecision({
        property:
          createPropertyProfile(),
        market:
          createMarketSnapshot(),
        assumptions:
          createAssumptions(),
        revenueProjection:
          createRevenueProjection(),
        expenseProjection:
          createExpenseProjection(),
        financialPerformance:
          createFinancialPerformance({
            annualCashFlow:
              usd(-15000),
            debtServiceCoverageRatio:
              0.8,
            breakEvenOccupancy: {
              value: 85,
            },
          }),
        comparableAnalysis:
          createComparableAnalysis(),
      });

    expect(
      result.risks.length,
    ).toBeGreaterThan(0);

    expect(
      result.supportingEvidence.some(
        ({ direction }) =>
          direction ===
          EvidenceDirection.Caution,
      ),
    ).toBe(true);

    expect(
      result.recommendation,
    ).toBe(
      AcquisitionRecommendation.Pass,
    );
  });

  it("returns Wait when analysis confidence is weak", () => {
    const result =
      buildInvestmentDecision({
        property:
          createPropertyProfile(),
        market:
          createMarketSnapshot(),
        assumptions:
          createAssumptions(),
        revenueProjection:
          createRevenueProjection({
            confidence: {
              value: 40,
            },
          }),
        expenseProjection:
          createExpenseProjection(),
        financialPerformance:
          createFinancialPerformance(),
        comparableAnalysis:
          createComparableAnalysis({
            confidence:
              ConfidenceLevel.VeryLow,
          }),
      });

    expect(result.confidence).toBe(
      ConfidenceLevel.VeryLow,
    );

    expect(
      result.recommendation,
    ).toBe(
      AcquisitionRecommendation.Wait,
    );
  });

  it("supports custom policies across the complete decision pipeline", () => {
    const result =
      buildInvestmentDecision({
        property:
          createPropertyProfile(),
        market:
          createMarketSnapshot({
            trend: MarketTrend.Stable,
          }),
        assumptions:
          createAssumptions(),
        revenueProjection:
          createRevenueProjection(),
        expenseProjection:
          createExpenseProjection(),
        financialPerformance:
          createFinancialPerformance({
            capRate: {
              value: 7,
            },
            cashOnCashReturn: {
              value: 10,
            },
          }),
        comparableAnalysis:
          createComparableAnalysis(),
        policies: {
          scoring: {
            targetCapRate: 6,
            targetCashOnCashReturn: 8,
            targetDebtServiceCoverageRatio:
              1.2,
            targetMarketOccupancy: 60,
            fullRevenueUpsidePercentage:
              10,
          },
          evidence: {
            strongCapRate: 6,
            strongCashOnCashReturn: 8,
            healthyDebtServiceCoverageRatio:
              1.2,
            strongAnnualCashFlow: 10000,
            meaningfulRevenueUpside: 4000,
            materialAdrPremiumPercentage:
              5,
            materialOccupancyPremiumPoints:
              5,
          },
          recommendation: {
            strongBuyMinimumScore: 80,
            buyMinimumScore: 65,
            buyWithConditionsMinimumScore:
              50,
            waitMinimumScore: 35,
            strongBuyMaximumRiskExposure:
              30,
            buyMaximumRiskExposure: 45,
            buyWithConditionsMaximumRiskExposure:
              70,
            strongBuyMinimumPositiveEvidence:
              3,
            buyMinimumPositiveEvidence: 2,
          },
        },
      });

    expect(
      result.recommendation,
    ).not.toBe(
      AcquisitionRecommendation.Pass,
    );

    expect(
      result.supportingEvidence.length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("is deterministic for identical analyzed inputs", () => {
    const input = {
      property:
        createPropertyProfile(),
      market:
        createMarketSnapshot(),
      assumptions:
        createAssumptions(),
      revenueProjection:
        createRevenueProjection(),
      expenseProjection:
        createExpenseProjection(),
      financialPerformance:
        createFinancialPerformance(),
      comparableAnalysis:
        createComparableAnalysis(),
    };

    expect(
      buildInvestmentDecision(input),
    ).toEqual(
      buildInvestmentDecision(input),
    );
  });
});
