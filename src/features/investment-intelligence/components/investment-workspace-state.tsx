"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import type {
  Dispatch,
  ReactNode,
  SetStateAction,
} from "react";

import {
  MarketTrend,
  PropertyType,
} from "../domain";

import type {
  ComparableProperty,
  InvestmentDecision,
} from "../domain";

import {
  buildInvestmentReport,
} from "../services";

export type InvestmentWorkspaceValues = {
  readonly address1: string;
  readonly city: string;
  readonly state: string;
  readonly postalCode: string;

  readonly purchasePrice: number;
  readonly closingCosts: number;
  readonly furnishingBudget: number;

  readonly propertyType: PropertyType;
  readonly bedrooms: number;
  readonly bathrooms: number;
  readonly squareFeet: number;

  readonly downPaymentPercentage: number;
  readonly interestRatePercentage: number;
  readonly loanTermYears: number;

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
    | "property"
    | "financing"
    | "revenue"
    | "operating";
  readonly label: string;
  readonly isComplete: boolean;
};

type InvestmentWorkspaceState = {
  values: InvestmentWorkspaceValues;
  setValues: Dispatch<
    SetStateAction<InvestmentWorkspaceValues>
  >;

  readinessGroups: readonly DecisionReadinessGroup[];
  completedReadinessCount: number;
  totalReadinessCount: number;
  isReadyForAnalysis: boolean;

  decision: InvestmentDecision | null;
  isAnalyzing: boolean;
  analysisError: string | null;

  generateInvestmentDecision: () => Promise<void>;
};

