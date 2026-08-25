import type { FurnishingActivationContext } from "./furnishing-offers";

export type FurnishingOnboardingReason =
  | "eligible" | "already_started" | "already_activated" | "authentication_required"
  | "unauthorized" | "wrong_tenant" | "entitlement_not_found" | "entitlement_inactive"
  | "entitlement_suspended" | "entitlement_revoked" | "entitlement_expired" | "entitlement_refunded"
  | "offer_unsupported" | "handoff_not_found" | "handoff_unavailable" | "activation_disabled"
  | "workspace_ineligible" | "conflict";

export type FurnishingOnboardingActor = Readonly<{ userId?: string; tenantId?: string; role: "admin" | "owner" | "operator" | "customer" | "anonymous" }>;
export type FurnishingOnboardingEntitlement = Readonly<{ id: string; customerId: string; tenantId: string; productFamily: string; offerId: string; offerVersion: number; status: string }>;
export type FurnishingOnboardingHandoff = Readonly<{ id: string; entitlementId: string; customerId: string; tenantId: string; status: string; activatedProjectId?: string }>;
export type FurnishingOnboardingSession = Readonly<{ id: string; customerId: string; tenantId: string; entitlementId: string; handoffId: string; offerId: "FS-CONSULT" | "FS-DESIGN"; offerVersion: number; schemaVersion: number; projectType: "consultation" | "design"; status: "in_progress" | "submitted" | "activated" | "blocked" | "canceled" | "superseded"; currentStep: "service_confirmation"; completedSteps: readonly string[]; propertyPath: "not_selected" | "existing" | "new"; version: number; idempotencyKey: string; correlationId: string; createdAt: string; updatedAt: string }>;

export type FurnishingOnboardingEligibility = Readonly<{ allowed: boolean; reason: FurnishingOnboardingReason; entitlement?: FurnishingOnboardingEntitlement; handoff?: FurnishingOnboardingHandoff; session?: FurnishingOnboardingSession }>;

export interface FurnishingOnboardingRepository {
  findEntitlement(id: string): Promise<FurnishingOnboardingEntitlement | null>;
  findHandoff(id: string): Promise<FurnishingOnboardingHandoff | null>;
  findSessionByHandoff(handoffId: string): Promise<FurnishingOnboardingSession | null>;
  createSession(value: FurnishingOnboardingSession): Promise<FurnishingOnboardingSession>;
  appendAudit(value: Readonly<Record<string, string>>): Promise<void>;
}

const inactiveReasons: Record<string, FurnishingOnboardingReason> = { suspended: "entitlement_suspended", revoked: "entitlement_revoked", expired: "entitlement_expired", refunded: "entitlement_refunded" };

export function resolveFurnishingOnboardingEligibility(input: Readonly<{ actor: FurnishingOnboardingActor; entitlement: FurnishingOnboardingEntitlement | null; handoff: FurnishingOnboardingHandoff | null; session?: FurnishingOnboardingSession | null; activation: FurnishingActivationContext; onboardingEnabled: boolean }>): FurnishingOnboardingEligibility {
  if (!input.actor.userId || input.actor.role === "anonymous") return { allowed: false, reason: "authentication_required" };
  if (!input.entitlement) return { allowed: false, reason: "entitlement_not_found" };
  const e = input.entitlement;
  if (e.customerId !== input.actor.userId) return { allowed: false, reason: input.actor.tenantId && input.actor.tenantId !== e.tenantId ? "wrong_tenant" : "unauthorized" };
  if (!input.actor.tenantId || input.actor.tenantId !== e.tenantId) return { allowed: false, reason: "wrong_tenant" };
  if (e.productFamily !== "furnishing" || !["FS-CONSULT", "FS-DESIGN"].includes(e.offerId)) return { allowed: false, reason: "offer_unsupported" };
  if (inactiveReasons[e.status]) return { allowed: false, reason: inactiveReasons[e.status] };
  if (e.status !== "active") return { allowed: false, reason: "entitlement_inactive" };
  if (!input.handoff) return { allowed: false, reason: "handoff_not_found" };
  if (input.handoff.entitlementId !== e.id || input.handoff.customerId !== e.customerId || input.handoff.tenantId !== e.tenantId) return { allowed: false, reason: "wrong_tenant" };
  if (input.handoff.status !== "pending_fs008c") return { allowed: false, reason: input.handoff.activatedProjectId ? "already_activated" : "handoff_unavailable" };
  if (input.session?.status === "activated") return { allowed: false, reason: "already_activated", session: input.session };
  if (!input.onboardingEnabled || input.activation.globalKillSwitch || input.activation.globalState === "disabled" || input.activation.workspaceKillSwitch || !input.activation.workspaceEnabled || !input.activation.cohortEligible || input.activation.cohortExpired || !input.activation.capabilityEnabled || !input.activation.configurationValid) return { allowed: false, reason: "activation_disabled" };
  return { allowed: true, reason: input.session ? "already_started" : "eligible", entitlement: e, handoff: input.handoff, ...(input.session ? { session: input.session } : {}) };
}

