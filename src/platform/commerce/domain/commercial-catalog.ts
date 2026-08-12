export const PRODUCT_FAMILY_CODES = ["hpm", "guidebook_studio", "furnishing", "investment_intelligence"] as const;
export type ProductFamilyCode = (typeof PRODUCT_FAMILY_CODES)[number];

export type ProductFamilyDefinition = Readonly<{
  code: ProductFamilyCode; name: string; description: string; status: "active" | "inactive" | "retired";
  operatingModel: "self_service" | "sales_assisted" | "managed_service" | "hybrid";
  standaloneEligible: boolean;
  primaryResourceType: "workspace" | "property" | "guidebook" | "investment_analysis" | "furnishing_project";
}>;

export const CAPABILITY_CODES = [
  "hpm.workspace.access", "hpm.property.create", "hpm.performance.view", "report.standard.generate",
  "report.owner_safe.generate", "report.pdf.export", "report.csv.export", "hpm.action.manage",
  "guidebook.workspace.access", "guidebook.property.create_standalone", "guidebook.create", "guidebook.preview", "guidebook.publish",
  "furnishing.project.access", "furnishing.intake.submit", "furnishing.requirements.manage", "furnishing.budget.capture",
  "furnishing.selection.review", "furnishing.approval.manage", "furnishing.status.view", "furnishing.deliverable.view",
  "investment.analysis.run", "investment.opportunity.save", "investment.analysis.rerun", "investment.market.view", "investment.report.generate",
] as const;
export type CapabilityCode = (typeof CAPABILITY_CODES)[number];
export type CapabilityDefinition = Readonly<{ code: CapabilityCode; productFamily: ProductFamilyCode; name: string; description: string; resourceType: "workspace" | "property" | "guidebook" | "report" | "furnishing_project" | "investment_analysis" | "investment_opportunity"; ownerEligible: boolean; internalOnly: boolean; status: "active" | "deprecated" }>;

export const OFFER_LIMIT_CODES = ["workspace_count", "property_count", "guidebook_count", "published_guidebook_count", "team_member_count", "saved_investment_count", "investment_analysis_count_per_period", "furnishing_project_count"] as const;
export type OfferLimitCode = (typeof OFFER_LIMIT_CODES)[number];
export type LimitAllowance = Readonly<{ kind: "finite"; value: number } | { kind: "unlimited" }>;
export type OfferLimitDefinition = Readonly<{ code: OfferLimitCode; allowance: LimitAllowance; period?: "lifetime" | "month" | "year"; enforcement: "hard" | "soft" }>;
export type LimitCompositionStrategy = "highest" | "additive" | "most_specific";

export const ONBOARDING_REQUIREMENT_CODES = ["accept_terms", "create_workspace", "create_or_select_property", "complete_property_profile", "connect_data_source", "upload_historical_data", "complete_guidebook_intake", "complete_furnishing_intake", "complete_investment_profile", "schedule_consultation"] as const;
export type OnboardingRequirementCode = (typeof ONBOARDING_REQUIREMENT_CODES)[number];
export type OnboardingRequirementDefinition = Readonly<{ code: OnboardingRequirementCode; productFamily: ProductFamilyCode; required: boolean; blocksActivation: boolean; completedBy: "customer" | "internal"; prerequisiteCodes: readonly OnboardingRequirementCode[]; firstValueMilestone: string }>;
export type CapabilityGrantDefinition = Readonly<{ capability: CapabilityCode; resourceType: CapabilityDefinition["resourceType"] }>;

export type OfferDefinition = Readonly<{
  id: string; code: string; version: number; productFamily: ProductFamilyCode; name: string; shortDescription: string;
  status: "draft" | "active" | "inactive" | "retired";
  customerType: "individual_operator" | "portfolio_operator" | "owner" | "investor" | "service_client";
  acquisitionMode: "self_service" | "contact_sales" | "proposal_required";
  billingModel: "one_time" | "recurring" | "usage_based" | "custom_quote";
  priceDefinition?: Readonly<{ currency: string; amountMinor: number; interval?: "month" | "year"; intervalCount?: number; externalPriceReference?: string }>;
  includedCapabilities: readonly CapabilityGrantDefinition[]; limits: readonly OfferLimitDefinition[]; onboardingRequirements: readonly OnboardingRequirementCode[];
  standaloneEligible: boolean; prerequisiteOfferCodes: readonly string[]; compatibleOfferCodes: readonly string[]; upgradeOfferCodes: readonly string[];
  effectiveFrom: string; effectiveUntil?: string; schemaVersion: number;
}>;

