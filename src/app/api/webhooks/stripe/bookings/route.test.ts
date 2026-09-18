import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const rpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: (name: string, params: unknown) => rpc(name, params) }),
}));

const verifyStripeWebhook = vi.fn();
const resolveStripeCommerceEnvironment = vi.fn();
vi.mock("@/platform/commerce", () => ({
  verifyStripeWebhook: (...args: unknown[]) => verifyStripeWebhook(...args),
  resolveStripeCommerceEnvironment: (...args: unknown[]) => resolveStripeCommerceEnvironment(...args),
}));

const getBookingStripeWebhookConfig = vi.fn();
vi.mock("@/features/booking-requests/infrastructure/config", () => ({
  getBookingStripeWebhookConfig: (...args: unknown[]) => getBookingStripeWebhookConfig(...args),
}));

import { POST } from "./route";

const fakeStripeEvent = {
  id: "evt_1",
  type: "checkout.session.completed",
  created: 1_700_000_000,
  livemode: false,
  data: { object: { id: "cs_123", amount_total: 163_800, currency: "usd", metadata: { booking_request_id: "req-1" } } },
};

function request(body = "{}", signature = "t=1,v1=sig") {
  return new Request("https://luxehavencollective.co/api/webhooks/stripe/bookings", {
    method: "POST",
    body,
    headers: { "stripe-signature": signature },
  });
}

describe("Stripe booking payment webhook", () => {
  beforeEach(() => {
    getBookingStripeWebhookConfig.mockReset().mockReturnValue({ secret: "whsec_test" });
    resolveStripeCommerceEnvironment.mockReset().mockReturnValue("test");
    verifyStripeWebhook.mockReset().mockResolvedValue(fakeStripeEvent);
    rpc.mockReset().mockResolvedValue({ data: { status: "processed", outcome: "confirmed", bookingId: "booking-1" }, error: null });
  });

  it("returns 503 without touching the database when the booking webhook secret is not configured", async () => {
    getBookingStripeWebhookConfig.mockImplementation(() => {
      throw new Error("STRIPE_BOOKING_WEBHOOK_SECRET is required.");
    });
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns 401 when signature verification fails, without calling the confirmation RPC", async () => {
    verifyStripeWebhook.mockRejectedValue(new Error("bad signature"));
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("normalizes a verified event and hands it to confirm_booking_from_payment", async () => {
    const response = await POST(request());
    const body = await response.clone().json();

    expect(response.status).toBe(200);
    expect(body.accepted).toBe(true);
    expect(rpc).toHaveBeenCalledWith(
      "confirm_booking_from_payment",
      expect.objectContaining({
        p_event: expect.objectContaining({
          providerEventType: "checkout.completed",
          providerCheckoutSessionId: "cs_123",
          amountMinor: 163_800,
          currency: "USD",
          metadata: { booking_request_id: "req-1" },
        }),
      }),
    );
  });

  it("returns 503 and never crashes when the RPC call itself errors", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "500", message: "db down" } });
    const response = await POST(request());
    expect(response.status).toBe(503);
  });

  it("acks 200 without an error when the event environment does not match this deployment", async () => {
    verifyStripeWebhook.mockResolvedValue({ ...fakeStripeEvent, livemode: true });
    resolveStripeCommerceEnvironment.mockReturnValue("test");
    const response = await POST(request());
    const body = await response.clone().json();
    expect(response.status).toBe(200);
    expect(body.code).toBe("environment_mismatch");
    expect(rpc).not.toHaveBeenCalled();
  });
});
