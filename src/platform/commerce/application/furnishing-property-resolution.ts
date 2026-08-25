import type { FurnishingActivationContext } from "./furnishing-offers";
import type { FurnishingOnboardingSession, FurnishingOnboardingActor } from "./furnishing-onboarding";

export type FurnishingNewPropertyInput = Readonly<{ name: string; propertyType: string; country: string; address: string; city: string; region: string; postalCode?: string; timezone: string; bedrooms: number; bathrooms: number; maxGuests: number; listingUrl?: string; externalReference?: string }>;
export type FurnishingPropertySelection = Readonly<{ mode: "existing"; propertyId: string } | { mode: "new"; property: FurnishingNewPropertyInput }>;
export type FurnishingProperty = Readonly<{ id: string; tenantId: string; name: string; propertyType: string; country: string; address: string; city: string; region: string; postalCode?: string; timezone: string; bedrooms: number; bathrooms: number; maxGuests: number; archived?: boolean; source?: string }>;
export type PropertyResolutionReason = "resolved" | "wrong_tenant" | "unknown_property" | "archived_property" | "incompatible_property" | "insufficient_address" | "invalid_input" | "exact_match" | "probable_match" | "review_required" | "stale_session" | "activation_disabled" | "session_not_editable" | "conflict";
export type PropertyResolutionResult = Readonly<{ status: "resolved" | "denied" | "review_required" | "conflict"; reason: PropertyResolutionReason; property?: FurnishingProperty; duplicate?: "no_match" | "exact_match" | "probable_match" | "insufficient_address"; session?: FurnishingOnboardingSession }>;

export interface FurnishingPropertyRepository {
  findSession(id: string): Promise<FurnishingOnboardingSession | null>;
  findProperty(id: string): Promise<FurnishingProperty | null>;
  findDuplicate(tenantId: string, fingerprint: string): Promise<{ classification: "exact_match" | "probable_match"; property?: FurnishingProperty } | null>;
  transact<T>(work: (tx: Readonly<{ createProperty(value: FurnishingProperty): Promise<FurnishingProperty>; bindProperty(sessionId: string, propertyId: string, expectedVersion: number): Promise<FurnishingOnboardingSession>; audit(value: Readonly<Record<string, string>>): Promise<void> }>) => Promise<T>): Promise<T>;
}
const fingerprint = (value: FurnishingNewPropertyInput) => [value.name, value.address, value.city, value.region, value.postalCode ?? "", value.country].map(part => part.trim().toLowerCase()).join("|");
const valid = (value: FurnishingNewPropertyInput) => Boolean(value.name.trim() && value.propertyType.trim() && value.country.trim() && value.address.trim() && value.city.trim() && value.region.trim() && value.timezone.trim() && value.bedrooms >= 0 && value.bathrooms >= 0 && value.maxGuests > 0);

export class ResolveFurnishingOnboardingProperty {
  constructor(private readonly dependencies: Readonly<{ repository: FurnishingPropertyRepository; activation: FurnishingActivationContext }>) {}
  async execute(input: Readonly<{ actor: FurnishingOnboardingActor; onboardingSessionId: string; expectedVersion: number; selection: FurnishingPropertySelection; idempotencyKey: string; correlationId: string }>): Promise<PropertyResolutionResult> {
    const session = await this.dependencies.repository.findSession(input.onboardingSessionId);
    if (!session || session.tenantId !== input.actor.tenantId || session.customerId !== input.actor.userId) return { status: "denied", reason: "wrong_tenant" };
    if (!["in_progress", "ready_to_submit"].includes(session.status)) return { status: "denied", reason: "session_not_editable", session };
    if (session.version !== input.expectedVersion) return { status: "conflict", reason: "stale_session", session };
    if (this.dependencies.activation.globalKillSwitch || this.dependencies.activation.globalState === "disabled" || !this.dependencies.activation.workspaceEnabled || this.dependencies.activation.workspaceKillSwitch || !this.dependencies.activation.cohortEligible || !this.dependencies.activation.capabilityEnabled) return { status: "denied", reason: "activation_disabled", session };
    let property: FurnishingProperty | null = null;
    let duplicate: PropertyResolutionResult["duplicate"] = "no_match";
    if (input.selection.mode === "existing") {
      property = await this.dependencies.repository.findProperty(input.selection.propertyId);
      if (!property) return { status: "denied", reason: "unknown_property", session };
      if (property.tenantId !== session.tenantId) return { status: "denied", reason: "wrong_tenant", session };
      if (property.archived) return { status: "denied", reason: "archived_property", session };
    } else {
      if (!valid(input.selection.property)) return { status: "denied", reason: "insufficient_address", session, duplicate: "insufficient_address" };
      const found = await this.dependencies.repository.findDuplicate(session.tenantId, fingerprint(input.selection.property));
      if (found?.classification === "probable_match") return { status: "review_required", reason: "probable_match", session, duplicate: "probable_match" };
      if (found?.classification === "exact_match") { if (found.property) property = found.property; else return { status: "conflict", reason: "exact_match", session, duplicate: "exact_match" }; duplicate = "exact_match"; }
      if (!property) property = { id: crypto.randomUUID(), tenantId: session.tenantId, ...input.selection.property, source: "furnishing_onboarding" };
    }
    try { return await this.dependencies.repository.transact(async tx => { const created = input.selection.mode === "new" && property!.source === "furnishing_onboarding" ? await tx.createProperty(property!) : property!; const bound = await tx.bindProperty(session.id, created.id, input.expectedVersion); await tx.audit({ event: "furnishing_property_bound", sessionId: session.id, propertyId: created.id, correlationId: input.correlationId, reason: duplicate === "exact_match" ? "exact_match" : "resolved" }); return { status: "resolved" as const, reason: duplicate === "exact_match" ? "exact_match" as const : "resolved" as const, property: created, session: bound, ...(duplicate ? { duplicate } : {}) }; }); } catch { return { status: "conflict", reason: "conflict", session }; }
  }
}
