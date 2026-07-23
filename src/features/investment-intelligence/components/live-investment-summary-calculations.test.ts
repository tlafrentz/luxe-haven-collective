import {
  describe,
  expect,
  it,
} from "vitest";

import {
  AcquisitionType,
  PropertyType,
} from "../domain";

import type {
  InvestmentWorkspaceValues,
} from "./investment-workspace-state";

import {
  calculateLiveInvestmentSummary,
} from "./live-investment-summary-calculations";

const baseValues: InvestmentWorkspaceValues = {
  acquisitionType:
    AcquisitionType.Purchase,
  address1: "123 Main Street",
  city: "Mesa",
  state: "AZ",
  postalCode: "85201",
  purchasePrice: 425000,
  closingCosts: 12000,
  furnishingBudget: 25000,
  propertyType: PropertyType.Apartment,
  bedrooms: 2,
  bathrooms: 1,
  squareFeet: 950,
  downPaymentPercentage: 25,
  interestRatePercentage: 6.5,
  loanTermYears: 30,
  monthlyLease: 2400,
  securityDeposit: 2400,
  leaseTermMonths: 12,
  startupCosts: 5000,
  utilitiesIncluded: false,
  projectedAdr: 200,
  projectedOccupancyPercentage: 75,
  averageLengthOfStay: 4,
  managementFeePercentage: 10,
  monthlyUtilities: 300,
  annualInsurance: 1800,
  annualTaxes: 4200,
  annualCleaning: 7200,
  annualSoftware: 1200,
  annualSupplies: 1800,
  maintenanceReservePercentage: 5,
  capitalReservePercentage: 3,
};

function expectFiniteMetrics(
  metrics: ReturnType<
    typeof calculateLiveInvestmentSummary
  >,
) {
  for (
    const value of Object.values(
      metrics,
    )
  ) {
    if (typeof value === "number") {
      expect(
        Number.isFinite(value),
      ).toBe(true);
    }
  }
}

describe(
  "calculateLiveInvestmentSummary",
  () => {
    it(
      "calculates purchase preview metrics",
      () => {
        const metrics =
          calculateLiveInvestmentSummary(
            baseValues,
          );

        expect(
          metrics.annualRevenue,
        ).toBe(54750);

        expect(
          metrics.annualOperatingExpenses,
        ).toBe(29655);

        expect(
          metrics.annualNoi,
        ).toBe(25095);

        expect(
          metrics.secondaryReturnLabel,
        ).toBe("Cap rate");

        expect(
          metrics.secondaryReturnPercentage,
        ).toBeCloseTo(
          5.9047,
          3,
        );

        expect(
          metrics.breakEvenStatus,
        ).toBe("caution");

        expectFiniteMetrics(metrics);
      },
    );

    it(
      "calculates rental arbitrage preview metrics",
      () => {
        const metrics =
          calculateLiveInvestmentSummary({
            ...baseValues,
            acquisitionType:
              AcquisitionType.RentalArbitrage,
          });

        expect(
          metrics.annualRevenue,
        ).toBe(54750);

        expect(
          metrics.annualNoi,
        ).toBe(29295);

        expect(
          metrics.monthlyCashFlow,
        ).toBeCloseTo(41.25, 2);

        expect(
          metrics.returnLabel,
        ).toBe(
          "Return on initial cash",
        );

        expect(
          metrics.secondaryReturnLabel,
        ).toBe("Lease coverage");

        expect(
          metrics.cashFlowStatus,
        ).toBe("caution");

        expectFiniteMetrics(metrics);
      },
    );

    it(
      "excludes utilities when included in the rental lease",
      () => {
        const metrics =
          calculateLiveInvestmentSummary({
            ...baseValues,
            acquisitionType:
              AcquisitionType.RentalArbitrage,
            utilitiesIncluded: true,
          });

        expect(
          metrics.annualNoi,
        ).toBe(32895);

        expect(
          metrics.monthlyCashFlow,
        ).toBeCloseTo(341.25, 2);

        expect(
          metrics.cashFlowStatus,
        ).toBe("healthy");
      },
    );

    it(
      "returns finite neutral metrics when ADR is zero",
      () => {
        const metrics =
          calculateLiveInvestmentSummary({
            ...baseValues,
            projectedAdr: 0,
          });

        expect(
          metrics.annualRevenue,
        ).toBe(0);

        expect(
          metrics.breakEvenOccupancyPercentage,
        ).toBe(0);

        expect(
          metrics.breakEvenStatus,
        ).toBe("neutral");

        expectFiniteMetrics(metrics);
      },
    );

    it(
      "returns finite metrics when occupancy is zero",
      () => {
        const metrics =
          calculateLiveInvestmentSummary({
            ...baseValues,
            projectedOccupancyPercentage: 0,
          });

        expect(
          metrics.annualRevenue,
        ).toBe(0);

        expect(
          metrics.projectedOccupancyPercentage,
        ).toBe(0);

        expect(
          metrics.breakEvenStatus,
        ).toBe("neutral");

        expectFiniteMetrics(metrics);
      },
    );

    it(
      "returns finite metrics when purchase price is zero",
      () => {
        const metrics =
          calculateLiveInvestmentSummary({
            ...baseValues,
            purchasePrice: 0,
            downPaymentPercentage: 0,
            closingCosts: 0,
            furnishingBudget: 0,
          });

        expect(
          metrics.secondaryReturnPercentage,
        ).toBe(0);

        expect(
          metrics.returnPercentage,
        ).toBe(0);

        expectFiniteMetrics(metrics);
      },
    );

    it(
      "returns finite rental metrics when initial capital is zero",
      () => {
        const metrics =
          calculateLiveInvestmentSummary({
            ...baseValues,
            acquisitionType:
              AcquisitionType.RentalArbitrage,
            securityDeposit: 0,
            startupCosts: 0,
            furnishingBudget: 0,
          });

        expect(
          metrics.returnPercentage,
        ).toBe(0);

        expectFiniteMetrics(metrics);
      },
    );

    it(
      "clamps projected occupancy to a valid percentage",
      () => {
        const metrics =
          calculateLiveInvestmentSummary({
            ...baseValues,
            projectedOccupancyPercentage: 150,
          });

        expect(
          metrics.projectedOccupancyPercentage,
        ).toBe(100);

        expect(
          metrics.annualRevenue,
        ).toBe(73000);

        expectFiniteMetrics(metrics);
      },
    );
  },
);
