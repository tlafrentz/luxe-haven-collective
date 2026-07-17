import {
  describe,
  expect,
  it,
} from "vitest";

import {
  AcquisitionType,
} from "../domain";

import {
  buildInvestmentWorkspaceReadiness,
} from "./investment-workspace-readiness";

const BASE_VALUES = {
  acquisitionType:
    AcquisitionType.Purchase,

  address1: "123 Main Street",
  city: "Mesa",
  state: "AZ",
  postalCode: "85201",

  purchasePrice: 425000,
  closingCosts: 12000,
  furnishingBudget: 25000,

  propertyType: "apartment",
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
} as const;

describe(
  "buildInvestmentWorkspaceReadiness",
  () => {
    it("marks a complete purchase workspace ready", () => {
      const groups =
        buildInvestmentWorkspaceReadiness(
          BASE_VALUES,
        );

      expect(
        groups.every(
          ({ isComplete }) =>
            isComplete,
        ),
      ).toBe(true);
    });

    it("uses lease assumptions for rental arbitrage readiness", () => {
      const groups =
        buildInvestmentWorkspaceReadiness({
          ...BASE_VALUES,
          acquisitionType:
            AcquisitionType.RentalArbitrage,
          purchasePrice: 0,
        });

      expect(
        groups.find(
          ({ id }) =>
            id === "property",
        )?.isComplete,
      ).toBe(true);

      expect(
        groups.find(
          ({ id }) =>
            id === "financing",
        )?.isComplete,
      ).toBe(true);
    });

    it("marks rental arbitrage incomplete without monthly rent", () => {
      const groups =
        buildInvestmentWorkspaceReadiness({
          ...BASE_VALUES,
          acquisitionType:
            AcquisitionType.RentalArbitrage,
          monthlyLease: 0,
        });

      expect(
        groups.find(
          ({ id }) =>
            id === "financing",
        )?.isComplete,
      ).toBe(false);
    });

    it("keeps purchase financing independent from lease assumptions", () => {
      const groups =
        buildInvestmentWorkspaceReadiness({
          ...BASE_VALUES,
          monthlyLease: 0,
          securityDeposit: 0,
          leaseTermMonths: 0,
        });

      expect(
        groups.find(
          ({ id }) =>
            id === "financing",
        )?.isComplete,
      ).toBe(true);
    });
  },
);