export type PublicOfferDefinition = Readonly<Omit<OfferDefinition, "priceDefinition" | "includedCapabilities" | "prerequisiteOfferCodes" | "compatibleOfferCodes" | "upgradeOfferCodes"> & {
  priceDefinition?: Readonly<Omit<NonNullable<OfferDefinition["priceDefinition"]>, "externalPriceReference">>;
  capabilities: readonly Readonly<{ code: CapabilityCode; name: string; description: string }>[];
  action: "start" | "contact_sales" | "request_proposal";
}>;

export class CommercialCatalogError extends Error { constructor(public readonly code: string, message: string) { super(message); Object.freeze(this); } }

export function isCapabilityCode(value: string): value is CapabilityCode { return (CAPABILITY_CODES as readonly string[]).includes(value); }
export function isLimitCode(value: string): value is OfferLimitCode { return (OFFER_LIMIT_CODES as readonly string[]).includes(value); }

export function validateOfferDefinition(offer: OfferDefinition, offers: readonly OfferDefinition[] = []): OfferDefinition {
  if (!/^[a-z][a-z0-9_]*(?:\.[a-z0-9_]+)*$/.test(offer.code) || !Number.isSafeInteger(offer.version) || offer.version < 1) fail("offer_identity_invalid", "Offer code and version must be stable.");
  if (offers.some(value => value !== offer && value.code === offer.code && value.version === offer.version)) fail("offer_version_duplicate", "Offer code and version must be unique.");
  if (!PRODUCT_FAMILY_CODES.includes(offer.productFamily)) fail("product_family_unknown", "The product family is not registered.");
  const from = Date.parse(offer.effectiveFrom), until = offer.effectiveUntil ? Date.parse(offer.effectiveUntil) : undefined;
  if (!Number.isFinite(from) || (until !== undefined && (!Number.isFinite(until) || until <= from))) fail("offer_effective_period_invalid", "Offer effective dates are invalid.");
  if (offer.billingModel === "custom_quote" && offer.priceDefinition) fail("custom_quote_has_price", "Custom quote offers cannot fabricate a price.");
  if (offer.billingModel !== "custom_quote" && offer.status === "active" && !offer.priceDefinition) fail("offer_price_required", "Active priced offers require a price.");
  if (offer.priceDefinition) {
    if (!/^[A-Z]{3}$/.test(offer.priceDefinition.currency) || !Number.isSafeInteger(offer.priceDefinition.amountMinor) || offer.priceDefinition.amountMinor < 0) fail("offer_price_invalid", "Prices require an ISO-style currency and non-negative integer minor units.");
    if (offer.billingModel === "recurring" && (!offer.priceDefinition.interval || !Number.isSafeInteger(offer.priceDefinition.intervalCount ?? 1) || (offer.priceDefinition.intervalCount ?? 1) < 1)) fail("offer_interval_required", "Recurring offers require a valid billing interval.");
  }
  if (new Set(offer.includedCapabilities.map(value => value.capability)).size !== offer.includedCapabilities.length) fail("offer_capability_duplicate", "Offer capabilities must be unique.");
  for (const grant of offer.includedCapabilities) {
    const capability = CAPABILITY_REGISTRY[grant.capability];
    if (!capability) fail("unknown_capability", "Offers may grant only registered capabilities.");
    if (capability.internalOnly) fail("internal_capability_customer_offer", "Customer offers cannot grant internal-only capabilities.");
    if (capability.productFamily !== offer.productFamily && !offer.code.includes("bundle")) fail("capability_family_mismatch", "Non-bundle offers may grant only family capabilities.");
  }
  for (const limit of offer.limits) validateLimit(limit);
  for (const code of offer.onboardingRequirements) if (!ONBOARDING_REGISTRY[code]) fail("unknown_onboarding_requirement", "Onboarding requirements must be registered.");
  return deepFreeze(offer);
}

