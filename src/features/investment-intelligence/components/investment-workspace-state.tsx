"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";

import { analyzeInvestmentWorkspace } from "@/app/actions/investment-workspace";
import type { MarketAnalysisReport, MarketPropertyResolutionResult } from "@/features/market-intelligence";

import { AcquisitionType, MarketTrend, PropertyType } from "../domain";
import type { InvestmentLifecycleResult } from "../domain";
import type { InvestmentAnalysisContext, InvestmentMarketContext, InvestmentWorkspaceStage, RunInvestmentAnalysisCommand } from "../application";
import { buildInvestmentWorkspaceReadiness } from "./investment-workspace-readiness";
import type { DecisionReadinessGroup } from "./investment-workspace-readiness";

export type InvestmentWorkspaceValues = Readonly<{
  acquisitionType: AcquisitionType;
  address1: string; city: string; state: string; postalCode: string;
  purchasePrice: number; closingCosts: number; furnishingBudget: number;
  propertyType: PropertyType; bedrooms: number; bathrooms: number; squareFeet: number;
  downPaymentPercentage: number; interestRatePercentage: number; loanTermYears: number;
  monthlyLease: number; securityDeposit: number; leaseTermMonths: number; startupCosts: number; utilitiesIncluded: boolean;
  projectedAdr: number; projectedOccupancyPercentage: number; averageLengthOfStay: number;
  managementFeePercentage: number; monthlyUtilities: number; annualInsurance: number; annualTaxes: number;
  annualCleaning: number; annualSoftware: number; annualSupplies: number;
  maintenanceReservePercentage: number; capitalReservePercentage: number;
}>;

export type WorkspaceInvestmentAnalysis = InvestmentLifecycleResult;

type InvestmentWorkspaceState = Readonly<{
  values: InvestmentWorkspaceValues;
  setValues: Dispatch<SetStateAction<InvestmentWorkspaceValues>>;
  setAcquisitionType: (acquisitionType: AcquisitionType) => void;
  readinessGroups: readonly DecisionReadinessGroup[];
  completedReadinessCount: number;
  totalReadinessCount: number;
  isReadyForAnalysis: boolean;
  stage: InvestmentWorkspaceStage;
  propertyResolution: MarketPropertyResolutionResult | null;
  propertyAlternatives: MarketPropertyResolutionResult["alternatives"];
  marketReport: MarketAnalysisReport | null;
  investmentMarketContext: InvestmentMarketContext | null;
  investmentAnalysisContext: InvestmentAnalysisContext | null;
  analysis: WorkspaceInvestmentAnalysis | null;
  analysisSaveToken: string | null;
  analyzedAt: Date | null;
  hasStaleAnalysis: boolean;
  isAnalyzing: boolean;
  analysisError: string | null;
  analyzeInvestment: () => Promise<void>;
}>;

const DEFAULT_VALUES: InvestmentWorkspaceValues = {
  acquisitionType: AcquisitionType.Purchase,
  address1: "", city: "", state: "", postalCode: "",
  purchasePrice: 425000, closingCosts: 12000, furnishingBudget: 25000,
  propertyType: PropertyType.Apartment, bedrooms: 2, bathrooms: 1, squareFeet: 950,
  downPaymentPercentage: 25, interestRatePercentage: 6.5, loanTermYears: 30,
  monthlyLease: 2400, securityDeposit: 2400, leaseTermMonths: 12, startupCosts: 5000, utilitiesIncluded: false,
  projectedAdr: 200, projectedOccupancyPercentage: 75, averageLengthOfStay: 4,
  managementFeePercentage: 10, monthlyUtilities: 300, annualInsurance: 1800, annualTaxes: 4200,
  annualCleaning: 7200, annualSoftware: 1200, annualSupplies: 1800,
  maintenanceReservePercentage: 5, capitalReservePercentage: 3,
};

const InvestmentWorkspaceContext = createContext<InvestmentWorkspaceState | null>(null);

