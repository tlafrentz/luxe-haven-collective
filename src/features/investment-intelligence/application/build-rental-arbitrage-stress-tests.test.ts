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
  buildRentalArbitrageStressTests,
} from "./build-rental-arbitrage-stress-tests";

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
  "buildRentalArbitrageStressTests",
  () => {
    it(
      "builds all supported market stress events",
      () => {
        const result =
          buildRentalArbitrageStressTests(
            createAnalysis(),
          );

        expect(
          result.tests,
        ).toHaveLength(7);
      },
    );

    it(
      "ranks the most damaging event first",
      () => {
        const result =
          buildRentalArbitrageStressTests(
            createAnalysis(),
          );

        expect(
          result.mostDamagingStress
            .type,
        ).toBe(
          "regulatory-constraint",
        );

        expect(
          result.tests[0].type,
        ).toBe(
          "regulatory-constraint",
        );
      },
    );

    it(
      "calculates stressed cash flow from stressed revenue and expenses",
      () => {
        const result =
          buildRentalArbitrageStressTests(
            createAnalysis(),
          );

        const regulatory =
          result.tests.find(
            ({ type }) =>
              type ===
              "regulatory-constraint",
          );

        expect(
          regulatory
            ?.stressedAnnualRevenue
            .amount,
        ).toBe(45990);

        expect(
          regulatory
            ?.stressedAnnualCashFlow
            .amount,
        ).toBe(-5712.9);

        expect(
          regulatory?.outcome,
        ).toBe("fails");
      },
    );

    it(
      "reports the number of stresses that eliminate cash flow",
      () => {
        const result =
          buildRentalArbitrageStressTests(
            createAnalysis(),
          );

        expect(
          result.failedStressCount,
        ).toBe(5);

        expect(
          result.overallOutcome,
        ).toBe("fails");
      },
    );

    it(
      "classifies cost inflation events as survivable for the base fixture",
      () => {
        const result =
          buildRentalArbitrageStressTests(
            createAnalysis(),
          );

        const cleaning =
          result.tests.find(
            ({ type }) =>
              type ===
              "cleaning-cost-inflation",
          );

        const insurance =
          result.tests.find(
            ({ type }) =>
              type ===
              "insurance-cost-inflation",
          );

        expect(
          cleaning
            ?.stressedAnnualCashFlow
            .amount,
        ).toBe(6855.81);

        expect(
          insurance
            ?.stressedAnnualCashFlow
            .amount,
        ).toBe(7592.78);
      },
    );
  },
);
