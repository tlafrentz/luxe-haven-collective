import type { InvestmentWorkspaceValues } from "@/features/investment-intelligence";
import { AcquisitionType, PropertyType } from "@/features/investment-intelligence";
import {
  IMMUTABLE_ANALYSIS_PROJECTION_VERSION,
  type ImmutableAnalysisProjection,
} from "./immutable-analysis-projection";
import type { InvestmentOpportunityRepository } from "./ports/repository";
import { readImmutableAnalysis } from "./immutable-analysis-projection";

export type HydratedValueProvenance =
  | "saved_user_input"
  | "saved_provider_observation"
  | "saved_platform_default"
  | "saved_derived_value"
  | "current_provider_observation"
  | "current_platform_default";

export type HydratedAssumptionValue = Readonly<{
  key: string;
  value: string | number | boolean | null;
  persistedValue: string | number | boolean | null;
  provenance: HydratedValueProvenance;
  sourceVersionId: string;
  sourceTimestamp: string;
  refreshEligible: boolean;
  stale: boolean;
  explicitlyOverridden: boolean;
  overriddenValue?: string | number | boolean | null;
  overriddenSource?: string;
  unit?: string;
  currency?: "USD";
  period?: string;
  mode?: string;
  currentProviderAlternative?: string | number | boolean | null;
  currentDefaultAlternative?: string | number | boolean | null;
}>;

export type ReanalysisSourceIdentity = Readonly<{
  workspaceId: string;
  opportunityId: string;
  sourceAnalysisVersionId: string;
  sourceVersionNumber: number;
  acquisitionType: "purchase" | "rental-arbitrage";
  calculationPolicyVersion?: string;
  scoringPolicyVersion?: string;
  sourceCreatedAt: string;
  projectionContractVersion: typeof IMMUTABLE_ANALYSIS_PROJECTION_VERSION;
}>;

export type HydratedReanalysisState = Readonly<{
  mode: "reanalysis";
  source: ReanalysisSourceIdentity;
  workspaceValues: Partial<InvestmentWorkspaceValues>;
  assumptions: Readonly<Record<string, HydratedAssumptionValue>>;
  acceptedRefreshes: readonly string[];
  rejectedRefreshes: readonly string[];
  evidenceRefreshStatus: "not-requested" | "available" | "unavailable" | "partial";
  unsavedChanges: boolean;
}>;

export type ReanalysisChange = Readonly<{
  key: string;
  category: "property" | "revenue" | "financing" | "expenses" | "setup" | "reserves" | "provider-evidence" | "platform-default" | "override" | "policy";
  before: unknown;
  after: unknown;
}>;

type Field = Readonly<{
  workspaceKey: keyof InvestmentWorkspaceValues;
  category: ReanalysisChange["category"];
  refreshEligible?: boolean;
  unit?: "currency" | "percentage" | "count" | "boolean";
  period?: "nightly" | "monthly" | "annual" | "term" | "once";
  currency?: "USD";
}>;

export const REANALYSIS_ASSUMPTION_CONTRACT = Object.freeze({
  "purchase-price": field("purchasePrice", "financing", "currency", "once"),
  "closing-costs": field("closingCosts", "setup", "currency", "once"),
  "furnishing-budget": field("furnishingBudget", "setup", "currency", "once"),
  "down-payment-percentage": field("downPaymentPercentage", "financing", "percentage"),
  "interest-rate-percentage": field("interestRatePercentage", "financing", "percentage"),
  "loan-term-years": field("loanTermYears", "financing", "count", "term"),
  "monthly-lease": field("monthlyLease", "financing", "currency", "monthly"),
  "security-deposit": field("securityDeposit", "setup", "currency", "once"),
  "lease-term-months": field("leaseTermMonths", "financing", "count", "term"),
  "startup-costs": field("startupCosts", "setup", "currency", "once"),
  "utilities-included": field("utilitiesIncluded", "expenses", "boolean"),
  "projected-adr": field("projectedAdr", "revenue", "currency", "nightly", true),
  "projected-occupancy-percentage": field("projectedOccupancyPercentage", "revenue", "percentage", undefined, true),
  "average-length-of-stay": field("averageLengthOfStay", "revenue", "count"),
  "management-fee-percentage": field("managementFeePercentage", "expenses", "percentage"),
  "monthly-utilities": field("monthlyUtilities", "expenses", "currency", "monthly"),
  "annual-insurance-premium": field("annualInsurance", "expenses", "currency", "annual"),
  "annual-property-taxes": field("annualTaxes", "expenses", "currency", "annual"),
  "annual-cleaning": field("annualCleaning", "expenses", "currency", "annual"),
  "annual-software": field("annualSoftware", "expenses", "currency", "annual"),
  "annual-supplies": field("annualSupplies", "expenses", "currency", "annual"),
  "maintenance-reserve-percentage": field("maintenanceReservePercentage", "reserves", "percentage"),
  "capital-reserve-percentage": field("capitalReservePercentage", "reserves", "percentage"),
} satisfies Readonly<Record<string, Field>>);

