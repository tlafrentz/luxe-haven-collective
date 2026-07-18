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
  AcquisitionType,
  MarketTrend,
  PropertyType,
} from "../domain";

import type {
  ComparableProperty,
  InvestmentDecision,
  RentalArbitrageInvestmentAnalysis,
} from "../domain";

import {
  buildInvestmentReport,
} from "../services";

import {
  buildInvestmentWorkspaceReadiness,
} from "./investment-workspace-readiness";

import type {
  DecisionReadinessGroup,
} from "./investment-workspace-readiness";

export type InvestmentWorkspaceValues = {
  readonly acquisitionType: AcquisitionType;

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

export type WorkspaceInvestmentAnalysis =
  | InvestmentDecision
  | RentalArbitrageInvestmentAnalysis;

type InvestmentWorkspaceState = {
  values: InvestmentWorkspaceValues;
  setValues: Dispatch<
    SetStateAction<InvestmentWorkspaceValues>
  >;
  setAcquisitionType: (
    acquisitionType: AcquisitionType,
  ) => void;

  readinessGroups: readonly DecisionReadinessGroup[];
  completedReadinessCount: number;
  totalReadinessCount: number;
  isReadyForAnalysis: boolean;

  analysis: WorkspaceInvestmentAnalysis | null;
  hasStaleAnalysis: boolean;
  isAnalyzing: boolean;
  analysisError: string | null;

  analyzeInvestment: () => Promise<void>;
};

const DEFAULT_VALUES: InvestmentWorkspaceValues = {
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

export function InvestmentWorkspaceStateProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [values, setWorkspaceValues] =
    useState<InvestmentWorkspaceValues>(
      DEFAULT_VALUES,
    );

  const [analysis, setAnalysis] =
    useState<WorkspaceInvestmentAnalysis | null>(
      null,
    );

  const [
    isAnalysisStale,
    setIsAnalysisStale,
  ] = useState(false);

  const [isAnalyzing, setIsAnalyzing] =
    useState(false);

  const [analysisError, setAnalysisError] =
    useState<string | null>(null);

  const setValues = useCallback<
    Dispatch<
      SetStateAction<InvestmentWorkspaceValues>
    >
  >((nextValues) => {
    setWorkspaceValues(nextValues);
    setIsAnalysisStale(true);
    setAnalysisError(null);
  }, []);

  const setAcquisitionType =
    useCallback(
      (
        acquisitionType:
          AcquisitionType,
      ) => {
        setValues((current) => ({
          ...current,
          acquisitionType,
        }));
      },
      [setValues],
    );

  const readinessGroups =
    useMemo(
      () =>
        buildInvestmentWorkspaceReadiness(
          values,
        ),
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

  const hasStaleAnalysis =
    analysis !== null &&
    isAnalysisStale;

  const analyzeInvestment =
    useCallback(async () => {
      if (!isReadyForAnalysis) {
        setAnalysisError(
          "Complete all required acquisition assumptions before analyzing the investment.",
        );

        return;
      }

      setIsAnalyzing(true);
      setAnalysisError(null);

      try {
        await new Promise((resolve) =>
          window.setTimeout(resolve, 700),
        );

        const sharedInput = {
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
        } as const;

        if (
          values.acquisitionType ===
          AcquisitionType.RentalArbitrage
        ) {
          const report =
            buildInvestmentReport({
              acquisitionType:
                AcquisitionType.RentalArbitrage,
              property: {
                id: "workspace-opportunity",
                address1:
                  values.address1,
                city: values.city,
                state: values.state,
                postalCode:
                  values.postalCode,
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
              lease: {
                monthlyLease:
                  values.monthlyLease,
                securityDeposit:
                  values.securityDeposit,
                leaseTermMonths:
                  values.leaseTermMonths,
                startupCosts:
                  values.startupCosts,
                utilitiesIncluded:
                  values.utilitiesIncluded,
              },
              operating: {
                managementFeePercentage:
                  values
                    .managementFeePercentage,
                monthlyUtilities:
                  values.monthlyUtilities,
                annualInsurance:
                  values.annualInsurance,
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
              ...sharedInput,
            });

          setAnalysis(report);
          setIsAnalysisStale(false);

          return;
        }

        const report =
          buildInvestmentReport({
            acquisitionType:
              AcquisitionType.Purchase,
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
            ...sharedInput,
          });

        setAnalysis(report);
        setIsAnalysisStale(false);
      } catch (error) {
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
        setAcquisitionType,
        readinessGroups,
        completedReadinessCount,
        totalReadinessCount,
        isReadyForAnalysis,
        analysis,
        hasStaleAnalysis,
        isAnalyzing,
        analysisError,
        analyzeInvestment,
      }),
      [
        values,
        setValues,
        setAcquisitionType,
        readinessGroups,
        completedReadinessCount,
        totalReadinessCount,
        isReadyForAnalysis,
        analysis,
        hasStaleAnalysis,
        isAnalyzing,
        analysisError,
        analyzeInvestment,
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
