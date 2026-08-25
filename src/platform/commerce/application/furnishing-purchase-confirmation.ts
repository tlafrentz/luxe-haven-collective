import type { FurnishingActivationContext } from "@/platform/furnishing-activation-policy";

export type FurnishingPurchaseConfirmationStatus = "checkout_processing" | "payment_processing" | "entitlement_pending" | "active" | "payment_failed" | "canceled" | "expired" | "paused" | "reconciliation_required" | "refunded" | "access_denied" | "error";
export type FurnishingPurchaseConfirmation = Readonly<{ status: FurnishingPurchaseConfirmationStatus; attemptId: string; offerId?: string; offerVersion?: number; amountMinor?: number; currency?: string; billingModel?: string; paymentStatus?: string; entitlementStatus?: string; purchaseDate?: string; workspaceId?: string; nextStep: "wait" | "retry" | "support" | "fs008c_pending" | "unavailable"; message: string; handoff?: FurnishingPendingHandoff }>;
export type FurnishingPendingHandoff = Readonly<{ id: string; customerId: string; tenantId: string; workspaceId: string; entitlementId: string; offerId: string; offerVersion: number; purchaseId: string; onboardingType: "furnishing"; status: "pending_fs008c"; createdAt: string; correlationId: string }>;
export interface FurnishingConfirmationRepository { findAttempt(id: string): Promise<Readonly<{ id: string; actorId: string; customerId: string; tenantId: string; workspaceId: string; offerId: string; offerVersion: number; amountMinor: number; currency: string; billingModel: string; status: string; createdAt: string; expiresAt: string }> | null>; findPayment(attemptId: string): Promise<Readonly<{ id: string; status: string; providerPaymentReference?: string }> | null>; findEntitlement(attemptId: string): Promise<Readonly<{ id: string; customerId: string; tenantId: string; workspaceId: string; offerId: string; offerVersion: number; status: string }> | null>; findHandoff(entitlementId: string): Promise<FurnishingPendingHandoff | null>; createHandoff(handoff: FurnishingPendingHandoff): Promise<FurnishingPendingHandoff>; }
export interface FurnishingConfirmationAuthorization { canRead(input: Readonly<{ actorId: string; attempt: Readonly<{ actorId: string; tenantId: string; workspaceId: string }> }>): Promise<boolean>; }

export class GetFurnishingPurchaseConfirmation {
  constructor(private readonly dependencies: Readonly<{ repository: FurnishingConfirmationRepository; authorization: FurnishingConfirmationAuthorization; activation: FurnishingActivationContext; now?: () => Date }>) {}
  async execute(input: Readonly<{ actorId: string; checkoutAttemptId: string }>): Promise<FurnishingPurchaseConfirmation> {
    const attempt = await this.dependencies.repository.findAttempt(input.checkoutAttemptId);
    if (!attempt || !(await this.dependencies.authorization.canRead({ actorId: input.actorId, attempt }))) return { status: "access_denied", attemptId: input.checkoutAttemptId, nextStep: "support", message: "This purchase is unavailable." };
    const payment = await this.dependencies.repository.findPayment(attempt.id);
    if (attempt.status === "canceled") return this.base(attempt, "canceled", "retry", "Checkout was canceled. You may start a new checkout if the offer remains available.");
    if (attempt.status === "expired") return this.base(attempt, "expired", "retry", "This checkout expired. You may start a new checkout if the offer remains available.");
    if (attempt.status === "failed") return this.base(attempt, "payment_failed", "retry", "Payment was not completed. You may retry safely.");
    if (!payment || payment.status === "processing") return this.base(attempt, "payment_processing", "wait", "Payment is still processing. Refresh to check for an update.");
    if (payment.status === "failed") return this.base(attempt, "payment_failed", "retry", "Payment was not completed. You may retry safely.");
    if (payment.status === "refunded") return this.base(attempt, "refunded", "support", "This purchase has been refunded. Contact support if you need help.");
    if (payment.status === "reconciliation_required") return this.base(attempt, "reconciliation_required", "support", "This purchase requires support review.");
    const entitlement = await this.dependencies.repository.findEntitlement(attempt.id);
    if (!entitlement) return this.base(attempt, "entitlement_pending", "wait", "Payment is confirmed. Your Furnishing access is being activated.");
    if (entitlement.status !== "active") return this.base(attempt, "entitlement_pending", "wait", "Your Furnishing access is still being activated.");
    let handoff = await this.dependencies.repository.findHandoff(entitlement.id);
    if (!handoff) { handoff = await this.dependencies.repository.createHandoff({ id: crypto.randomUUID(), customerId: entitlement.customerId, tenantId: entitlement.tenantId, workspaceId: entitlement.workspaceId, entitlementId: entitlement.id, offerId: entitlement.offerId, offerVersion: entitlement.offerVersion, purchaseId: attempt.id, onboardingType: "furnishing", status: "pending_fs008c", createdAt: (this.dependencies.now?.() ?? new Date()).toISOString(), correlationId: crypto.randomUUID() }); }
    const paused = this.dependencies.activation.globalKillSwitch || this.dependencies.activation.globalState === "disabled" || !this.dependencies.activation.configurationValid;
    return { ...this.base(attempt, paused ? "paused" : "active", "fs008c_pending", paused ? "Your service is active, but onboarding is currently unavailable." : "Your Furnishing service is active; onboarding will open separately."), paymentStatus: payment.status, entitlementStatus: entitlement.status, handoff };
  }
  private base(attempt: Readonly<{ id: string; offerId: string; offerVersion: number; amountMinor: number; currency: string; billingModel: string; workspaceId: string; createdAt: string }>, status: FurnishingPurchaseConfirmationStatus, nextStep: FurnishingPurchaseConfirmation["nextStep"], message: string): FurnishingPurchaseConfirmation { return { status, attemptId: attempt.id, offerId: attempt.offerId, offerVersion: attempt.offerVersion, amountMinor: attempt.amountMinor, currency: attempt.currency, billingModel: attempt.billingModel, purchaseDate: attempt.createdAt, workspaceId: attempt.workspaceId, nextStep, message }; }
}
