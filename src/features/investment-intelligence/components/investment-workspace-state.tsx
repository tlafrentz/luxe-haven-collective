"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";

import { analyzeInvestmentWorkspace } from "@/app/actions/investment-workspace";
import type { MarketAnalysisReport, MarketPropertyResolutionResult } from "@/features/market-intelligence";

import { AcquisitionType, MarketTrend, PropertyType } from "../domain";
import type { InvestmentLifecycleResult } from "../domain";
import type { InvestmentAnalysisContext, InvestmentDecisionAnalysisTransportDto, InvestmentMarketContext, InvestmentWorkspaceStage, RunInvestmentAnalysisCommand } from "../application";
import { acceptMarketAssumption, overrideMarketAssumption, proposeMarketAssumptions, restoreMarketAssumption } from "../application";
import type { InvestmentAnalysisMarketContext, MarketAssumptionSelections } from "../application";
import { applyStrategyTransition, buildStrategyTransitionPlan, classifyInvestmentWorkspaceFailure, type InvestmentWorkspaceLifecycleState, type StrategyTransitionPlan } from "../application";
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
export type CurrentInvestmentAnalysisState =
  | Readonly<{ status: "idle" }>
  | Readonly<{ status: "running" }>
  | Readonly<{ status: "failed"; error: string }>
  | Readonly<{ status: "completed"; analysisId: string; saveToken: string; analyzedAt: string; expiresAt: string; route: "purchase" | "rental-arbitrage"; result: WorkspaceInvestmentAnalysis }>;

type InvestmentWorkspaceState = Readonly<{
  values: InvestmentWorkspaceValues;
  setValues: Dispatch<SetStateAction<InvestmentWorkspaceValues>>;
  setAcquisitionType: (acquisitionType: AcquisitionType) => void;
  pendingStrategyTransition: StrategyTransitionPlan | null;
  confirmStrategyTransition: () => void;
  cancelStrategyTransition: () => void;
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
  decisionAnalysis: InvestmentDecisionAnalysisTransportDto | null;
  analysisSaveToken: string | null;
  analyzedAt: Date | null;
  hasStaleAnalysis: boolean;
  isAnalyzing: boolean;
  analysisError: string | null;
  lifecycle: InvestmentWorkspaceLifecycleState<Extract<CurrentInvestmentAnalysisState, { status: "completed" }>>;
  currentAnalysis: CurrentInvestmentAnalysisState;
  strMarketContext: InvestmentAnalysisMarketContext | null;
  strAssumptions: MarketAssumptionSelections | null;
  acceptStrAssumption: (key: keyof MarketAssumptionSelections) => void;
  overrideStrAssumption: (key: keyof MarketAssumptionSelections, value: number) => void;
  restoreStrAssumption: (key: keyof MarketAssumptionSelections) => void;
  analyzeInvestment: () => Promise<void>;
  draftPersistence: Readonly<{ status: "restoring" | "saving" | "saved" | "failed" | "unavailable"; savedAt: Date | null }>;
  clearDraft: () => void;
}>;