export function hydrateReanalysis(
  projection: ImmutableAnalysisProjection,
  input: Readonly<{
    workspaceId: string;
    currentProviderObservations?: Readonly<Record<string, string | number | boolean | null>>;
    currentPlatformDefaults?: Readonly<Record<string, string | number | boolean | null>>;
    staleKeys?: readonly string[];
  }>,
): HydratedReanalysisState {
  if (projection.projectionVersion !== IMMUTABLE_ANALYSIS_PROJECTION_VERSION) throw new Error("REANALYSIS_PROJECTION_VERSION_UNSUPPORTED");
  if (projection.snapshot.route !== projection.opportunity.route) throw new Error("REANALYSIS_ACQUISITION_TYPE_MISMATCH");
  const values: Partial<InvestmentWorkspaceValues> = {
    acquisitionType: projection.opportunity.route === "purchase" ? AcquisitionType.Purchase : AcquisitionType.RentalArbitrage,
    address1: projection.opportunity.property.normalizedAddress.address1,
    city: projection.opportunity.property.normalizedAddress.city,
    state: projection.opportunity.property.normalizedAddress.state,
    postalCode: projection.opportunity.property.normalizedAddress.postalCode,
    propertyType: (projection.opportunity.property.propertyType as PropertyType | undefined) ?? PropertyType.Apartment,
    ...(projection.opportunity.property.bedrooms !== undefined ? { bedrooms: projection.opportunity.property.bedrooms } : {}),
    ...(projection.opportunity.property.bathrooms !== undefined ? { bathrooms: projection.opportunity.property.bathrooms } : {}),
    ...(projection.opportunity.property.squareFeet !== undefined ? { squareFeet: projection.opportunity.property.squareFeet } : {}),
  };
  const assumptions: Record<string, HydratedAssumptionValue> = {};
  for (const saved of projection.assumptions) {
    const definition = REANALYSIS_ASSUMPTION_CONTRACT[saved.key as keyof typeof REANALYSIS_ASSUMPTION_CONTRACT];
    if (!definition) continue;
    if (saved.value !== null) (values as Record<string, unknown>)[definition.workspaceKey] = saved.value;
    const providerAlternative = input.currentProviderObservations?.[saved.key];
    const defaultAlternative = input.currentPlatformDefaults?.[saved.key];
    assumptions[saved.key] = Object.freeze({
      key: saved.key,
      value: saved.value,
      persistedValue: saved.value,
      provenance: savedProvenance(saved.source),
      sourceVersionId: projection.analysisVersion.id,
      sourceTimestamp: saved.sourceTimestamp ?? projection.analysisVersion.createdAt.toISOString(),
      refreshEligible: Boolean(definition.refreshEligible) && !saved.explicitlyOverridden,
      stale: input.staleKeys?.includes(saved.key) ?? false,
      explicitlyOverridden: saved.explicitlyOverridden ?? saved.source === "user",
      ...(saved.overriddenValue !== undefined ? { overriddenValue: saved.overriddenValue } : {}),
      ...(saved.overriddenSource ? { overriddenSource: saved.overriddenSource } : {}),
      ...(saved.unit ?? definition.unit ? { unit: saved.unit ?? definition.unit } : {}),
      ...(saved.currency ?? definition.currency ? { currency: saved.currency ?? definition.currency } : {}),
      ...(saved.period ?? definition.period ? { period: saved.period ?? definition.period } : {}),
      ...(saved.mode ? { mode: saved.mode } : {}),
      ...(providerAlternative !== undefined ? { currentProviderAlternative: providerAlternative } : {}),
      ...(defaultAlternative !== undefined ? { currentDefaultAlternative: defaultAlternative } : {}),
    });
  }
  return deepFreeze({
    mode: "reanalysis",
    source: {
      workspaceId: input.workspaceId,
      opportunityId: projection.opportunity.id,
      sourceAnalysisVersionId: projection.analysisVersion.id,
      sourceVersionNumber: projection.analysisVersion.number,
      acquisitionType: projection.opportunity.route,
      calculationPolicyVersion: projection.analysisVersion.policyVersions.investmentAnalysisPolicy,
      scoringPolicyVersion: projection.analysisVersion.policyVersions.investmentRecommendationPolicy,
      sourceCreatedAt: projection.analysisVersion.createdAt.toISOString(),
      projectionContractVersion: projection.projectionVersion,
    },
    workspaceValues: values,
    assumptions,
    acceptedRefreshes: [],
    rejectedRefreshes: [],
    evidenceRefreshStatus: input.currentProviderObservations ? "available" : "not-requested",
    unsavedChanges: false,
  });
}

