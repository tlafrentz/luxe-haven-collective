import {
  describe,
  expect,
  it,
} from "vitest";

import {
  AcquisitionRecommendation,
  AcquisitionType,
  EvidenceDirection,
  MarketTrend,
  PropertyType,
  RiskSeverity,
} from "../domain";

import {
  buildRentalArbitrageInvestmentReport,
} from "./build-rental-arbitrage-investment-report";

function createInput() {
  return {
    acquisitionType:
      AcquisitionType.RentalArbitrage,

    property: {
      id: "rental-opportunity",
      address1: "123 Main Street",
      city: "Mesa",
      state: "AZ",
      postalCode: "85201",
      furnishingBudget: 18000,
      propertyType:
        PropertyType.Apartment,
      bedrooms: 2,
      bathrooms: 1,
      squareFeet: 950,
    },

    lease: {
      monthlyLease: 2200,
      securityDeposit: 2200,
      leaseTermMonths: 12,
      startupCosts: 4000,
      utilitiesIncluded: false,
    },

    revenue: {
      projectedAdr: 210,
      projectedOccupancyPercentage: 78,
      averageLengthOfStay: 4,
      confidencePercentage: 82,
    },

    operating: {
      managementFeePercentage: 10,
      monthlyUtilities: 300,
      annualInsurance: 1200,
      annualCleaning: 7200,
      annualSoftware: 1200,
      annualSupplies: 1800,
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
        id: "comp-1",
        distanceMiles: 0.7,
        bedrooms: 2,
        bathrooms: 1,
        averageDailyRate: {
          amount: 195,
          currency: "USD",
        },
        occupancy: {
          value: 74,
        },
        rating: {
          value: 4.8,
          max: 5,
        },
        reviewCount: 110,
        amenities: [
          "Kitchen",
          "Parking",
        ],
      },
      {
        id: "comp-2",
        distanceMiles: 1.1,
        bedrooms: 2,
        bathrooms: 1,
        averageDailyRate: {
          amount: 205,
          currency: "USD",
        },
        occupancy: {
          value: 76,
        },
        rating: {
          value: 4.7,
          max: 5,
        },
        reviewCount: 84,
        amenities: [
          "Kitchen",
          "Laundry",
        ],
      },
    ],
  } as const;
}

describe(
  "buildRentalArbitrageInvestmentReport",
  () => {
    it(
      "builds an explainable rental arbitrage decision",
      () => {
        const report =
          buildRentalArbitrageInvestmentReport(
            createInput(),
          );

        expect(
          report.acquisitionType,
        ).toBe(
          AcquisitionType.RentalArbitrage,
        );

        expect(
          report.risks.length,
        ).toBeGreaterThanOrEqual(0);

        expect(
          report.supportingEvidence.length,
        ).toBeGreaterThan(0);

        expect(
          report.score.overall.value,
        ).toBeGreaterThanOrEqual(0);

        expect(
          report.score.overall.value,
        ).toBeLessThanOrEqual(100);

        expect(
          report.recommendation,
        ).not.toBeUndefined();

        expect(
          report.confidence,
        ).not.toBeUndefined();
      },
    );

    it(
      "passes an opportunity that cannot cover the lease",
      () => {
        const input =
          createInput();

        const report =
          buildRentalArbitrageInvestmentReport({
            ...input,
            revenue: {
              ...input.revenue,
              projectedAdr: 110,
              projectedOccupancyPercentage:
                45,
            },
            lease: {
              ...input.lease,
              monthlyLease: 3200,
            },
          });

        expect(
          report.recommendation,
        ).toBe(
          AcquisitionRecommendation.Pass,
        );

        expect(
          report.risks.some(
            ({ severity }) =>
              severity ===
              RiskSeverity.Critical,
          ),
        ).toBe(true);

        expect(
          report.supportingEvidence.some(
            ({ direction }) =>
              direction ===
              EvidenceDirection.Caution,
          ),
        ).toBe(true);
      },
    );

    it(
      "identifies supportive evidence for a healthy plan",
      () => {
        const report =
          buildRentalArbitrageInvestmentReport(
            createInput(),
          );

        expect(
          report.supportingEvidence.some(
            ({ direction }) =>
              direction ===
              EvidenceDirection.Positive,
          ),
        ).toBe(true);

        expect(
          report.financialPerformance
            .annualCashFlow.amount,
        ).toBeGreaterThan(0);

        expect(
          report.financialPerformance
            .leaseCoverageRatio,
        ).toBeGreaterThan(1);
      },
    );
  },
);
