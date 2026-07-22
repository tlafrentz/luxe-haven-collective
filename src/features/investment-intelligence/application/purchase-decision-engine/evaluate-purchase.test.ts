import {
  describe,
  expect,
  it,
} from "vitest";

import {
  AcquisitionType,
  MarketTrend,
  PropertyType,
} from "../../domain";

import {
  runInvestmentAnalysis,
} from "../run-investment-analysis";

import {
  evaluatePurchase,
} from "./evaluate-purchase";

function createResult({
  projectedAdr = 200,
  projectedOccupancyPercentage = 75,
}: {
  projectedAdr?: number;
  projectedOccupancyPercentage?: number;
} = {}) {
  return runInvestmentAnalysis({
    acquisitionType:
      AcquisitionType.Purchase,
    property: {
      id: "purchase-report",
      address1: "123 Main Street",
      city: "Mesa",
      state: "AZ",
      postalCode: "85201",
      purchasePrice: 400000,
      closingCosts: 12000,
      furnishingBudget: 18000,
      propertyType:
        PropertyType.Apartment,
      bedrooms: 2,
      bathrooms: 1,
      squareFeet: 950,
    },
    financing: {
      downPaymentPercentage: 20,
      interestRatePercentage: 6.5,
      loanTermYears: 30,
    },
    revenue: {
      projectedAdr,
      projectedOccupancyPercentage,
      averageLengthOfStay: 4,
      confidencePercentage: 85,
    },
    operating: {
      managementFeePercentage: 10,
      monthlyUtilities: 250,
      annualInsurance: 1500,
      annualTaxes: 3500,
      annualCleaning: 6000,
      annualSoftware: 500,
      annualSupplies: 1000,
      maintenanceReservePercentage: 4,
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
        amenities: ["Kitchen"],
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
        amenities: ["Workspace"],
      },
    ],
  });
}

describe("evaluatePurchase", () => {
  it("projects one report from the canonical purchase decision", () => {
    const result = createResult();

    if (
      result.acquisitionType !==
      AcquisitionType.Purchase
    ) {
      throw new Error(
        "Expected purchase result.",
      );
    }

    const report = evaluatePurchase(result);

    expect(report.scenarios).toBe(
      result.derivedAnalysis.scenarios,
    );
    expect(report.failurePoints).toBe(
      result.derivedAnalysis.failurePoints,
    );
    expect(
      report.recommendation.recommendation,
    ).toBe(
      result.analysis.recommendation,
    );
    expect(report.confidence.level).toBe(
      result.analysis.confidence,
    );
    expect(
      report.risks.map(({ code }) => code),
    ).toEqual(
      result.analysis.risks.map(
        ({ id }) => id,
      ),
    );
    expect(report.evidence).toHaveLength(
      result.analysis.supportingEvidence
        .length,
    );
  });

  it("does not replace a canonical pass recommendation", () => {
    const result = createResult({
      projectedAdr: 160,
      projectedOccupancyPercentage: 50,
    });

    if (
      result.acquisitionType !==
      AcquisitionType.Purchase
    ) {
      throw new Error(
        "Expected purchase result.",
      );
    }

    const report = evaluatePurchase(result);

    expect(
      report.recommendation.recommendation,
    ).toBe(result.analysis.recommendation);
    expect(
      report.confidence.factors,
    ).toHaveLength(1);
  });
});
