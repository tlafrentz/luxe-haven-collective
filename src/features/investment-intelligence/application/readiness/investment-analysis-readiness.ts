import {
  AcquisitionType,
} from "../../domain";

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

export type InvestmentReadinessIssue = Readonly<{ code: string; severity: "blocking" | "warning" | "information"; title: string; description: string; fieldId?: string }>;
export type AnalysisCapabilityReadiness = Readonly<{ available: boolean; blockers: readonly InvestmentReadinessIssue[]; warnings: readonly InvestmentReadinessIssue[] }>;
export type InvestmentAnalysisReadiness = Readonly<{ route: AcquisitionType; preview: AnalysisCapabilityReadiness; fullAnalysis: AnalysisCapabilityReadiness; requiredMissingInputs: readonly InvestmentReadinessIssue[]; invalidAssumptions: readonly InvestmentReadinessIssue[]; optionalDataGaps: readonly InvestmentReadinessIssue[]; unavailableIntegrations: readonly InvestmentReadinessIssue[]; routeIncompatibilities: readonly InvestmentReadinessIssue[]; resultState: "draft" | "ready" | "running" | "complete" | "stale" | "blocked" | "failed" }>;

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

export function buildInvestmentAnalysisReadiness(values: InvestmentWorkspaceReadinessValues, state: Readonly<{ running?: boolean; complete?: boolean; stale?: boolean; failed?: boolean; integrationAvailable?: boolean }> = {}): InvestmentAnalysisReadiness {
  const groups = buildInvestmentWorkspaceReadiness(values);
  const requiredMissingInputs = groups.filter(group => !group.isComplete).map(group => Object.freeze({ code: `MISSING_${group.id.toUpperCase()}`, severity: "blocking" as const, title: `${group.label} incomplete`, description: `Complete the ${group.label.toLowerCase()} before running the full analysis.`, fieldId: group.id }));
  const unavailableIntegrations = state.integrationAvailable === false ? [Object.freeze({ code: "MARKET_INTEGRATION_UNAVAILABLE", severity: "blocking" as const, title: "Market evidence is temporarily unavailable", description: "Your assumptions are preserved. Retry when Market evidence is available." })] : [];
  const blockers = Object.freeze([...requiredMissingInputs, ...unavailableIntegrations]);
  const resultState = state.running ? "running" : state.stale ? "stale" : state.complete ? "complete" : state.failed ? "failed" : unavailableIntegrations.length ? "blocked" : blockers.length ? "draft" : "ready";
  return Object.freeze({ route: values.acquisitionType, preview: Object.freeze({ available: groups.filter(group => group.id === "revenue" || group.id === "operating").every(group => group.isComplete), blockers: Object.freeze(requiredMissingInputs.filter(issue => issue.fieldId === "revenue" || issue.fieldId === "operating")), warnings: Object.freeze([]) }), fullAnalysis: Object.freeze({ available: blockers.length === 0 && !state.running, blockers, warnings: Object.freeze([]) }), requiredMissingInputs: Object.freeze(requiredMissingInputs), invalidAssumptions: Object.freeze([]), optionalDataGaps: Object.freeze([]), unavailableIntegrations: Object.freeze(unavailableIntegrations), routeIncompatibilities: Object.freeze([]), resultState });
}
