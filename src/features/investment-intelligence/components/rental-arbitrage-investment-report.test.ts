import {
  createElement,
} from "react";

import {
  renderToStaticMarkup,
} from "react-dom/server";

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  runInvestmentAnalysis,
} from "../application";

import {
  AcquisitionType,
  MarketTrend,
  PropertyType,
} from "../domain";

import {
  RentalArbitrageInvestmentReport,
} from "./rental-arbitrage-investment-report";

function createResult() {
  return runInvestmentAnalysis({
    acquisitionType:
      AcquisitionType.RentalArbitrage,
    property: {
      id: "rental-report",
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
    revenue: {
      projectedAdr: 200,
      projectedOccupancyPercentage: 75,
      averageLengthOfStay: 4,
      confidencePercentage: 85,
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
        averageDailyRate: {
          amount: 190,
          currency: "USD",
        },
        occupancy: { value: 72 },
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
    ],
  });
}

describe(
  "RentalArbitrageInvestmentReport",
  () => {
    it("renders supplied canonical failure-point and stress analysis", () => {
      const result = createResult();

      if (
        result.acquisitionType !==
        AcquisitionType.RentalArbitrage
      ) {
        throw new Error(
          "Expected rental-arbitrage result.",
        );
      }

      const suppliedResult = {
        ...result,
        derivedAnalysis: {
          ...result.derivedAnalysis,
          failurePoints: {
            ...result.derivedAnalysis
              .failurePoints,
            summary:
              "Supplied failure-point analysis.",
          },
          stressTests: {
            ...result.derivedAnalysis
              .stressTests,
            summary:
              "Supplied market-stress analysis.",
          },
        },
      };

      const markup =
        renderToStaticMarkup(
          createElement(
            RentalArbitrageInvestmentReport,
            { result: suppliedResult },
          ),
        );

      expect(markup).toContain(
        "Supplied failure-point analysis.",
      );
      expect(markup).toContain(
        "Supplied market-stress analysis.",
      );
    });
  },
);
