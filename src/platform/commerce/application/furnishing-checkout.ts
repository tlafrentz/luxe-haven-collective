import { resolveApprovedFurnishingOffer, type FurnishingOfferActor, type FurnishingProviderReference } from "./furnishing-offers";
import type { FurnishingActivationContext } from "./furnishing-offers";
import { BillingActivationError } from "../domain/ca001b-billing";

export type FurnishingCheckoutStatus = "requested" | "creating" | "session_created" | "redirected" | "processing" | "succeeded" | "failed" | "canceled" | "expired" | "superseded";
export type FurnishingCheckoutAttempt = Readonly<{ id: string; productFamily: "furnishing"; actorId: string; tenantId: string; workspaceId: string; offerId: string; offerVersion: number; priceMinor: number; currency: "USD"; billingModel: "one_time"; providerProductId: string; providerPriceId: string; providerSessionId?: string; providerSessionUrl?: string; idempotencyHash: string; returnContext: string; status: FurnishingCheckoutStatus; correlationId: string; policyVersion: string; createdAt: string; expiresAt: string }>;
export type FurnishingCheckoutResult = Readonly<{ attemptId: string; redirectUrl: string; expiresAt: string; status: "session_created" | "redirected" }>;
export interface FurnishingCheckoutRepository { findByIdempotencyHash(hash: string): Promise<FurnishingCheckoutAttempt | null>; insert(attempt: FurnishingCheckoutAttempt): Promise<void>; attachSession(input: Readonly<{ attemptId: string; providerSessionId: string; providerSessionUrl: string; expiresAt: string }>): Promise<FurnishingCheckoutAttempt>; }
export interface FurnishingCheckoutAuthorization { authorize(input: Readonly<{ actor: FurnishingOfferActor; workspaceId: string }>): Promise<Readonly<{ actorId: string; tenantId: string; customerAccountId: string; role: "owner" | "customer" }> | null>; }
export interface FurnishingCheckoutProvider { createSession(input: Readonly<{ customerAccountId: string; providerProductId: string; providerPriceId: string; successUrl: string; cancelUrl: string; metadata: Readonly<Record<string, string>>; idempotencyKey: string }>): Promise<Readonly<{ id: string; url: string; expiresAt: string }>>; }

export class CreateFurnishingCheckout {
  constructor(private readonly dependencies: Readonly<{ repository: FurnishingCheckoutRepository; authorization: FurnishingCheckoutAuthorization; provider: FurnishingCheckoutProvider; hashIdempotency: (value: string) => Promise<string>; resolveActivation: (context: FurnishingActivationContext) => Readonly<{ allowed: boolean; reason: string }>; activation: FurnishingActivationContext; providerReferences: Readonly<Record<string, FurnishingProviderReference | undefined>>; now?: () => Date; ttlSeconds?: number }>) {}
  async execute(input: Readonly<{ actor: FurnishingOfferActor; workspaceId: string; offerId: string; offerVersion?: number; idempotencyKey: string; returnContext?: "checkout" | "purchase" }>): Promise<FurnishingCheckoutResult> {
    if (!input.idempotencyKey.trim()) throw new BillingActivationError("CHECKOUT_DISABLED", "Checkout request is invalid.");
    if (!/^(checkout|purchase)$/.test(input.returnContext ?? "checkout")) throw new BillingActivationError("CHECKOUT_DISABLED", "Checkout return context is invalid.");
    const auth = await this.dependencies.authorization.authorize({ actor: input.actor, workspaceId: input.workspaceId });
    if (!auth || !["owner", "customer"].includes(auth.role) || input.actor.role === "operator" || input.actor.role === "anonymous") throw new BillingActivationError("CUSTOMER_NOT_ELIGIBLE", "This account cannot purchase the offer.");
    const decision = resolveApprovedFurnishingOffer({ offerId: input.offerId, requestedVersion: input.offerVersion, workspaceId: input.workspaceId, actor: input.actor, activation: this.dependencies.activation, resolveActivation: this.dependencies.resolveActivation, providerReferences: this.dependencies.providerReferences });
    if (!decision.allowed || !decision.offer) throw new BillingActivationError("CHECKOUT_DISABLED", decision.reason);
    const offer = decision.offer;
    const hash = await this.dependencies.hashIdempotency(JSON.stringify({ key: input.idempotencyKey, actorId: auth.actorId, tenantId: auth.tenantId, workspaceId: input.workspaceId, offerId: offer.offerId, version: offer.version, returnContext: input.returnContext ?? "checkout" }));
    const existing = await this.dependencies.repository.findByIdempotencyHash(hash);
    if (existing) {
      if (existing.providerSessionId && existing.providerSessionUrl && existing.status !== "expired" && existing.status !== "canceled" && existing.status !== "failed") return Object.freeze({ attemptId: existing.id, redirectUrl: existing.providerSessionUrl, expiresAt: existing.expiresAt, status: "redirected" });
      throw new BillingActivationError("CHECKOUT_ATTEMPT_CONFLICT", "This checkout attempt requires a new idempotency key.");
    }
    const now = this.dependencies.now?.() ?? new Date(), expiresAt = new Date(now.getTime() + (this.dependencies.ttlSeconds ?? 1800) * 1000).toISOString(), attempt: FurnishingCheckoutAttempt = Object.freeze({ id: crypto.randomUUID(), productFamily: "furnishing", actorId: auth.actorId, tenantId: auth.tenantId, workspaceId: input.workspaceId, offerId: offer.offerId, offerVersion: offer.version, priceMinor: offer.priceMinor, currency: offer.currency, billingModel: offer.billingModel, providerProductId: offer.providerReference.productId, providerPriceId: offer.providerReference.priceId, idempotencyHash: hash, returnContext: input.returnContext ?? "checkout", status: "requested", correlationId: crypto.randomUUID(), policyVersion: this.dependencies.activation.policyVersion, createdAt: now.toISOString(), expiresAt });
    await this.dependencies.repository.insert(attempt);
    const session = await this.dependencies.provider.createSession({ customerAccountId: auth.customerAccountId, providerProductId: offer.providerReference.productId, providerPriceId: offer.providerReference.priceId, successUrl: `/furnishing/purchase/confirmed?attempt=${encodeURIComponent(attempt.id)}`, cancelUrl: `/furnishing/purchase/checkout?canceled=${encodeURIComponent(attempt.id)}`, metadata: { checkout_attempt_id: attempt.id, product_family: "furnishing", offer_id: offer.offerId, offer_version: String(offer.version), correlation_id: attempt.correlationId }, idempotencyKey: `furnishing:${hash}` });
    const attached = await this.dependencies.repository.attachSession({ attemptId: attempt.id, providerSessionId: session.id, providerSessionUrl: session.url, expiresAt: session.expiresAt });
    return Object.freeze({ attemptId: attached.id, redirectUrl: session.url, expiresAt: session.expiresAt, status: "redirected" });
  }
}
