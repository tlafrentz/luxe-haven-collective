import { OC001_OFFER_REGISTRY, type Oc001OfferDefinition } from "../domain/oc001-catalog";
export type FurnishingActivationContext = Readonly<{ globalKillSwitch:boolean; globalState:"disabled"|"internal"|"limited"|"enabled"|"paused"; workspaceKillSwitch:boolean; workspaceEnabled:boolean; cohortEligible:boolean; cohortExpired?:boolean; capabilityEnabled:boolean; offerActive?:boolean; catalogAvailable?:boolean; configurationValid:boolean; policyVersion:string; evaluatedAt?:string }>;

export type FurnishingOfferDenialReason =
  | "offer_not_approved" | "offer_incomplete" | "version_not_found" | "version_stale"
  | "offer_paused" | "offer_retired" | "provider_reference_missing" | "provider_reference_invalid"
  | "activation_disabled" | "workspace_ineligible" | "cohort_ineligible";

export type FurnishingProviderReference = Readonly<{
  productId: string;
  priceId: string;
  accountMode: "test" | "live";
}>;

export type FurnishingOfferActor = Readonly<{
  role: "admin" | "owner" | "operator" | "customer" | "anonymous";
  userId?: string;
  tenantId?: string;
}>;

export type ApprovedFurnishingOffer = Readonly<{
  offerId: "FS-CONSULT" | "FS-DESIGN";
  version: number;
  productFamily: "furnishing";
  name: string;
  description: string;
  priceMinor: number;
  currency: "USD";
  billingModel: "one_time";
  depositPolicy: string;
  inclusions: readonly string[];
  exclusions: readonly string[];
  eligibility: readonly string[];
  entitlement: readonly Readonly<{ capabilityCode: string; resourceType: string }>[];
  serviceWindow: string;
  cancellationPolicy: string;
  refundPolicy: string;
  upgradeRelationship?: string;
  providerReference: FurnishingProviderReference;
  effectiveAt: string;
  activationState: "internal" | "limited";
  fs008aCapabilities: readonly string[];
  provenance: "OC-001";
}>;

export type FurnishingOfferDecision = Readonly<{
  allowed: boolean;
  reason: "enabled" | FurnishingOfferDenialReason;
  offer?: ApprovedFurnishingOffer;
  customerProjection?: Readonly<Record<string, unknown>>;
}>;

type Input = Readonly<{
  offerId: string;
  requestedVersion?: number;
  workspaceId?: string;
  actor: FurnishingOfferActor;
  activation: FurnishingActivationContext;
  providerReferences: Readonly<Record<string, FurnishingProviderReference | undefined>>;
  now?: string;
  resolveActivation: (context: FurnishingActivationContext) => Readonly<{ allowed: boolean; reason: string }>;
}>;

const APPROVED = new Set(["FS-CONSULT", "FS-DESIGN"]);
const capabilityNames = ["offer_discovery", "checkout", "entitlement_activation", "purchase_confirmation"] as const;

function deny(reason: FurnishingOfferDenialReason): FurnishingOfferDecision { return Object.freeze({ allowed: false, reason }); }

function complete(definition: Oc001OfferDefinition, provider?: FurnishingProviderReference): ApprovedFurnishingOffer | FurnishingOfferDenialReason {
  if (!APPROVED.has(definition.offerCode)) return "offer_not_approved";
  if (definition.family !== "furnishing" || definition.version < 1 || !definition.customerName || !definition.fullDescription || !definition.shortDescription || !definition.deliverables.length || !definition.exclusions.length || !definition.prices.length || !definition.entitlements.length || !definition.cancellationPolicyCode || !definition.refundPolicyCode) return "offer_incomplete";
  const price = definition.prices[0];
  if (!price || price.currency !== "USD" || price.status !== "active" || price.amountMinor <= 0 || price.model !== "one_time") return "offer_incomplete";
  if (!provider) return "provider_reference_missing";
  if (!provider.productId || !provider.priceId || !["test", "live"].includes(provider.accountMode)) return "provider_reference_invalid";
  return Object.freeze({ offerId: definition.offerCode as "FS-CONSULT" | "FS-DESIGN", version: definition.version, productFamily: "furnishing", name: definition.customerName, description: definition.fullDescription, priceMinor: price.amountMinor, currency: price.currency, billingModel: "one_time", depositPolicy: "full_payment", inclusions: definition.deliverables, exclusions: definition.exclusions, eligibility: definition.eligibility, entitlement: definition.entitlements, serviceWindow: definition.expectedTimeline, cancellationPolicy: definition.cancellationPolicyCode!, refundPolicy: definition.refundPolicyCode!, ...(definition.baseOfferCode ? { upgradeRelationship: definition.baseOfferCode } : {}), providerReference: provider, effectiveAt: definition.effectiveFrom, activationState: "internal", fs008aCapabilities: capabilityNames, provenance: "OC-001" });
}

export function resolveApprovedFurnishingOffer(input: Input): FurnishingOfferDecision {
  const definition = OC001_OFFER_REGISTRY.find(value => value.offerCode === input.offerId);
  if (!definition) return deny("version_not_found");
  if (input.requestedVersion !== undefined && input.requestedVersion !== definition.version) return deny(input.requestedVersion < definition.version ? "version_stale" : "version_not_found");
  if (definition.launchState === "deferred" || definition.status === "draft") return deny("offer_not_approved");
  if (definition.status === "retired") return deny("offer_retired");
  if (definition.status !== "approved" && definition.status !== "active") return deny("offer_not_approved");
  if (input.activation.workspaceEnabled === false) return deny("workspace_ineligible");
  if (!input.activation.cohortEligible || input.activation.cohortExpired) return deny("cohort_ineligible");
  const activation = input.resolveActivation({ ...input.activation, offerActive: true, catalogAvailable: true });
  if (!activation.allowed) return deny("activation_disabled");
  const resolved = complete(definition, input.providerReferences[definition.offerCode]);
  if (typeof resolved === "string") return deny(resolved);
  return Object.freeze({ allowed: true, reason: "enabled", offer: resolved, customerProjection: Object.freeze({ offerId: resolved.offerId, version: resolved.version, name: resolved.name, description: resolved.description, priceMinor: resolved.priceMinor, currency: resolved.currency, billingModel: resolved.billingModel, inclusions: resolved.inclusions, exclusions: resolved.exclusions, eligibility: resolved.eligibility, cancellationPolicy: resolved.cancellationPolicy, refundPolicy: resolved.refundPolicy, availability: resolved.activationState, nextStep: "FS-008C onboarding will open after this milestone." }) });
}