export const DEFAULT_INVESTMENT_WORKSPACE_VALUES: InvestmentWorkspaceValues = {
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

const DRAFT_SCHEMA_VERSION = "investment-workspace-draft.v1";

export function InvestmentWorkspaceStateProvider({ children, initialValues, initialMarketContext, draftScope }: { children: ReactNode; initialValues?: Partial<InvestmentWorkspaceValues>; initialMarketContext?: InvestmentAnalysisMarketContext; draftScope?: string }) {
  const [values, setWorkspaceValues] = useState<InvestmentWorkspaceValues>({ ...DEFAULT_INVESTMENT_WORKSPACE_VALUES, ...initialValues });
  const [draftReady, setDraftReady] = useState(!draftScope || Boolean(initialValues));
  const [draftPersistence, setDraftPersistence] = useState<InvestmentWorkspaceState["draftPersistence"]>({ status: draftScope ? "restoring" : "unavailable", savedAt: null });
  const [result, setResult] = useState<Extract<Awaited<ReturnType<typeof analyzeInvestmentWorkspace>>, { ok: true }>["result"] | null>(null);
  const [analysisSaveToken, setAnalysisSaveToken] = useState<string | null>(null);
  const [analyzedAt, setAnalyzedAt] = useState<Date | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [stage, setStage] = useState<InvestmentWorkspaceStage>("setup");
  const [isAnalysisStale, setIsAnalysisStale] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [propertyAlternatives, setPropertyAlternatives] = useState<MarketPropertyResolutionResult["alternatives"]>([]);
  const [pendingStrategyTransition, setPendingStrategyTransition] = useState<StrategyTransitionPlan | null>(null);
  const [strMarketContext] = useState<InvestmentAnalysisMarketContext | null>(initialMarketContext ?? null);
  const [strAssumptions, setStrAssumptions] = useState<MarketAssumptionSelections | null>(() => initialMarketContext?.snapshot ? proposeMarketAssumptions(initialMarketContext.snapshot) : null);
  const requestSequence = useRef(0);
  const draftKey = draftScope ? `luxe-haven:${DRAFT_SCHEMA_VERSION}:${draftScope}` : null;

  useEffect(() => {
    if (!draftKey || !draftScope || initialValues) return;
    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(draftKey);
        if (raw) {
          const stored = JSON.parse(raw) as { schemaVersion?: string; ownerScope?: string; savedAt?: string; values?: Partial<InvestmentWorkspaceValues> };
          if (stored.schemaVersion === DRAFT_SCHEMA_VERSION && stored.ownerScope === draftScope && stored.values && isDraftValues(stored.values)) {
            setWorkspaceValues({ ...DEFAULT_INVESTMENT_WORKSPACE_VALUES, ...stored.values });
            setDraftPersistence({ status: "saved", savedAt: stored.savedAt ? new Date(stored.savedAt) : null });
          } else {
            window.localStorage.removeItem(draftKey);
            setDraftPersistence({ status: "failed", savedAt: null });
          }
        } else {
          setDraftPersistence({ status: "saved", savedAt: null });
        }
      } catch {
        setDraftPersistence({ status: "failed", savedAt: null });
      } finally {
        setDraftReady(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [draftKey, draftScope, initialValues]);

  useEffect(() => {
    if (!draftKey || !draftScope || !draftReady) return;
    const timer = window.setTimeout(() => {
      try {
        const savedAt = new Date();
        window.localStorage.setItem(draftKey, JSON.stringify({ schemaVersion: DRAFT_SCHEMA_VERSION, ownerScope: draftScope, savedAt: savedAt.toISOString(), values }));
        setDraftPersistence({ status: "saved", savedAt });
      } catch {
        setDraftPersistence(current => ({ ...current, status: "failed" }));
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [draftKey, draftScope, draftReady, values]);
  useEffect(() => {
    const restoreRouteFromHistory = () => {
      const route = new URL(window.location.href).searchParams.get("strategy");
      if (route !== AcquisitionType.Purchase && route !== AcquisitionType.RentalArbitrage) return;
      setWorkspaceValues(current => current.acquisitionType === route ? current : applyStrategyTransition(current, route, DEFAULT_INVESTMENT_WORKSPACE_VALUES) as InvestmentWorkspaceValues);
      requestSequence.current += 1; setResult(null); setAnalysisSaveToken(null); setAnalyzedAt(null); setIsAnalysisStale(false); setAnalysisError(null); setPropertyAlternatives([]); setStage("setup"); setPendingStrategyTransition(null);
    };
    window.addEventListener("popstate", restoreRouteFromHistory);
    return () => window.removeEventListener("popstate", restoreRouteFromHistory);
  }, []);

  const setValues = useCallback<Dispatch<SetStateAction<InvestmentWorkspaceValues>>>((next) => {
    requestSequence.current += 1;
    if (draftKey) setDraftPersistence(current => ({ ...current, status: "saving" }));
    setWorkspaceValues(next);
    setIsAnalysisStale(true);
    setAnalysisSaveToken(null);
    setAnalysisError(null);
    setPropertyAlternatives([]);
    setStage("setup");
  }, [draftKey]);
  const setAcquisitionType = useCallback((acquisitionType: AcquisitionType) => {
    if (acquisitionType === values.acquisitionType) return;
    const plan = buildStrategyTransitionPlan(values, acquisitionType, DEFAULT_INVESTMENT_WORKSPACE_VALUES, result !== null);
    if (plan.requiresConfirmation) setPendingStrategyTransition(plan);
    else {
      requestSequence.current += 1;
      setWorkspaceValues(applyStrategyTransition(values, acquisitionType, DEFAULT_INVESTMENT_WORKSPACE_VALUES) as InvestmentWorkspaceValues);
      setResult(null); setAnalysisSaveToken(null); setAnalyzedAt(null); setIsAnalysisStale(false); setAnalysisError(null); setStage("setup");
      window.history.pushState({}, "", `/dashboard/investments?strategy=${acquisitionType}`);
    }
  }, [values, result]);
  const confirmStrategyTransition = useCallback(() => {
    if (!pendingStrategyTransition) return;
    requestSequence.current += 1;
    setWorkspaceValues(applyStrategyTransition(values, pendingStrategyTransition.to, DEFAULT_INVESTMENT_WORKSPACE_VALUES) as InvestmentWorkspaceValues);
    setResult(null); setAnalysisSaveToken(null); setAnalyzedAt(null); setIsAnalysisStale(false); setAnalysisError(null); setPropertyAlternatives([]); setStage("setup");
    window.history.pushState({}, "", `/dashboard/investments?strategy=${pendingStrategyTransition.to}`);
    setPendingStrategyTransition(null);
  }, [pendingStrategyTransition, values]);
  const cancelStrategyTransition = useCallback(() => setPendingStrategyTransition(null), []);
  const readinessGroups = useMemo(() => buildInvestmentWorkspaceReadiness(values), [values]);
  const completedReadinessCount = readinessGroups.filter(({ isComplete }) => isComplete).length;
  const totalReadinessCount = readinessGroups.length;
  const isReadyForAnalysis = completedReadinessCount === totalReadinessCount;
  const updateStrAssumption = useCallback((key: keyof MarketAssumptionSelections, operation: "accept" | "restore" | "override", value?: number) => {
    setStrAssumptions(current => {
      if (!current) return current;
      const next = operation === "accept" ? acceptMarketAssumption(current[key])
        : operation === "restore" ? restoreMarketAssumption(current[key])
          : overrideMarketAssumption(current[key], value!);
      if ((key === "adr" || key === "occupancy") && next.value !== undefined) {
        const rounded = Math.round(next.value * 100) / 100;
        setWorkspaceValues(values => ({
          ...values, ...(key === "adr" ? { projectedAdr: rounded } : { projectedOccupancyPercentage: rounded }),
        }));
      }
      return { ...current, [key]: next };
    });
  }, []);
  const acceptStrAssumption = useCallback((key: keyof MarketAssumptionSelections) => updateStrAssumption(key, "accept"), [updateStrAssumption]);
  const overrideStrAssumption = useCallback((key: keyof MarketAssumptionSelections, value: number) => updateStrAssumption(key, "override", value), [updateStrAssumption]);
  const restoreStrAssumption = useCallback((key: keyof MarketAssumptionSelections) => updateStrAssumption(key, "restore"), [updateStrAssumption]);

  const analyzeInvestment = useCallback(async () => {
    if (!isReadyForAnalysis) {
      setAnalysisError("Complete the property address and required assumptions before analyzing the investment.");
      return;
    }
    const sequence = ++requestSequence.current;
    setStage("resolving-property");
    setAnalysisError(null);
    let response: Awaited<ReturnType<typeof analyzeInvestmentWorkspace>>;
    try {
      response = await analyzeInvestmentWorkspace({
        clientRequestId: `client:${sequence}`,
        ...(strMarketContext?.marketSnapshotId ? { marketSnapshotId: strMarketContext.marketSnapshotId } : {}),
        address: { streetAddress: values.address1, city: values.city, state: values.state, postalCode: values.postalCode, countryCode: "US" },
        investmentInput: buildInvestmentInput(values),
        userProvidedAssumptionKeys: userAssumptionKeys(values.acquisitionType),
        marketRequest: {
          saleValuation: values.acquisitionType === AcquisitionType.Purchase,
          longTermRent: true,
        },
      });
    } catch {
      if (sequence !== requestSequence.current) return;
      setStage("error");
      setAnalysisError("The analysis response could not be received. Your previous analysis and assumptions were preserved. Try again.");
      setPropertyAlternatives([]);
      return;
    }
    if (sequence !== requestSequence.current) return;
    if (!response.ok) {
      setStage("error");
      setAnalysisError(response.error.message);
      setPropertyAlternatives(response.error.alternatives ?? []);
      return;
    }
    setResult(response.result);
    setAnalysisId(response.analysisId);
    setAnalysisSaveToken(response.analysisSaveToken);
    setAnalyzedAt(response.analyzedAt);
    setExpiresAt(response.expiresAt);
    setStage("decision-review");
    setIsAnalysisStale(false);
  }, [isReadyForAnalysis, values, strMarketContext]);

  const clearDraft = useCallback(() => {
    requestSequence.current += 1;
    if (draftKey) {
      try { window.localStorage.removeItem(draftKey); } catch { /* The in-memory draft can still be cleared. */ }
    }
    setWorkspaceValues(DEFAULT_INVESTMENT_WORKSPACE_VALUES);
    setResult(null); setAnalysisId(null); setAnalysisSaveToken(null); setAnalyzedAt(null); setExpiresAt(null);
    setStage("setup"); setIsAnalysisStale(false); setAnalysisError(null); setPropertyAlternatives([]); setPendingStrategyTransition(null);
    setDraftPersistence({ status: draftKey ? "saved" : "unavailable", savedAt: null });
  }, [draftKey]);

  const currentAnalysis = useMemo<CurrentInvestmentAnalysisState>(() => {
    if (analysisError) return { status: "failed", error: analysisError };
    if (stage === "resolving-property" || stage === "running-market-analysis" || stage === "running-investment-analysis") return { status: "running" };
    if (!result || isAnalysisStale || !analysisId || !analysisSaveToken || !analyzedAt || !expiresAt) return { status: "idle" };
    return { status: "completed", analysisId, saveToken: analysisSaveToken, analyzedAt: analyzedAt.toISOString(), expiresAt: expiresAt.toISOString(), route: result.lifecycleResult.acquisitionType, result: result.lifecycleResult };
  }, [analysisError, stage, result, isAnalysisStale, analysisId, analysisSaveToken, analyzedAt, expiresAt]);
  const lifecycle = useMemo<InvestmentWorkspaceState["lifecycle"]>(() => {
    if (currentAnalysis.status === "completed") return { status: "succeeded", analysis: currentAnalysis };
    if (currentAnalysis.status === "running") return { status: "running", stage };
    if (currentAnalysis.status === "failed") {
      const code = currentAnalysis.error.toLowerCase().includes("market") ? "MARKET_INTELLIGENCE_UNAVAILABLE" : "UNKNOWN";
      return { status: "failed", kind: classifyInvestmentWorkspaceFailure(code), code, message: currentAnalysis.error };
    }
    return isReadyForAnalysis ? { status: "ready" } : { status: "idle" };
  }, [currentAnalysis, stage, isReadyForAnalysis]);

  const contextValue = useMemo<InvestmentWorkspaceState>(() => ({
    values, setValues, setAcquisitionType, pendingStrategyTransition, confirmStrategyTransition, cancelStrategyTransition, readinessGroups, completedReadinessCount, totalReadinessCount,
    isReadyForAnalysis, stage,
    propertyResolution: result?.propertyResolution ?? null,
    propertyAlternatives,
    marketReport: result?.marketReport ?? null,
    investmentMarketContext: result?.investmentMarketContext ?? null,
    investmentAnalysisContext: result?.investmentAnalysisContext ?? null,
    analysis: result?.lifecycleResult ?? null,
    decisionAnalysis: result?.decisionAnalysis ?? null,
    analysisSaveToken,
    analyzedAt,
    hasStaleAnalysis: result !== null && isAnalysisStale,
    isAnalyzing: stage === "resolving-property" || stage === "running-market-analysis" || stage === "running-investment-analysis",
    analysisError, lifecycle, currentAnalysis, strMarketContext, strAssumptions, acceptStrAssumption, overrideStrAssumption, restoreStrAssumption, analyzeInvestment, draftPersistence, clearDraft,
  }), [values, setValues, setAcquisitionType, pendingStrategyTransition, confirmStrategyTransition, cancelStrategyTransition, readinessGroups, completedReadinessCount, totalReadinessCount, isReadyForAnalysis, stage, result, analysisSaveToken, analyzedAt, propertyAlternatives, isAnalysisStale, analysisError, lifecycle, currentAnalysis, strMarketContext, strAssumptions, acceptStrAssumption, overrideStrAssumption, restoreStrAssumption, analyzeInvestment, draftPersistence, clearDraft]);

  return <InvestmentWorkspaceContext.Provider value={contextValue}>{children}</InvestmentWorkspaceContext.Provider>;
}

function isDraftValues(values: Partial<InvestmentWorkspaceValues>): boolean {
  return (values.acquisitionType === AcquisitionType.Purchase || values.acquisitionType === AcquisitionType.RentalArbitrage)
    && (values.address1 === undefined || typeof values.address1 === "string")
    && (values.projectedAdr === undefined || typeof values.projectedAdr === "number")
    && (values.projectedOccupancyPercentage === undefined || typeof values.projectedOccupancyPercentage === "number");
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
