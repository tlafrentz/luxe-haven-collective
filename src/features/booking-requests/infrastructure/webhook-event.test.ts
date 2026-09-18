import { describe, expect, it } from "vitest";
import { BookingPaymentEnvironmentMismatch, normalizeBookingPaymentEvent } from "./webhook-event";

function stripeEvent(overrides: { type: string; livemode?: boolean; object: Record<string, unknown> }) {
  return {
    id: "evt_1",
    type: overrides.type,
    created: 1_700_000_000,
    livemode: overrides.livemode ?? false,
    data: { object: overrides.object },
  } as never;
}

describe("normalizeBookingPaymentEvent", () => {
  it("maps checkout.session.completed and extracts the checkout session id, amount, currency, and metadata", () => {
    const event = stripeEvent({
      type: "checkout.session.completed",
      object: { id: "cs_123", amount_total: 163_800, currency: "usd", metadata: { booking_request_id: "req-1", quote_id: "quote-1" } },
    });
    const normalized = normalizeBookingPaymentEvent(event, "test");
    expect(normalized.providerEventType).toBe("checkout.completed");
    expect(normalized.providerCheckoutSessionId).toBe("cs_123");
    expect(normalized.amountMinor).toBe(163_800);
    expect(normalized.currency).toBe("USD");
    expect(normalized.metadata).toEqual({ booking_request_id: "req-1", quote_id: "quote-1" });
  });

  it("maps payment_intent.succeeded and extracts the payment intent id from object.id", () => {
    const event = stripeEvent({ type: "payment_intent.succeeded", object: { id: "pi_123", amount_received: 163_800, currency: "usd" } });
    const normalized = normalizeBookingPaymentEvent(event, "test");
    expect(normalized.providerEventType).toBe("payment.succeeded");
    expect(normalized.providerPaymentIntentId).toBe("pi_123");
    expect(normalized.providerCheckoutSessionId).toBeUndefined();
  });

  it("maps payment_intent.payment_failed and payment_intent.canceled", () => {
    expect(normalizeBookingPaymentEvent(stripeEvent({ type: "payment_intent.payment_failed", object: { id: "pi_1" } }), "test").providerEventType).toBe("payment.failed");
    expect(normalizeBookingPaymentEvent(stripeEvent({ type: "payment_intent.canceled", object: { id: "pi_1" } }), "test").providerEventType).toBe("payment.cancelled");
  });

  it("maps checkout.session.expired", () => {
    expect(normalizeBookingPaymentEvent(stripeEvent({ type: "checkout.session.expired", object: { id: "cs_1" } }), "test").providerEventType).toBe("checkout.expired");
  });

  it("maps an unrecognized event type to unsupported rather than throwing", () => {
    expect(normalizeBookingPaymentEvent(stripeEvent({ type: "invoice.paid", object: {} }), "test").providerEventType).toBe("unsupported");
  });

  it("rejects a livemode event when a test environment was expected", () => {
    const event = stripeEvent({ type: "checkout.session.completed", livemode: true, object: { id: "cs_1" } });
    expect(() => normalizeBookingPaymentEvent(event, "test")).toThrow(BookingPaymentEnvironmentMismatch);
  });

  it("drops non-string metadata values rather than passing them through untyped", () => {
    const event = stripeEvent({ type: "checkout.session.completed", object: { id: "cs_1", metadata: { valid: "yes", nested: { a: 1 } } } });
    const normalized = normalizeBookingPaymentEvent(event, "test");
    expect(normalized.metadata).toEqual({ valid: "yes" });
  });
});