export function validateLimit(limit: OfferLimitDefinition): OfferLimitDefinition {
  if (!isLimitCode(limit.code)) fail("unknown_limit", "Offer limits must be registered.");
  if (limit.allowance.kind === "finite" && (!Number.isSafeInteger(limit.allowance.value) || limit.allowance.value < 0)) fail("limit_value_invalid", "Limit values must be non-negative integers.");
  if (limit.code === "investment_analysis_count_per_period" && !limit.period) fail("limit_period_required", "Periodic limits require a period.");
  return deepFreeze(limit);
}

export function publicOfferProjection(offer: OfferDefinition): PublicOfferDefinition {
  if (offer.status !== "active") fail("offer_not_public", "Only active offers have public projections.");
  const { includedCapabilities, prerequisiteOfferCodes: _p, compatibleOfferCodes: _c, upgradeOfferCodes: _u, priceDefinition, ...safe } = offer;
  void _p; void _c; void _u;
  return deepFreeze({ ...safe, ...(priceDefinition ? { priceDefinition: { currency: priceDefinition.currency, amountMinor: priceDefinition.amountMinor, ...(priceDefinition.interval ? { interval: priceDefinition.interval } : {}), ...(priceDefinition.intervalCount ? { intervalCount: priceDefinition.intervalCount } : {}) } } : {}), capabilities: includedCapabilities.map(({ capability }) => { const definition = CAPABILITY_REGISTRY[capability]; return { code: capability, name: definition.name, description: definition.description }; }), action: offer.acquisitionMode === "self_service" ? "start" : offer.acquisitionMode === "contact_sales" ? "contact_sales" : "request_proposal" });
}

export const PRODUCT_FAMILY_REGISTRY: Readonly<Record<ProductFamilyCode, ProductFamilyDefinition>> = deepFreeze({
  hpm: { code: "hpm", name: "Hospitality Performance Management", description: "Operational performance, reporting, and decision workflows.", status: "active", operatingModel: "self_service", standaloneEligible: true, primaryResourceType: "workspace" },
  guidebook_studio: { code: "guidebook_studio", name: "Guidebook Studio", description: "Standalone or integrated digital guest guidebooks.", status: "active", operatingModel: "hybrid", standaloneEligible: true, primaryResourceType: "guidebook" },
  furnishing: { code: "furnishing", name: "Furnishing", description: "Managed furnishing engagements and client delivery.", status: "active", operatingModel: "managed_service", standaloneEligible: true, primaryResourceType: "furnishing_project" },
  investment_intelligence: { code: "investment_intelligence", name: "Investment Intelligence", description: "Property and market investment analysis.", status: "active", operatingModel: "sales_assisted", standaloneEligible: true, primaryResourceType: "investment_analysis" },
});