export async function hydrateSavedAnalysisForReanalysis(
  repository: InvestmentOpportunityRepository,
  input: Readonly<{
    workspaceId: string;
    opportunityId: string;
    sourceAnalysisVersionId: string;
    currentProviderObservations?: Readonly<Record<string, string | number | boolean | null>>;
    currentPlatformDefaults?: Readonly<Record<string, string | number | boolean | null>>;
    staleKeys?: readonly string[];
  }>,
): Promise<HydratedReanalysisState | null> {
  console.info("reanalysis_hydration_requested", { workspaceId: input.workspaceId, opportunityId: input.opportunityId, sourceAnalysisVersionId: input.sourceAnalysisVersionId, projectionContractVersion: IMMUTABLE_ANALYSIS_PROJECTION_VERSION });
  const projection = await readImmutableAnalysis(repository, { ownerId: input.workspaceId, opportunityId: input.opportunityId, analysisVersionId: input.sourceAnalysisVersionId });
  if (!projection) return null;
  const hydrated = hydrateReanalysis(projection, input);
  console.info("reanalysis_assumptions_mapped", { workspaceId: input.workspaceId, opportunityId: input.opportunityId, sourceAnalysisVersionId: input.sourceAnalysisVersionId, assumptionCount: Object.keys(hydrated.assumptions).length, projectionContractVersion: hydrated.source.projectionContractVersion });
  return hydrated;
}

export function applyReanalysisRefresh(state: HydratedReanalysisState, acceptedKeys: readonly string[], rejectedKeys: readonly string[]): HydratedReanalysisState {
  const accepted = new Set(acceptedKeys), rejected = new Set(rejectedKeys), assumptions = { ...state.assumptions }, workspaceValues = { ...state.workspaceValues };
  for (const key of accepted) {
    const current = assumptions[key], definition = REANALYSIS_ASSUMPTION_CONTRACT[key as keyof typeof REANALYSIS_ASSUMPTION_CONTRACT];
    if (!current?.refreshEligible || current.currentProviderAlternative === undefined || !definition) throw new Error("REANALYSIS_REFRESH_NOT_ELIGIBLE");
    assumptions[key] = Object.freeze({ ...current, value: current.currentProviderAlternative, provenance: "current_provider_observation" });
    if (current.currentProviderAlternative !== null) workspaceValues[definition.workspaceKey] = current.currentProviderAlternative as never;
  }
  return deepFreeze({ ...state, assumptions, workspaceValues, acceptedRefreshes: [...accepted], rejectedRefreshes: [...rejected], unsavedChanges: accepted.size > 0 });
}

export function buildReanalysisChangeSet(state: HydratedReanalysisState, current: Partial<InvestmentWorkspaceValues>, policyVersions?: Readonly<{ calculation?: string; scoring?: string }>): readonly ReanalysisChange[] {
  const changes: ReanalysisChange[] = [];
  for (const [key, saved] of Object.entries(state.assumptions)) {
    const definition = REANALYSIS_ASSUMPTION_CONTRACT[key as keyof typeof REANALYSIS_ASSUMPTION_CONTRACT];
    if (!definition) continue;
    const after = current[definition.workspaceKey];
    if (saved.persistedValue === null && after === undefined) continue;
    if (!Object.is(saved.persistedValue, after)) changes.push(Object.freeze({ key, category: definition.category, before: saved.persistedValue, after }));
  }
  if (policyVersions?.calculation !== state.source.calculationPolicyVersion) changes.push(Object.freeze({ key: "calculation-policy", category: "policy", before: state.source.calculationPolicyVersion, after: policyVersions?.calculation }));
  if (policyVersions?.scoring !== state.source.scoringPolicyVersion) changes.push(Object.freeze({ key: "scoring-policy", category: "policy", before: state.source.scoringPolicyVersion, after: policyVersions?.scoring }));
  return Object.freeze(changes);
}

export function shouldCreateReanalysisVersion(changes: readonly ReanalysisChange[]): boolean {
  return changes.length > 0;
}

function field(workspaceKey: keyof InvestmentWorkspaceValues, category: ReanalysisChange["category"], unit?: Field["unit"], period?: Field["period"], refreshEligible = false): Field {
  return Object.freeze({ workspaceKey, category, ...(unit ? { unit } : {}), ...(period ? { period } : {}), ...(unit === "currency" ? { currency: "USD" as const } : {}), refreshEligible });
}
function savedProvenance(source: string): HydratedValueProvenance {
  if (source === "user") return "saved_user_input";
  if (source === "market") return "saved_provider_observation";
  if (source === "system-default") return "saved_platform_default";
  return "saved_derived_value";
}
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
