import {
  describe,
  expect,
  it,
} from "vitest";

import {
  AcquisitionRecommendation,
  AcquisitionType,
  ConfidenceLevel,
  MarketTrend,
  PropertyType,
} from "../domain";

import type {
  RentalArbitrageInvestmentAnalysis,
} from "../domain";

import {
  calculateRentalArbitrageFailurePoints,
} from "./calculate-rental-arbitrage-failure-points";

function usd(amount: number) {
  return {
    amount,
    currency: "USD" as const,
  };
}

function createAnalysis(): RentalArbitrageInvestmentAnalysis {
  return {
    acquisitionType:
      AcquisitionType.RentalArbitrage,
    property: {
      id: "opportunity-1",
      location: {
        address1: "123 Main Street",
        city: "Mesa",
        state: "AZ",
        postalCode: "85201",
      },
      furnishingBudget: usd(18000),
      propertyType:
        PropertyType.Apartment,
      bedrooms: 2,
      bathrooms: 1,
      squareFeet: 950,
    },
    market: {
      market: "Mesa",
      submarket: "Downtown Mesa",
      medianAdr: usd(180),
      medianOccupancy: {
        value: 70,
      },
      trend: MarketTrend.Stable,
    },
    assumptions: {
      acquisitionType:
        AcquisitionType.RentalArbitrage,
      monthlyLease: usd(2200),
      securityDeposit: usd(2200),
      leaseTermMonths: 12,
      furnishingBudget: usd(18000),
      startupCosts: usd(4000),
      utilitiesIncluded: false,
    },
    revenueProjection: {
      projectedAdr: usd(210),
      projectedOccupancy: {
        value: 78,
      },
      projectedMonthlyRevenue:
        usd(4982.25),
      projectedAnnualRevenue:
        usd(59787),
      confidence: {
        value: 82,
      },
    },
    expenseProjection: {
      lease: usd(26400),
      cleaning: usd(7200),
      utilities: usd(3600),
      insurance: usd(1200),
      management: usd(5978.7),
      maintenance: usd(2391.48),
      software: usd(1200),
      supplies: usd(1800),
      capitalReserve: usd(1195.74),
      totalOperatingExpenses:
        usd(24565.92),
      totalAnnualExpenses:
        usd(50965.92),
      confidence: {
        value: 80,
      },
    },
    financialPerformance: {
      annualGrossRevenue:
        usd(59787),
      annualLeaseExpense:
        usd(26400),
      annualOperatingExpenses:
        usd(24565.92),
      totalAnnualExpenses:
        usd(50965.92),
      annualCashFlow:
        usd(8821.08),
      monthlyOperatingMargin:
        usd(735.09),
      initialCashInvested:
        usd(24200),
      cashOnCashReturn: {
        value: 36.45,
      },
      leaseCoverageRatio: 1.33,
      breakEvenOccupancy: {
        value: 66.49,
      },
    },
    comparableAnalysis: {
      comparables: [],
      medianAverageDailyRate:
        usd(190),
      medianOccupancy: {
        value: 72,
      },
      marketPositionScore: {
        value: 78,
        max: 100,
      },
      projectedRevenueUpside:
        usd(5000),
      competitiveAdvantages: [
        "Projected ADR exceeds the comparable median.",
      ],
      competitiveDisadvantages: [],
      confidence:
        ConfidenceLevel.High,
    },
    risks: [],
    supportingEvidence: [],
    score: {
      overall: {
        value: 72,
        max: 100,
      },
      revenuePotential: {
        value: 75,
        max: 100,
      },
      financialStrength: {
        value: 74,
        max: 100,
      },
      marketStrength: {
        value: 70,
        max: 100,
      },
      competitivePosition: {
        value: 78,
        max: 100,
      },
      riskExposure: {
        value: 22,
        max: 100,
      },
    },
    recommendation:
      AcquisitionRecommendation.Buy,
    confidence:
      ConfidenceLevel.High,
  };
}

describe(
  "calculateRentalArbitrageFailurePoints",
  () => {
    it(
      "calculates the maximum sustainable monthly lease",
      () => {
        const result =
          calculateRentalArbitrageFailurePoints(
            createAnalysis(),
          );

        expect(
          result.maximumMonthlyLease
            .amount,
        ).toBe(2935.09);

        expect(
          result.monthlyLeaseSafetyMargin
            .amount,
        ).toBe(735.09);
      },
    );

    it(
      "calculates occupancy and ADR failure points",
      () => {
        const result =
          calculateRentalArbitrageFailurePoints(
            createAnalysis(),
          );

        expect(
          result.minimumOccupancy.value,
        ).toBe(66.49);

        expect(
          result
            .occupancySafetyMarginPoints,
        ).toBe(11.51);

        expect(
          result.minimumAdr.amount,
        ).toBe(179.02);
      },
    );

    it(
      "uses annual cash flow as the operating expense safety margin",
      () => {
        const result =
          calculateRentalArbitrageFailurePoints(
            createAnalysis(),
          );

        expect(
          result
            .operatingExpenseSafetyMargin
            .amount,
        ).toBe(8821.08);
      },
    );

    it(
      "identifies an at-risk plan when cash flow is negative",
      () => {
        const analysis =
          createAnalysis();

        const result =
          calculateRentalArbitrageFailurePoints({
            ...analysis,
            financialPerformance: {
              ...analysis.financialPerformance,
              annualGrossRevenue:
                usd(45000),
              annualCashFlow:
                usd(-5965.92),
            },
          });

        expect(result.status).toBe(
          "at-risk",
        );
      },
    );
  },
);
