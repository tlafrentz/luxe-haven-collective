import { describe, expect, it } from "vitest";
import {
  CommercePaymentError,
  assertCommerceOrderTransition,
  normalizeStripeWebhookEvent,
  orderStatusForProviderEvent,
  reconcileProviderAmount,
  verifyStripeWebhook,
  type CommerceProviderEvent,
} from ".";

const created = 1_785_000_000;
function stripeEvent(type: string, object: Record<string, unknown>, livemode = false) {
  return JSON.stringify({ id: `evt_${type}`, type, created, livemode, data: { object } });
}
async function signature(body: string, secret: string, timestamp = created) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`));
  const hex = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("");
  return `t=${timestamp},v1=${hex}`;
}
function providerEvent(eventType: CommerceProviderEvent["eventType"], extra: Partial<CommerceProviderEvent> = {}): CommerceProviderEvent {
  return Object.freeze({ provider: "stripe", environment: "test", providerEventId: "evt", providerEventType: "test", eventType, providerCreatedAt: new Date(), metadata: {}, ...extra });
}

describe("Commerce payment lifecycle", () => {
  it("verifies the unmodified raw payload and rejects forged signatures", async () => {
    const body = stripeEvent("payment_intent.succeeded", { id: "pi_1" });
    const secret = "whsec_test";
    const verified = await verifyStripeWebhook({ rawBody: body, signatureHeader: await signature(body, secret), secret, now: new Date(created * 1000) });
    expect(verified.id).toBe("evt_payment_intent.succeeded");
    await expect(verifyStripeWebhook({ rawBody: `${body} `, signatureHeader: await signature(body, secret), secret, now: new Date(created * 1000) }))
      .rejects.toMatchObject({ code: "commerce_webhook_invalid_signature" });
  });

  it("normalizes Checkout without exposing Stripe object shapes", async () => {
    const body = stripeEvent("checkout.session.completed", {
      id: "cs_test", mode: "payment", customer: "cus_test", payment_intent: "pi_test",
      amount_total: 19900, currency: "usd", payment_status: "paid",
      metadata: { order_id: "order-1", commerce_customer_id: "customer-1", workspace_id: "workspace-1" },
    });
    const verified = JSON.parse(body);
    const event = normalizeStripeWebhookEvent(verified, "test");
    expect(event).toMatchObject({ eventType: "checkout.completed", amountMinor: 19900, currency: "USD", paymentStatus: "succeeded", internalOrderId: "order-1" });
    expect(event).not.toHaveProperty("data");
  });

  it("recognizes asynchronous Checkout and refund events", () => {
    expect(normalizeStripeWebhookEvent(JSON.parse(stripeEvent("checkout.session.async_payment_succeeded", { id: "cs", payment_intent: "pi" })), "test").eventType).toBe("payment.succeeded");
    expect(normalizeStripeWebhookEvent(JSON.parse(stripeEvent("checkout.session.async_payment_failed", { id: "cs", payment_intent: "pi" })), "test").eventType).toBe("payment.failed");
    expect(normalizeStripeWebhookEvent(JSON.parse(stripeEvent("refund.updated", { id: "re_1", payment_intent: "pi", amount: 5000, currency: "usd", status: "succeeded" })), "test"))
      .toMatchObject({ eventType: "refund.updated", providerRefundId: "re_1", refundedAmountMinor: 5000 });
  });

  it("blocks test/live crossover", () => {
    expect(() => normalizeStripeWebhookEvent(JSON.parse(stripeEvent("payment_intent.succeeded", { id: "pi" }, true)), "test"))
      .toThrowError(expect.objectContaining({ code: "commerce_environment_mismatch" }));
  });

  it("prevents terminal-state regression and reconciles currency and amount", () => {
    expect(orderStatusForProviderEvent("pending-payment", providerEvent("payment.succeeded"))).toBe("paid");
    expect(() => orderStatusForProviderEvent("paid", providerEvent("payment.failed"))).toThrow(CommercePaymentError);
    expect(() => assertCommerceOrderTransition("refunded", "paid")).toThrow(CommercePaymentError);
    expect(() => reconcileProviderAmount({ totalMinor: 1000, currency: "USD" }, { amountMinor: 999, currency: "USD" })).toThrowError(expect.objectContaining({ code: "commerce_amount_mismatch" }));
    expect(() => reconcileProviderAmount({ totalMinor: 1000, currency: "USD" }, { amountMinor: 1000, currency: "EUR" })).toThrowError(expect.objectContaining({ code: "commerce_currency_mismatch" }));
  });
});
