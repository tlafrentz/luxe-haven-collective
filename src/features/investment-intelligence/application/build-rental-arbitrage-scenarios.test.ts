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
  buildRentalArbitrageScenarios,
} from "./build-rental-arbitrage-scenarios";

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
        "Projected occupancy exceeds the comparable median.",
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
  "buildRentalArbitrageScenarios",
  () => {
    it(
      "creates downside, base, and upside scenarios",
      () => {
        const scenarios =
          buildRentalArbitrageScenarios(
            createAnalysis(),
          );

        expect(
          scenarios.map(
            ({ type }) => type,
          ),
        ).toEqual([
          "downside",
          "base",
          "upside",
        ]);
      },
    );

    it(
      "preserves the base financial result",
      () => {
        const analysis =
          createAnalysis();

        const scenarios =
          buildRentalArbitrageScenarios(
            analysis,
          );

        const base =
          scenarios.find(
            ({ type }) =>
              type === "base",
          );

        expect(
          base?.annualCashFlow.amount,
        ).toBe(
          analysis
            .financialPerformance
            .annualCashFlow.amount,
        );

        expect(
          base?.cashFlowChangeFromBase
            .amount,
        ).toBe(0);
      },
    );

    it(
      "produces ordered cash flow outcomes",
      () => {
        const scenarios =
          buildRentalArbitrageScenarios(
            createAnalysis(),
          );

        const downside =
          scenarios[0];
        const base =
          scenarios[1];
        const upside =
          scenarios[2];

        expect(
          downside.annualCashFlow.amount,
        ).toBeLessThan(
          base.annualCashFlow.amount,
        );

        expect(
          upside.annualCashFlow.amount,
        ).toBeGreaterThan(
          base.annualCashFlow.amount,
        );
      },
    );

    it(
      "downgrades the recommendation when downside economics fail",
      () => {
        const analysis =
          createAnalysis();

        const scenarios =
          buildRentalArbitrageScenarios({
            ...analysis,
            revenueProjection: {
              ...analysis.revenueProjection,
              projectedAdr: usd(165),
              projectedOccupancy: {
                value: 62,
              },
            },
          });

        expect(
          scenarios[0].recommendation,
        ).toBe(
          AcquisitionRecommendation.Pass,
        );
      },
    );
  },
);
