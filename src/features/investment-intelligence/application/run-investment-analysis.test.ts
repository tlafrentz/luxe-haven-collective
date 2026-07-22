import {
  describe,
  expect,
  it,
} from "vitest";

import {
  AcquisitionRecommendation,
  AcquisitionType,
  MarketTrend,
  PropertyType,
} from "../domain";

import {
  buildPurchaseInvestmentReport,
} from "../services/build-purchase-investment-report";

import {
  buildRentalArbitrageInvestmentReport,
} from "../services/build-rental-arbitrage-investment-report";

import {
  runInvestmentAnalysis,
} from "./run-investment-analysis";

import type {
  RunInvestmentAnalysisCommand,
} from "./run-investment-analysis";

const sharedInput = {
  revenue: {
    projectedAdr: 200,
    projectedOccupancyPercentage: 75,
    averageLengthOfStay: 4,
    confidencePercentage: 85,
  },
  market: {
    name: "Mesa",
    submarket: "Downtown Mesa",
    medianAdr: 180,
    medianOccupancyPercentage: 70,
    trend: MarketTrend.Stable,
  },
  comparables: [
    {
      id: "comparable-1",
      distanceMiles: 0.8,
      bedrooms: 2,
      bathrooms: 1,
      averageDailyRate: {
        amount: 180,
        currency: "USD",
      },
      occupancy: { value: 70 },
      rating: { value: 4.8, max: 5 },
      reviewCount: 120,
      amenities: ["Kitchen", "Parking"],
    },
    {
      id: "comparable-2",
      distanceMiles: 1.2,
      bedrooms: 2,
      bathrooms: 1,
      averageDailyRate: {
        amount: 190,
        currency: "USD",
      },
      occupancy: { value: 72 },
      rating: { value: 4.7, max: 5 },
      reviewCount: 85,
      amenities: ["Kitchen", "Workspace"],
    },
  ],
} as const;

function createPurchaseCommand() {
  return {
    acquisitionType:
      AcquisitionType.Purchase,
    property: {
      id: "purchase-1",
      address1: "123 Main Street",
      city: "Mesa",
      state: "AZ",
      postalCode: "85201",
      purchasePrice: 425000,
      closingCosts: 12000,
      furnishingBudget: 25000,
      propertyType:
        PropertyType.Apartment,
      bedrooms: 2,
      bathrooms: 1,
      squareFeet: 950,
    },
    financing: {
      downPaymentPercentage: 25,
      interestRatePercentage: 6.5,
      loanTermYears: 30,
    },
    operating: {
      managementFeePercentage: 10,
      monthlyUtilities: 300,
      annualInsurance: 1800,
      annualTaxes: 4200,
      annualCleaning: 7200,
      annualSoftware: 1200,
      annualSupplies: 1800,
      maintenanceReservePercentage: 5,
      capitalReservePercentage: 3,
    },
    ...sharedInput,
  } as const;
}

function createRentalCommand() {
  return {
    acquisitionType:
      AcquisitionType.RentalArbitrage,
    property: {
      id: "rental-1",
      address1: "123 Main Street",
      city: "Mesa",
      state: "AZ",
      postalCode: "85201",
      furnishingBudget: 15000,
      propertyType:
        PropertyType.Apartment,
      bedrooms: 2,
      bathrooms: 1,
      squareFeet: 950,
    },
    lease: {
      monthlyLease: 2000,
      securityDeposit: 2000,
      leaseTermMonths: 12,
      startupCosts: 3000,
      utilitiesIncluded: false,
    },
    operating: {
      managementFeePercentage: 10,
      monthlyUtilities: 250,
      annualInsurance: 1200,
      annualCleaning: 6000,
      annualSoftware: 600,
      annualSupplies: 1200,
      maintenanceReservePercentage: 3,
      capitalReservePercentage: 2,
    },
    ...sharedInput,
  } as const;
}

describe("runInvestmentAnalysis", () => {
  it("runs the existing purchase route behind the canonical result", () => {
    const command = createPurchaseCommand();
    const result =
      runInvestmentAnalysis(command);
    const existing =
      buildPurchaseInvestmentReport(
        command,
      );

    expect(result.acquisitionType).toBe(
      AcquisitionType.Purchase,
    );
    expect(result.analysis).toEqual(
      existing,
    );

    if (
      result.acquisitionType ===
      AcquisitionType.Purchase
    ) {
      expect(
        result.analysis
          .revenueProjection
          .projectedAnnualRevenue.amount,
      ).toBe(54750);
      expect(
        result.analysis.expenseProjection
          .totalOperatingExpenses.amount,
      ).toBe(29655);
      expect(
        result.analysis.financialPerformance
          .netOperatingIncome.amount,
      ).toBe(25095);
      expect(
        result.analysis.financialPerformance
          .capRate.value,
      ).toBe(5.9);
      expect(
        result.analysis.financialPerformance
          .cashOnCashReturn.value,
      ).toBe(0.64);
      expect(
        Object.values(
          AcquisitionRecommendation,
        ),
      ).toContain(
        result.analysis.recommendation,
      );
      expect(
        result.analysis.score.overall.value,
      ).toBe(existing.score.overall.value);
      expect(
        result.analysis.strategy,
      ).toBeDefined();
    }
  });

  it("runs the existing rental route behind the canonical result", () => {
    const command = createRentalCommand();
    const result =
      runInvestmentAnalysis(command);
    const existing =
      buildRentalArbitrageInvestmentReport(
        command,
      );

    expect(result.acquisitionType).toBe(
      AcquisitionType.RentalArbitrage,
    );
    expect(result.analysis).toEqual(
      existing,
    );

    if (
      result.acquisitionType ===
      AcquisitionType.RentalArbitrage
    ) {
      expect(
        result.analysis
          .revenueProjection
          .projectedAnnualRevenue.amount,
      ).toBe(54750);
      expect(
        result.analysis.expenseProjection
          .lease.amount,
      ).toBe(24000);
      expect(
        result.analysis.financialPerformance
          .annualCashFlow.amount,
      ).toBe(10537.5);
      expect(
        result.analysis.financialPerformance
          .monthlyOperatingMargin.amount,
      ).toBe(878.13);
      expect(
        result.analysis.financialPerformance
          .cashOnCashReturn.value,
      ).toBe(52.69);
      expect(
        result.analysis.financialPerformance
          .breakEvenOccupancy.value,
      ).toBe(60.57);
      expect(
        Object.values(
          AcquisitionRecommendation,
        ),
      ).toContain(
        result.analysis.recommendation,
      );
      expect(
        result.analysis.score.overall.value,
      ).toBe(existing.score.overall.value);
      expect(
        result.analysis.financialPerformance
          .leaseCoverageRatio,
      ).toBeDefined();
    }
  });

  it("narrows route-specific analysis from the result discriminator", () => {
    const commands:
      readonly RunInvestmentAnalysisCommand[] =
      [
        createPurchaseCommand(),
        createRentalCommand(),
      ];

    for (const command of commands) {
      const result =
        runInvestmentAnalysis(command);

      if (
        result.acquisitionType ===
        AcquisitionType.Purchase
      ) {
        expect(
          result.analysis.strategy,
        ).toBeDefined();
      } else {
        expect(
          result.analysis
            .financialPerformance
            .leaseCoverageRatio,
        ).toBeGreaterThan(0);
      }
    }
  });
});
