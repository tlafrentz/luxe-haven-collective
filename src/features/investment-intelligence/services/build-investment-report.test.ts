import {
  describe,
  expect,
  it,
} from "vitest";

import {
  AcquisitionRecommendation,
  MarketTrend,
  PropertyType,
} from "../domain";

import type {
  ComparableProperty,
} from "../domain";

import {
  buildInvestmentReport,
} from "./build-investment-report";

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

describe("buildInvestmentReport", () => {
  it("builds an end-to-end investment decision", () => {
    const result =
      buildInvestmentReport({
        property: {
          id: "opportunity-1",
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
        revenue: {
          projectedAdr: 200,
          projectedOccupancyPercentage:
            75,
          averageLengthOfStay: 4,
          confidencePercentage: 85,
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
        market: {
          name: "Mesa",
          submarket:
            "Downtown Mesa",
          medianAdr: 180,
          medianOccupancyPercentage:
            70,
          trend:
            MarketTrend.Stable,
        },
        comparables:
          createComparables(),
      });

    expect(
      result.property.id,
    ).toBe("opportunity-1");

    expect(
      result.revenueProjection
        .projectedAnnualRevenue.amount,
    ).toBe(54750);

    expect(
      result.expenseProjection
        .mortgage.amount,
    ).toBe(24176.6);

    expect(
      result.financialPerformance
        .netOperatingIncome.amount,
    ).toBeGreaterThan(0);

    expect(
      result.comparableAnalysis
        .comparables,
    ).toHaveLength(3);

    expect(
      Object.values(
        AcquisitionRecommendation,
      ),
    ).toContain(
      result.recommendation,
    );
  });

  it("responds to changes in purchase price", () => {
    const baseInput = {
      property: {
        id: "opportunity-1",
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
      revenue: {
        projectedAdr: 200,
        projectedOccupancyPercentage:
          75,
        averageLengthOfStay: 4,
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
      market: {
        name: "Mesa",
        medianAdr: 180,
        medianOccupancyPercentage: 70,
        trend: MarketTrend.Stable,
      },
      comparables:
        createComparables(),
    } as const;

    const higherPrice =
      buildInvestmentReport(
        baseInput,
      );

    const lowerPrice =
      buildInvestmentReport({
        ...baseInput,
        property: {
          ...baseInput.property,
          purchasePrice: 350000,
        },
      });

    expect(
      lowerPrice
        .financialPerformance
        .capRate.value,
    ).toBeGreaterThan(
      higherPrice
        .financialPerformance
        .capRate.value,
    );

    expect(
      lowerPrice
        .financialPerformance
        .annualCashFlow.amount,
    ).toBeGreaterThan(
      higherPrice
        .financialPerformance
        .annualCashFlow.amount,
    );
  });
});