export function InvestmentWorkspaceStateProvider({ children, initialValues }: { children: ReactNode; initialValues?: Partial<InvestmentWorkspaceValues> }) {
  const [values, setWorkspaceValues] = useState<InvestmentWorkspaceValues>({ ...DEFAULT_VALUES, ...initialValues });
  const [result, setResult] = useState<Extract<Awaited<ReturnType<typeof analyzeInvestmentWorkspace>>, { ok: true }>["result"] | null>(null);
  const [analysisSaveToken, setAnalysisSaveToken] = useState<string | null>(null);
  const [analyzedAt, setAnalyzedAt] = useState<Date | null>(null);
  const [stage, setStage] = useState<InvestmentWorkspaceStage>("setup");
  const [isAnalysisStale, setIsAnalysisStale] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [propertyAlternatives, setPropertyAlternatives] = useState<MarketPropertyResolutionResult["alternatives"]>([]);
  const requestSequence = useRef(0);

  const setValues = useCallback<Dispatch<SetStateAction<InvestmentWorkspaceValues>>>((next) => {
    requestSequence.current += 1;
    setWorkspaceValues(next);
    setIsAnalysisStale(true);
    setAnalysisError(null);
    setPropertyAlternatives([]);
    setStage("setup");
  }, []);
  const setAcquisitionType = useCallback((acquisitionType: AcquisitionType) => {
    setValues((current) => ({ ...current, acquisitionType }));
  }, [setValues]);
  const readinessGroups = useMemo(() => buildInvestmentWorkspaceReadiness(values), [values]);
  const completedReadinessCount = readinessGroups.filter(({ isComplete }) => isComplete).length;
  const totalReadinessCount = readinessGroups.length;
  const isReadyForAnalysis = completedReadinessCount === totalReadinessCount;

  const analyzeInvestment = useCallback(async () => {
    if (!isReadyForAnalysis) {
      setAnalysisError("Complete the property address and required assumptions before analyzing the investment.");
      return;
    }
    const sequence = ++requestSequence.current;
    setStage("resolving-property");
    setAnalysisError(null);
    const response = await analyzeInvestmentWorkspace({
      clientRequestId: `client:${sequence}`,
      address: { streetAddress: values.address1, city: values.city, state: values.state, postalCode: values.postalCode, countryCode: "US" },
      investmentInput: buildInvestmentInput(values),
      userProvidedAssumptionKeys: userAssumptionKeys(values.acquisitionType),
      marketRequest: {
        saleValuation: values.acquisitionType === AcquisitionType.Purchase,
        longTermRent: true,
      },
    });
    if (sequence !== requestSequence.current) return;
    if (!response.ok) {
      setStage("error");
      setAnalysisError(response.error.message);
      setPropertyAlternatives(response.error.alternatives ?? []);
      return;
    }
    setResult(response.result);
    setAnalysisSaveToken(response.analysisSaveToken);
    setAnalyzedAt(response.analyzedAt);
    setStage("decision-review");
    setIsAnalysisStale(false);
  }, [isReadyForAnalysis, values]);

  const contextValue = useMemo<InvestmentWorkspaceState>(() => ({
    values, setValues, setAcquisitionType, readinessGroups, completedReadinessCount, totalReadinessCount,
    isReadyForAnalysis, stage,
    propertyResolution: result?.propertyResolution ?? null,
    propertyAlternatives,
    marketReport: result?.marketReport ?? null,
    investmentMarketContext: result?.investmentMarketContext ?? null,
    investmentAnalysisContext: result?.investmentAnalysisContext ?? null,
    analysis: result?.lifecycleResult ?? null,
    analysisSaveToken,
    analyzedAt,
    hasStaleAnalysis: result !== null && isAnalysisStale,
    isAnalyzing: stage === "resolving-property" || stage === "running-market-analysis" || stage === "running-investment-analysis",
    analysisError, analyzeInvestment,
  }), [values, setValues, setAcquisitionType, readinessGroups, completedReadinessCount, totalReadinessCount, isReadyForAnalysis, stage, result, analysisSaveToken, analyzedAt, propertyAlternatives, isAnalysisStale, analysisError, analyzeInvestment]);

  return <InvestmentWorkspaceContext.Provider value={contextValue}>{children}</InvestmentWorkspaceContext.Provider>;
}

function buildInvestmentInput(values: InvestmentWorkspaceValues): RunInvestmentAnalysisCommand {
  const shared = {
    revenue: { projectedAdr: values.projectedAdr, projectedOccupancyPercentage: values.projectedOccupancyPercentage, averageLengthOfStay: values.averageLengthOfStay, confidencePercentage: 80 },
    market: { name: values.city, submarket: values.address1, medianAdr: values.projectedAdr, medianOccupancyPercentage: values.projectedOccupancyPercentage, trend: MarketTrend.Stable },
    comparables: [],
  } as const;
  const property = {
    id: "workspace-pending-subject", address1: values.address1, city: values.city, state: values.state, postalCode: values.postalCode,
    furnishingBudget: values.furnishingBudget, propertyType: values.propertyType, bedrooms: values.bedrooms, bathrooms: values.bathrooms, squareFeet: values.squareFeet,
  };
  const operating = {
    managementFeePercentage: values.managementFeePercentage, monthlyUtilities: values.monthlyUtilities,
    annualInsurance: values.annualInsurance, annualCleaning: values.annualCleaning, annualSoftware: values.annualSoftware,
    annualSupplies: values.annualSupplies, maintenanceReservePercentage: values.maintenanceReservePercentage,
    capitalReservePercentage: values.capitalReservePercentage,
  };
  if (values.acquisitionType === AcquisitionType.RentalArbitrage) {
    return { acquisitionType: AcquisitionType.RentalArbitrage, property, lease: {
      monthlyLease: values.monthlyLease, securityDeposit: values.securityDeposit, leaseTermMonths: values.leaseTermMonths,
      startupCosts: values.startupCosts, utilitiesIncluded: values.utilitiesIncluded,
    }, operating, ...shared };
  }
  return { acquisitionType: AcquisitionType.Purchase, property: {
    ...property, purchasePrice: values.purchasePrice, closingCosts: values.closingCosts,
  }, financing: {
    downPaymentPercentage: values.downPaymentPercentage, interestRatePercentage: values.interestRatePercentage, loanTermYears: values.loanTermYears,
  }, operating: { ...operating, annualTaxes: values.annualTaxes }, ...shared };
}

function userAssumptionKeys(route: AcquisitionType): readonly string[] {
  const shared = ["furnishing-budget", "projected-adr", "projected-occupancy-percentage", "average-length-of-stay", "management-fee-percentage", "monthly-utilities", "annual-insurance-premium", "annual-cleaning", "annual-software", "annual-supplies", "maintenance-reserve-percentage", "capital-reserve-percentage"];
  return route === AcquisitionType.Purchase
    ? [...shared, "purchase-price", "closing-costs", "down-payment-percentage", "interest-rate-percentage", "loan-term-years", "annual-property-taxes"]
    : [...shared, "monthly-lease", "security-deposit", "lease-term-months", "startup-costs", "utilities-included"];
}

export function useInvestmentWorkspaceState(): InvestmentWorkspaceState {
  const context = useContext(InvestmentWorkspaceContext);
  if (!context) throw new Error("useInvestmentWorkspaceState must be used within InvestmentWorkspaceStateProvider.");
  return context;
}
