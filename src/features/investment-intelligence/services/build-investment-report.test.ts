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

import type {
  ComparableProperty,
} from "../domain";

import {
  buildInvestmentReport,
} from "./build-investment-report";

import {
  runInvestmentAnalysis,
} from "../application/run-investment-analysis";

function usd(amount: number) {
  return {
    amount,
    currency: "USD" as const,
  };
}

function createComparables(): readonly ComparableProperty[] {
  return [
    {
      id: "comparable-1",
      distanceMiles: 0.8,
      bedrooms: 2,
      bathrooms: 1,
      averageDailyRate: usd(180),
      occupancy: {
        value: 70,
      },
      rating: {
        value: 4.8,
        max: 5,
      },
      reviewCount: 120,
      amenities: [
        "Kitchen",
        "Parking",
      ],
    },
    {
      id: "comparable-2",
      distanceMiles: 1.2,
      bedrooms: 2,
      bathrooms: 1,
      averageDailyRate: usd(190),
      occupancy: {
        value: 72,
      },
      rating: {
        value: 4.7,
        max: 5,
      },
      reviewCount: 85,
      amenities: [
        "Kitchen",
        "Workspace",
      ],
    },
    {
      id: "comparable-3",
      distanceMiles: 1.6,
      bedrooms: 2,
      bathrooms: 1,
      averageDailyRate: usd(170),
      occupancy: {
        value: 68,
      },
      rating: {
        value: 4.9,
        max: 5,
      },
      reviewCount: 144,
      amenities: [
        "Kitchen",
        "Laundry",
      ],
    },
  ];
}

const commonInput = {
  revenue: {
    projectedAdr: 200,
    projectedOccupancyPercentage:
      75,
    averageLengthOfStay: 4,
    confidencePercentage: 85,
  },
  market: {
    name: "Mesa",
    submarket: "Downtown Mesa",
    medianAdr: 180,
    medianOccupancyPercentage:
      70,
    trend: MarketTrend.Stable,
  },
  comparables:
    createComparables(),
} as const;

describe("buildInvestmentReport", () => {
  it("preserves the legacy purchase default through the canonical boundary", () => {
    const input = {
      property: {
        id: "compatibility-purchase",
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
      ...commonInput,
    } as const;

    const legacy =
      buildInvestmentReport(input);
    const canonical =
      runInvestmentAnalysis({
        ...input,
        acquisitionType:
          AcquisitionType.Purchase,
      });

    expect(legacy.acquisitionType).toBe(
      AcquisitionType.Purchase,
    );
    expect(legacy).toEqual(
      canonical.analysis,
    );
  });

  it("preserves the rental projection through the canonical boundary", () => {
    const input = {
      acquisitionType:
        AcquisitionType.RentalArbitrage,
      property: {
        id: "compatibility-rental",
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
      ...commonInput,
    } as const;

    const legacy =
      buildInvestmentReport(input);
    const canonical =
      runInvestmentAnalysis(input);

    expect(legacy).toEqual(
      canonical.analysis,
    );
  });

  it("preserves the existing purchase pathway", () => {
    const result =
      buildInvestmentReport({
        property: {
          id: "purchase-1",
          address1:
            "123 Main Street",
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
          maintenanceReservePercentage:
            5,
          capitalReservePercentage: 3,
        },
        ...commonInput,
      });

    expect(
      result.acquisitionType,
    ).toBe(
      AcquisitionType.Purchase,
    );

    expect(
      result.expenseProjection
        .mortgage.amount,
    ).toBe(24176.6);

    expect(
      result.financialPerformance
        .netOperatingIncome.amount,
    ).toBeGreaterThan(0);

    expect(
      Object.values(
        AcquisitionRecommendation,
      ),
    ).toContain(
      result.recommendation,
    );
  });

  it("builds a rental-arbitrage analysis", () => {
    const result =
      buildInvestmentReport({
        acquisitionType:
          AcquisitionType.RentalArbitrage,
        property: {
          id: "rental-arbitrage-1",
          address1:
            "123 Main Street",
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
          maintenanceReservePercentage:
            3,
          capitalReservePercentage: 2,
        },
        ...commonInput,
      });

    expect(
      result.acquisitionType,
    ).toBe(
      AcquisitionType.RentalArbitrage,
    );

    expect(
      result.expenseProjection
        .lease.amount,
    ).toBe(24000);

    expect(
      result.financialPerformance
        .leaseCoverageRatio,
    ).toBeGreaterThan(1);

    expect(
      result.financialPerformance
        .initialCashInvested.amount,
    ).toBe(20000);

    expect(
      Object.values(
        AcquisitionRecommendation,
      ),
    ).toContain(
      result.recommendation,
    );
  });

  it("excludes utilities when the lease includes them", () => {
    const result =
      buildInvestmentReport({
        acquisitionType:
          AcquisitionType.RentalArbitrage,
        property: {
          id: "rental-arbitrage-2",
          address1:
            "456 Main Street",
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
          utilitiesIncluded: true,
        },
        operating: {
          managementFeePercentage: 10,
          monthlyUtilities: 250,
          annualInsurance: 1200,
          annualCleaning: 6000,
          annualSoftware: 600,
          annualSupplies: 1200,
          maintenanceReservePercentage:
            3,
          capitalReservePercentage: 2,
        },
        ...commonInput,
      });

    expect(
      result.expenseProjection
        .utilities.amount,
    ).toBe(0);
  });

  it("narrows strategy-specific metrics by acquisition type", () => {
    const result =
      buildInvestmentReport({
        acquisitionType:
          AcquisitionType.RentalArbitrage,
        property: {
          id: "rental-arbitrage-3",
          address1:
            "789 Main Street",
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
          maintenanceReservePercentage:
            3,
          capitalReservePercentage: 2,
        },
        ...commonInput,
      });

    if (
      result.acquisitionType ===
      AcquisitionType.RentalArbitrage
    ) {
      expect(
        result.financialPerformance
          .leaseCoverageRatio,
      ).toBeGreaterThan(1);
    }
  });
});
