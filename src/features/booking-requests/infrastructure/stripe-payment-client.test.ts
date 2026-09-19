import { describe, expect, it, vi } from "vitest";
import { BookingStripeClient } from "./stripe-payment-client";

const config = { apiKey: "sk_test_fixture", environment: "test" as const, apiVersion: "2026-06-24.dahlia" as const };

describe("BookingStripeClient.createCheckoutSession", () => {
  it("rejects a non-positive or non-integer amount before calling Stripe", async () => {
    const fetcher = vi.fn();
    const client = new BookingStripeClient(config, fetcher);
    await expect(
      client.createCheckoutSession({
        customerEmail: "guest@example.com", currency: "USD", amountMinor: 0, productName: "Mesa stay",
        successUrl: "https://example.com/return", cancelUrl: "https://example.com/cancel", metadata: {}, idempotencyKey: "key-1",
      }),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("posts a payment-mode session with price_data, metadata, and the idempotency key header", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "cs_123", url: "https://checkout.stripe.com/cs_123", status: "open", expires_at: 1_700_003_600 }), { status: 200 }),
    );
    const client = new BookingStripeClient(config, fetcher);

    const session = await client.createCheckoutSession({
      customerEmail: "guest@example.com",
      currency: "USD",
      amountMinor: 163_800,
      productName: "Mesa stay",
      successUrl: "https://example.com/return",
      cancelUrl: "https://example.com/cancel",
      metadata: { booking_request_id: "req-1" },
      idempotencyKey: "booking-request:req-1:invitation:quote-1",
    });

    expect(session).toEqual({ id: "cs_123", url: "https://checkout.stripe.com/cs_123", status: "open", expiresAt: new Date(1_700_003_600 * 1000), environment: "test" });

    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.stripe.com/v1/checkout/sessions");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("booking-request:req-1:invitation:quote-1");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk_test_fixture");
    const body = (init.body as URLSearchParams).toString();
    expect(body).toContain("mode=payment");
    expect(body).toContain(`line_items%5B0%5D%5Bprice_data%5D%5Bunit_amount%5D=163800`);
    expect(body).toContain("metadata%5Bbooking_request_id%5D=req-1");
  });

  it("makes the session unpayable after the calendar hold, clamped to Stripe's allowed window", async () => {
    const ok = () => new Response(JSON.stringify({ id: "cs_1", url: "u", status: "open", expires_at: 1 }), { status: 200 });
    const base = { customerEmail: "g@example.com", currency: "USD", amountMinor: 100, productName: "Mesa", successUrl: "https://e.com/r", cancelUrl: "https://e.com/c", metadata: {}, idempotencyKey: "k" };
    const expiresParam = async (holdExpiresAt?: Date) => {
      const fetcher = vi.fn().mockResolvedValue(ok());
      await new BookingStripeClient(config, fetcher).createCheckoutSession({ ...base, holdExpiresAt });
      return ((fetcher.mock.calls[0] as [string, RequestInit])[1].body as URLSearchParams).get("expires_at");
    };
    const now = Math.floor(Date.now() / 1000);
    expect(Number(await expiresParam(new Date(Date.now() + 3 * 3600_000)))).toBeCloseTo(now + 3 * 3600, -1);
    expect(Number(await expiresParam(new Date(Date.now() + 60_000)))).toBeGreaterThanOrEqual(now + 30 * 60);
    expect(Number(await expiresParam(new Date(Date.now() + 72 * 3600_000)))).toBeLessThanOrEqual(now + 24 * 3600);
    expect(await expiresParam(undefined)).toBeNull();
  });

  it("throws a descriptive error when Stripe returns a non-ok response", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: "card_declined", message: "Your card was declined." } }), { status: 402 }));
    const client = new BookingStripeClient(config, fetcher);
    await expect(
      client.createCheckoutSession({
        customerEmail: "guest@example.com", currency: "USD", amountMinor: 100, productName: "Mesa stay",
        successUrl: "https://example.com/return", cancelUrl: "https://example.com/cancel", metadata: {}, idempotencyKey: "key-1",
      }),
    ).rejects.toThrow("Your card was declined.");
  });
});

describe("BookingStripeClient.createRefund", () => {
  const base = { paymentIntentId: "pi_123", amountMinor: 5_000, metadata: { booking_refund_id: "r-1" }, idempotencyKey: "booking-refund:b-1:key" };

  it("exposes the configured environment", () => {
    expect(new BookingStripeClient(config, vi.fn()).environment).toBe("test");
  });

  it("rejects invalid amounts and payment references before calling Stripe", async () => {
    const fetcher = vi.fn();
    const client = new BookingStripeClient(config, fetcher);
    await expect(client.createRefund({ ...base, amountMinor: 0 })).rejects.toThrow();
    await expect(client.createRefund({ ...base, amountMinor: 1.5 })).rejects.toThrow();
    await expect(client.createRefund({ ...base, paymentIntentId: "ch_123" })).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("posts a partial refund against the payment intent with metadata and the idempotency key", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "re_1", status: "succeeded", amount: 5_000 }), { status: 200 }));
    const client = new BookingStripeClient(config, fetcher);

    const refund = await client.createRefund(base);
    expect(refund).toEqual({ id: "re_1", status: "succeeded", amountMinor: 5_000, failureCode: undefined });

    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.stripe.com/v1/refunds");
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("booking-refund:b-1:key");
    const body = (init.body as URLSearchParams).toString();
    expect(body).toContain("payment_intent=pi_123");
    expect(body).toContain("amount=5000");
    expect(body).toContain("metadata%5Bbooking_refund_id%5D=r-1");
  });

  it("maps pending, failed, and canceled statuses and surfaces a failure reason", async () => {
    for (const status of ["pending", "failed", "canceled"] as const) {
      const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "re_1", status, amount: 100, failure_reason: status === "failed" ? "expired_or_canceled_card" : undefined }), { status: 200 }));
      const refund = await new BookingStripeClient(config, fetcher).createRefund({ ...base, amountMinor: 100 });
      expect(refund.status).toBe(status);
    }
  });

  it("throws the Stripe error message when the refund is rejected", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: "charge_already_refunded", message: "Charge has already been refunded." } }), { status: 400 }));
    await expect(new BookingStripeClient(config, fetcher).createRefund(base)).rejects.toThrow("Charge has already been refunded.");
  });
});

describe("BookingStripeClient.retrieveCheckoutSession", () => {
  it("returns the session's status and url", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "cs_1", url: "https://checkout.stripe.com/cs_1", status: "open" }), { status: 200 }));
    const session = await new BookingStripeClient(config, fetcher).retrieveCheckoutSession("cs_1");
    expect(session).toEqual({ id: "cs_1", url: "https://checkout.stripe.com/cs_1", status: "open" });
    expect((fetcher.mock.calls[0] as [string, RequestInit])[0]).toBe("https://api.stripe.com/v1/checkout/sessions/cs_1");
  });

  it("rejects a malformed session reference before calling Stripe", async () => {
    const fetcher = vi.fn();
    await expect(new BookingStripeClient(config, fetcher).retrieveCheckoutSession("../customers")).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