const capability = (code: CapabilityCode, productFamily: ProductFamilyCode, name: string, resourceType: CapabilityDefinition["resourceType"], ownerEligible = true): CapabilityDefinition => ({ code, productFamily, name, description: name, resourceType, ownerEligible, internalOnly: false, status: "active" });
const CAPABILITY_DEFINITIONS: readonly CapabilityDefinition[] = [
  capability("hpm.workspace.access","hpm","Access HPM workspace","workspace"), capability("hpm.property.create","hpm","Create HPM properties","workspace"), capability("hpm.performance.view","hpm","View performance intelligence","property"), capability("report.standard.generate","hpm","Generate standard reports","report"), capability("report.owner_safe.generate","hpm","Generate owner-safe reports","report"), capability("report.pdf.export","hpm","Export PDF reports","report"), capability("report.csv.export","hpm","Export CSV reports","report"), capability("hpm.action.manage","hpm","Manage decision actions","property"),
  capability("guidebook.workspace.access","guidebook_studio","Access Guidebook Studio","workspace"), capability("guidebook.property.create_standalone","guidebook_studio","Create standalone property context","property"), capability("guidebook.create","guidebook_studio","Create guidebooks","guidebook"), capability("guidebook.preview","guidebook_studio","Preview guidebooks","guidebook"), capability("guidebook.publish","guidebook_studio","Publish guidebooks","guidebook"),
  capability("furnishing.project.access","furnishing","Access furnishing project","furnishing_project"), capability("furnishing.intake.submit","furnishing","Submit furnishing intake","furnishing_project"), capability("furnishing.requirements.manage","furnishing","Manage property requirements","furnishing_project"), capability("furnishing.budget.capture","furnishing","Capture project budget","furnishing_project"), capability("furnishing.selection.review","furnishing","Review product selections","furnishing_project"), capability("furnishing.approval.manage","furnishing","Manage approvals","furnishing_project"), capability("furnishing.status.view","furnishing","View project status","furnishing_project"), capability("furnishing.deliverable.view","furnishing","View deliverables","furnishing_project"),
  capability("investment.analysis.run","investment_intelligence","Run investment analysis","investment_analysis"), capability("investment.opportunity.save","investment_intelligence","Save investment opportunity","investment_opportunity"), capability("investment.analysis.rerun","investment_intelligence","Rerun investment analysis","investment_analysis"), capability("investment.market.view","investment_intelligence","View market intelligence","investment_analysis"), capability("investment.report.generate","investment_intelligence","Generate investment reports","investment_analysis"),
];
export const CAPABILITY_REGISTRY: Readonly<Record<CapabilityCode, CapabilityDefinition>> = deepFreeze(Object.fromEntries(CAPABILITY_DEFINITIONS.map(definition => [definition.code, definition])) as Record<CapabilityCode, CapabilityDefinition>);

export const LIMIT_STRATEGIES: Readonly<Record<OfferLimitCode, LimitCompositionStrategy>> = deepFreeze({ workspace_count: "highest", property_count: "highest", guidebook_count: "highest", published_guidebook_count: "highest", team_member_count: "highest", saved_investment_count: "highest", investment_analysis_count_per_period: "additive", furnishing_project_count: "most_specific" });

const onboarding = (code: OnboardingRequirementCode, productFamily: ProductFamilyCode, blocksActivation: boolean, completedBy: "customer" | "internal", prerequisiteCodes: readonly OnboardingRequirementCode[], firstValueMilestone: string, required = true): OnboardingRequirementDefinition => ({ code, productFamily, required, blocksActivation, completedBy, prerequisiteCodes, firstValueMilestone });
export const ONBOARDING_REGISTRY: Readonly<Record<OnboardingRequirementCode, OnboardingRequirementDefinition>> = deepFreeze({
  accept_terms:onboarding("accept_terms","hpm",true,"customer",[],"Commercial terms accepted"), create_workspace:onboarding("create_workspace","hpm",true,"customer",["accept_terms"],"Workspace available"), create_or_select_property:onboarding("create_or_select_property","hpm",true,"customer",["create_workspace"],"Property selected"), complete_property_profile:onboarding("complete_property_profile","hpm",false,"customer",["create_or_select_property"],"Property ready"), connect_data_source:onboarding("connect_data_source","hpm",false,"customer",["create_or_select_property"],"Live data connected",false), upload_historical_data:onboarding("upload_historical_data","hpm",false,"customer",["create_or_select_property"],"Historical performance available",false), complete_guidebook_intake:onboarding("complete_guidebook_intake","guidebook_studio",true,"customer",["accept_terms"],"Guidebook draft ready"), complete_furnishing_intake:onboarding("complete_furnishing_intake","furnishing",false,"customer",["accept_terms"],"Furnishing brief accepted"), complete_investment_profile:onboarding("complete_investment_profile","investment_intelligence",true,"customer",["accept_terms"],"First analysis ready"), schedule_consultation:onboarding("schedule_consultation","furnishing",false,"customer",["accept_terms"],"Consultation scheduled",false),
});

export function deepFreeze<T>(value: T): T { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value)) deepFreeze(child); } return value; }
function fail(code: string, message: string): never { throw new CommercialCatalogError(code, message); }