const DEFAULT_VALUES: InvestmentWorkspaceValues = {
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

const InvestmentWorkspaceContext =
  createContext<InvestmentWorkspaceState | null>(
    null,
  );

function usd(amount: number) {
  return {
    amount,
    currency: "USD" as const,
  };
}

function createWorkspaceComparables(
  values: InvestmentWorkspaceValues,
): readonly ComparableProperty[] {
  return [
    {
      id: "workspace-comparable-1",
      distanceMiles: 0.8,
      bedrooms: values.bedrooms,
      bathrooms: values.bathrooms,
      averageDailyRate: usd(180),
      occupancy: {
        value: 70,
      },
      rating: {
        value: 4.8,
        max: 5,
      },
      reviewCount: 124,
      amenities: [
        "Kitchen",
        "Parking",
        "Workspace",
      ],
    },
    {
      id: "workspace-comparable-2",
      distanceMiles: 1.2,
      bedrooms: values.bedrooms,
      bathrooms: values.bathrooms,
      averageDailyRate: usd(190),
      occupancy: {
        value: 72,
      },
      rating: {
        value: 4.7,
        max: 5,
      },
      reviewCount: 89,
      amenities: [
        "Kitchen",
        "Laundry",
        "Parking",
      ],
    },
    {
      id: "workspace-comparable-3",
      distanceMiles: 1.6,
      bedrooms: values.bedrooms,
      bathrooms: values.bathrooms,
      averageDailyRate: usd(170),
      occupancy: {
        value: 68,
      },
      rating: {
        value: 4.9,
        max: 5,
      },
      reviewCount: 147,
      amenities: [
        "Kitchen",
        "Laundry",
        "Smart TV",
      ],
    },
  ];
}

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

function buildReadinessGroups(
  values: InvestmentWorkspaceValues,
): readonly DecisionReadinessGroup[] {
  return [
    {
      id: "property",
      label: "Property details",
      isComplete:
        Boolean(values.address1.trim()) &&
        Boolean(values.city.trim()) &&
        Boolean(values.state.trim()) &&
        Boolean(values.postalCode.trim()) &&
        isPositiveNumber(
          values.purchasePrice,
        ) &&
        isPositiveNumber(values.bedrooms) &&
        isPositiveNumber(values.bathrooms) &&
        isPositiveNumber(
          values.squareFeet,
        ),
    },
    {
      id: "financing",
      label: "Financing structure",
      isComplete:
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
        ),
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

export function InvestmentWorkspaceStateProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [values, setValues] =
    useState<InvestmentWorkspaceValues>(
      DEFAULT_VALUES,
    );

  const [decision, setDecision] =
    useState<InvestmentDecision | null>(
      null,
    );

  const [isAnalyzing, setIsAnalyzing] =
    useState(false);

  const [analysisError, setAnalysisError] =
    useState<string | null>(null);

  const readinessGroups =
    useMemo(
      () =>
        buildReadinessGroups(values),
      [values],
    );

  const completedReadinessCount =
    readinessGroups.filter(
      ({ isComplete }) => isComplete,
    ).length;

  const totalReadinessCount =
    readinessGroups.length;

  const isReadyForAnalysis =
    completedReadinessCount ===
    totalReadinessCount;

  const generateInvestmentDecision =
    useCallback(async () => {
      if (!isReadyForAnalysis) {
        setAnalysisError(
          "Complete all required acquisition assumptions before generating the decision.",
        );

        return;
      }

      setIsAnalyzing(true);
      setAnalysisError(null);

      try {
        await new Promise((resolve) =>
          window.setTimeout(resolve, 700),
        );

        const report =
          buildInvestmentReport({
            property: {
              id: "workspace-opportunity",
              address1:
                values.address1,
              city: values.city,
              state: values.state,
              postalCode:
                values.postalCode,
              purchasePrice:
                values.purchasePrice,
              closingCosts:
                values.closingCosts,
              furnishingBudget:
                values.furnishingBudget,
              propertyType:
                values.propertyType,
              bedrooms:
                values.bedrooms,
              bathrooms:
                values.bathrooms,
              squareFeet:
                values.squareFeet,
            },
            financing: {
              downPaymentPercentage:
                values
                  .downPaymentPercentage,
              interestRatePercentage:
                values
                  .interestRatePercentage,
              loanTermYears:
                values.loanTermYears,
            },
            revenue: {
              projectedAdr:
                values.projectedAdr,
              projectedOccupancyPercentage:
                values
                  .projectedOccupancyPercentage,
              averageLengthOfStay:
                values
                  .averageLengthOfStay,
              confidencePercentage: 80,
            },
            operating: {
              managementFeePercentage:
                values
                  .managementFeePercentage,
              monthlyUtilities:
                values.monthlyUtilities,
              annualInsurance:
                values.annualInsurance,
              annualTaxes:
                values.annualTaxes,
              annualCleaning:
                values.annualCleaning,
              annualSoftware:
                values.annualSoftware,
              annualSupplies:
                values.annualSupplies,
              maintenanceReservePercentage:
                values
                  .maintenanceReservePercentage,
              capitalReservePercentage:
                values
                  .capitalReservePercentage,
            },
            market: {
              name:
                values.city || "Market",
              submarket:
                values.address1,
              medianAdr: 180,
              medianOccupancyPercentage:
                70,
              trend:
                MarketTrend.Stable,
            },
            comparables:
              createWorkspaceComparables(
                values,
              ),
          });

        setDecision(report);
      } catch (error) {
        setDecision(null);

        setAnalysisError(
          error instanceof Error
            ? error.message
            : "Investment analysis could not be generated.",
        );
      } finally {
        setIsAnalyzing(false);
      }
    }, [
      values,
      isReadyForAnalysis,
    ]);

  const contextValue =
    useMemo(
      () => ({
        values,
        setValues,
        readinessGroups,
        completedReadinessCount,
        totalReadinessCount,
        isReadyForAnalysis,
        decision,
        isAnalyzing,
        analysisError,
        generateInvestmentDecision,
      }),
      [
        values,
        readinessGroups,
        completedReadinessCount,
        totalReadinessCount,
        isReadyForAnalysis,
        decision,
        isAnalyzing,
        analysisError,
        generateInvestmentDecision,
      ],
    );

  return (
    <InvestmentWorkspaceContext.Provider
      value={contextValue}
    >
      {children}
    </InvestmentWorkspaceContext.Provider>
  );
}

export function useInvestmentWorkspaceState() {
  const context =
    useContext(
      InvestmentWorkspaceContext,
    );

  if (!context) {
    throw new Error(
      "useInvestmentWorkspaceState must be used within InvestmentWorkspaceStateProvider.",
    );
  }

  return context;
}