export class StartFurnishingOnboarding {
  constructor(private readonly dependencies: Readonly<{ repository: FurnishingOnboardingRepository; activation: FurnishingActivationContext; onboardingEnabled: boolean; now?: () => Date }>) {}
  async execute(input: Readonly<{ actor: FurnishingOnboardingActor; entitlementId: string; handoffId: string; idempotencyKey: string; correlationId: string }>): Promise<Readonly<{ status: "created" | "resumed" | "denied" | "conflict"; reason: FurnishingOnboardingReason; session?: FurnishingOnboardingSession }>> {
    const [entitlement, handoff, existing] = await Promise.all([this.dependencies.repository.findEntitlement(input.entitlementId), this.dependencies.repository.findHandoff(input.handoffId), this.dependencies.repository.findSessionByHandoff(input.handoffId)]);
    const decision = resolveFurnishingOnboardingEligibility({ actor: input.actor, entitlement, handoff, session: existing, activation: this.dependencies.activation, onboardingEnabled: this.dependencies.onboardingEnabled });
    if (!decision.allowed) return { status: decision.reason === "already_activated" || decision.reason === "conflict" ? "conflict" : "denied", reason: decision.reason, ...(existing ? { session: existing } : {}) };
    if (existing) { if (existing.idempotencyKey !== input.idempotencyKey && (existing.entitlementId !== input.entitlementId || existing.handoffId !== input.handoffId)) return { status: "conflict", reason: "conflict", session: existing }; await this.dependencies.repository.appendAudit({ event: "onboarding_session_resumed", sessionId: existing.id, correlationId: input.correlationId, reason: "already_started" }); return { status: "resumed", reason: "already_started", session: existing }; }
    const now = (this.dependencies.now?.() ?? new Date()).toISOString();
    const session: FurnishingOnboardingSession = Object.freeze({ id: crypto.randomUUID(), customerId: entitlement!.customerId, tenantId: entitlement!.tenantId, entitlementId: entitlement!.id, handoffId: handoff!.id, offerId: entitlement!.offerId as "FS-CONSULT" | "FS-DESIGN", offerVersion: entitlement!.offerVersion, schemaVersion: 1, projectType: entitlement!.offerId === "FS-CONSULT" ? "consultation" : "design", status: "in_progress", currentStep: "service_confirmation", completedSteps: [], propertyPath: "not_selected", version: 1, idempotencyKey: input.idempotencyKey, correlationId: input.correlationId, createdAt: now, updatedAt: now });
    try { const created = await this.dependencies.repository.createSession(session); await this.dependencies.repository.appendAudit({ event: "onboarding_session_created", sessionId: created.id, entitlementId: created.entitlementId, handoffId: created.handoffId, correlationId: input.correlationId, reason: "eligible" }); return { status: "created", reason: "eligible", session: created }; } catch { return { status: "conflict", reason: "conflict" }; }
  }
}
