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
