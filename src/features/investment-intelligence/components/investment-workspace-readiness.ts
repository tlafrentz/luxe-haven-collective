import {
  AcquisitionType,
} from "../domain";

export type InvestmentWorkspaceReadinessValues = {
  readonly acquisitionType: AcquisitionType;

  readonly address1: string;
  readonly city: string;
  readonly state: string;
  readonly postalCode: string;

  readonly purchasePrice: number;
  readonly closingCosts: number;
  readonly furnishingBudget: number;

  readonly propertyType: unknown;
  readonly bedrooms: number;
  readonly bathrooms: number;
  readonly squareFeet: number;

  readonly downPaymentPercentage: number;
  readonly interestRatePercentage: number;
  readonly loanTermYears: number;

  readonly monthlyLease: number;
  readonly securityDeposit: number;
  readonly leaseTermMonths: number;
  readonly startupCosts: number;
  readonly utilitiesIncluded: boolean;

  readonly projectedAdr: number;
  readonly projectedOccupancyPercentage: number;
  readonly averageLengthOfStay: number;

  readonly managementFeePercentage: number;
  readonly monthlyUtilities: number;
  readonly annualInsurance: number;
  readonly annualTaxes: number;
  readonly annualCleaning: number;
  readonly annualSoftware: number;
  readonly annualSupplies: number;
  readonly maintenanceReservePercentage: number;
  readonly capitalReservePercentage: number;
};

export type DecisionReadinessGroup = {
  readonly id:
    | "strategy"
    | "property"
    | "financing"
    | "revenue"
    | "operating";
  readonly label: string;
  readonly isComplete: boolean;
};

function isPositiveNumber(
  value: number,
): boolean {
  return Number.isFinite(value) && value > 0;
}

function isNonNegativeNumber(
  value: number,
): boolean {
  return Number.isFinite(value) && value >= 0;
}

function isValidPercentage(
  value: number,
  allowZero = true,
): boolean {
  return (
    Number.isFinite(value) &&
    value >= (allowZero ? 0 : Number.EPSILON) &&
    value <= 100
  );
}

export function buildInvestmentWorkspaceReadiness(
  values: InvestmentWorkspaceReadinessValues,
): readonly DecisionReadinessGroup[] {
  const isPurchase =
    values.acquisitionType ===
    AcquisitionType.Purchase;

  const propertyIsComplete =
    Boolean(values.address1.trim()) &&
    Boolean(values.city.trim()) &&
    Boolean(values.state.trim()) &&
    Boolean(values.postalCode.trim()) &&
    isPositiveNumber(values.bedrooms) &&
    isPositiveNumber(values.bathrooms) &&
    isPositiveNumber(values.squareFeet) &&
    (
      isPurchase
        ? isPositiveNumber(
            values.purchasePrice,
          )
        : true
    );

  const capitalStructureIsComplete =
    isPurchase
      ? (
          isValidPercentage(
            values.downPaymentPercentage,
            false,
          ) &&
          isPositiveNumber(
            values.interestRatePercentage,
          ) &&
          isPositiveNumber(
            values.loanTermYears,
          ) &&
          isNonNegativeNumber(
            values.closingCosts,
          ) &&
          isNonNegativeNumber(
            values.furnishingBudget,
          )
        )
      : (
          isPositiveNumber(
            values.monthlyLease,
          ) &&
          isNonNegativeNumber(
            values.securityDeposit,
          ) &&
          isPositiveNumber(
            values.leaseTermMonths,
          ) &&
          isNonNegativeNumber(
            values.furnishingBudget,
          ) &&
          isNonNegativeNumber(
            values.startupCosts,
          )
        );

  return [
    {
      id: "strategy",
      label:
        isPurchase
          ? "Purchase strategy"
          : "Rental arbitrage strategy",
      isComplete: true,
    },
    {
      id: "property",
      label: "Property details",
      isComplete:
        propertyIsComplete,
    },
    {
      id: "financing",
      label:
        isPurchase
          ? "Financing structure"
          : "Lease structure",
      isComplete:
        capitalStructureIsComplete,
    },
    {
      id: "revenue",
      label: "Revenue assumptions",
      isComplete:
        isPositiveNumber(
          values.projectedAdr,
        ) &&
        isValidPercentage(
          values.projectedOccupancyPercentage,
          false,
        ) &&
        isPositiveNumber(
          values.averageLengthOfStay,
        ),
    },
    {
      id: "operating",
      label: "Operating assumptions",
      isComplete:
        isValidPercentage(
          values.managementFeePercentage,
        ) &&
        isNonNegativeNumber(
          values.monthlyUtilities,
        ) &&
        isNonNegativeNumber(
          values.annualInsurance,
        ) &&
        isNonNegativeNumber(
          values.annualTaxes,
        ) &&
        isNonNegativeNumber(
          values.annualCleaning,
        ) &&
        isNonNegativeNumber(
          values.annualSoftware,
        ) &&
        isNonNegativeNumber(
          values.annualSupplies,
        ) &&
        isValidPercentage(
          values.maintenanceReservePercentage,
        ) &&
        isValidPercentage(
          values.capitalReservePercentage,
        ),
    },
  ];
}
