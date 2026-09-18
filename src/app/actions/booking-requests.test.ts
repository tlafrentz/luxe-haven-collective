import { beforeEach, describe, expect, it, vi } from "vitest";

type Response = { data: unknown; error: { code?: string; message: string } | null };

function makeCallIndexedTable(responses: readonly Response[]) {
  let call = -1;
  function next(): Response {
    call = Math.min(call + 1, responses.length - 1);
    return responses[call] ?? { data: null, error: null };
  }
  function builder(): Record<string, unknown> {
    const chainMethods = ["select", "eq", "neq", "not", "in", "order", "limit", "gte", "lte"];
    const chain: Record<string, unknown> = {};
    for (const method of chainMethods) chain[method] = vi.fn(() => chain);
    chain.insert = vi.fn(() => chain);
    chain.update = vi.fn(() => chain);
    chain.upsert = vi.fn(() => chain);
    chain.maybeSingle = vi.fn(async () => next());
    chain.single = vi.fn(async () => next());
    chain.then = (resolve: (value: Response) => unknown) => resolve(next());
    return chain;
  }
  return { from: () => builder() };
}

const tableState = new Map<string, ReturnType<typeof makeCallIndexedTable>>();
function configureTable(name: string, responses: readonly Response[]) {
  tableState.set(name, makeCallIndexedTable(responses));
}

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => (tableState.get(table) ?? makeCallIndexedTable([])).from(),
  }),
}));

const createCheckoutSession = vi.fn();
vi.mock("@/features/booking-requests/infrastructure/stripe-payment-client", () => ({
  getBookingStripeClient: () => ({ createCheckoutSession: (...args: unknown[]) => createCheckoutSession(...args) }),
}));

vi.mock("@/features/booking-requests/infrastructure/booking-request-action", () => ({
  buildBookingRequestReviewAction: vi.fn(() => ({ id: "action-1" })),
  buildBlockReleaseAction: vi.fn(() => ({ id: "action-2" })),
}));

vi.mock("@/platform/actions", () => ({
  SupabasePlatformActionRepository: class {
    async add() {}
  },
}));

vi.mock("@/lib/auth/session", () => ({
  getSessionProfile: vi.fn(async () => ({ user: { id: "admin-1" }, profile: { role: "admin" } })),
}));

import { approveRequestForBlock, createPaymentInvitation, declineRequest, previewBookingRequestQuote, recordCalendarBlock } from "./booking-requests";

const NOW = Date.now();
const FUTURE = new Date(NOW + 60 * 60 * 1000).toISOString();
const PAST = new Date(NOW - 60 * 60 * 1000).toISOString();

describe("previewBookingRequestQuote", () => {
  beforeEach(() => {
    tableState.clear();
    createCheckoutSession.mockReset();
  });

  it("refuses when the property does not exist", async () => {
    configureTable("properties", [{ data: null, error: null }]);
    const result = await previewBookingRequestQuote({ propertySlug: "nope", arrival: "2026-10-08", departure: "2026-10-17" });
    expect(result).toEqual({ ok: false, code: "property_not_found" });
  });

  it("refuses when the property is not flagged for request intake", async () => {
    configureTable("properties", [{ data: { id: "property-1", metadata: {}, nightly_rate: 148, cleaning_fee: 145, tax_rate: 0.0825 }, error: null }]);
    const result = await previewBookingRequestQuote({ propertySlug: "mesa", arrival: "2026-10-08", departure: "2026-10-17" });
    expect(result).toEqual({ ok: false, code: "request_intake_disabled" });
  });

  it("computes a quote from the property's configured rates", async () => {
    configureTable("properties", [{ data: { id: "property-1", metadata: { direct_booking_enabled: true }, nightly_rate: 148, cleaning_fee: 145, tax_rate: 0.0825 }, error: null }]);
    const result = await previewBookingRequestQuote({ propertySlug: "mesa", arrival: "2026-10-08", departure: "2026-10-17" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.nights).toBe(9);
    expect(result.currency).toBe("USD");
  });
});

describe("createPaymentInvitation — the hard gate (LHS-PR-002/LHS-BLK-003)", () => {
  beforeEach(() => {
    tableState.clear();
    createCheckoutSession.mockReset().mockResolvedValue({ id: "cs_1", url: "https://checkout.stripe.com/cs_1", status: "open", environment: "test", expiresAt: new Date() });
  });

  it("refuses when no request matches the token", async () => {
    configureTable("booking_requests", [{ data: null, error: null }]);
    const result = await createPaymentInvitation("unknown-token");
    expect(result).toEqual({ ok: false, code: "not_found" });
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("refuses when the request is not awaiting_payment, even if a Stripe call is attempted directly", async () => {
    configureTable("booking_requests", [{ data: { id: "req-1", status: "submitted", property_id: "property-1", request_token: "tok-1" }, error: null }]);
    const result = await createPaymentInvitation("tok-1");
    expect(result).toEqual({ ok: false, code: "gate_not_ready" });
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("refuses when the accepted quote has expired", async () => {
    configureTable("booking_requests", [{ data: { id: "req-1", status: "awaiting_payment", property_id: "property-1", request_token: "tok-1" }, error: null }]);
    configureTable("request_quotes", [{ data: { id: "quote-1", total_minor: 163_800, currency: "USD", expires_at: PAST }, error: null }]);
    const result = await createPaymentInvitation("tok-1");
    expect(result).toEqual({ ok: false, code: "gate_not_ready" });
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("refuses when no active calendar block exists", async () => {
    configureTable("booking_requests", [{ data: { id: "req-1", status: "awaiting_payment", property_id: "property-1", request_token: "tok-1" }, error: null }]);
    configureTable("request_quotes", [{ data: { id: "quote-1", total_minor: 163_800, currency: "USD", expires_at: FUTURE }, error: null }]);
    configureTable("calendar_blocks", [{ data: null, error: null }]);
    const result = await createPaymentInvitation("tok-1");
    expect(result).toEqual({ ok: false, code: "gate_not_ready" });
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("refuses when the active block is bound to a different (superseded) quote", async () => {
    configureTable("booking_requests", [{ data: { id: "req-1", status: "awaiting_payment", property_id: "property-1", request_token: "tok-1" }, error: null }]);
    configureTable("request_quotes", [{ data: { id: "quote-2", total_minor: 163_800, currency: "USD", expires_at: FUTURE }, error: null }]);
    configureTable("calendar_blocks", [{ data: { id: "block-1", quote_id: "quote-1", expires_at: FUTURE }, error: null }]);
    const result = await createPaymentInvitation("tok-1");
    expect(result).toEqual({ ok: false, code: "gate_not_ready" });
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("refuses when the active block has expired", async () => {
    configureTable("booking_requests", [{ data: { id: "req-1", status: "awaiting_payment", property_id: "property-1", request_token: "tok-1" }, error: null }]);
    configureTable("request_quotes", [{ data: { id: "quote-1", total_minor: 163_800, currency: "USD", expires_at: FUTURE }, error: null }]);
    configureTable("calendar_blocks", [{ data: { id: "block-1", quote_id: "quote-1", expires_at: PAST }, error: null }]);
    const result = await createPaymentInvitation("tok-1");
    expect(result).toEqual({ ok: false, code: "gate_not_ready" });
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("creates a Stripe session only once every gate condition passes", async () => {
    configureTable("booking_requests", [{ data: { id: "req-1", status: "awaiting_payment", property_id: "property-1", request_token: "tok-1" }, error: null }]);
    configureTable("request_quotes", [{ data: { id: "quote-1", total_minor: 163_800, currency: "USD", expires_at: FUTURE }, error: null }]);
    configureTable("calendar_blocks", [{ data: { id: "block-1", quote_id: "quote-1", expires_at: FUTURE }, error: null }]);
    configureTable("booking_request_guests", [{ data: { email: "guest@example.com", full_name: "Guest" }, error: null }]);
    configureTable("properties", [{ data: { name: "Mesa stay" }, error: null }]);

    const result = await createPaymentInvitation("tok-1");
    expect(result).toEqual({ ok: true, redirectUrl: "https://checkout.stripe.com/cs_1" });
    expect(createCheckoutSession).toHaveBeenCalledTimes(1);
    expect(createCheckoutSession.mock.calls[0][0]).toMatchObject({ amountMinor: 163_800, currency: "USD" });
  });
});

describe("recordCalendarBlock — cannot be recorded outside the approved state", () => {
  beforeEach(() => {
    tableState.clear();
  });

  it("throws when the request has not been approved", async () => {
    configureTable("booking_requests", [{ data: { status: "submitted", property_id: "property-1", arrival: "2026-10-08", departure: "2026-10-17" }, error: null }]);
    await expect(
      recordCalendarBlock("req-1", { calendarSystem: "Hospitable", externalReference: "BLOCK-1", expiresAt: FUTURE }),
    ).rejects.toThrow("Only an approved request can be blocked.");
  });
});

// Regression test for a real production bug: the operator UI has one review
// screen with no separate "start review" click, so approve/decline/alternate
// must work starting directly from "submitted", not only from "under_review".
describe("operator decisions fold the submitted -> under_review hop in automatically", () => {
  beforeEach(() => {
    tableState.clear();
  });

  it("approveRequestForBlock succeeds starting from submitted (not just under_review)", async () => {
    configureTable("booking_requests", [
      { data: { status: "submitted" }, error: null }, // initial status read
      { data: null, error: null }, // submitted -> under_review
      { data: null, error: null }, // under_review -> approved
    ]);
    configureTable("request_quotes", [{ data: { id: "quote-1" }, error: null }]);
    configureTable("request_reviews", [{ data: null, error: null }]);
    configureTable("admin_audit_events", [{ data: null, error: null }]);

    await expect(approveRequestForBlock("req-1", { conflictCheckEvidence: { ota: true } })).resolves.toBeUndefined();
  });

  it("declineRequest succeeds starting from submitted", async () => {
    configureTable("booking_requests", [
      { data: { status: "submitted", property_id: "property-1" }, error: null },
      { data: null, error: null }, // submitted -> under_review
      { data: null, error: null }, // under_review -> declined
    ]);
    configureTable("request_reviews", [{ data: null, error: null }]);
    configureTable("admin_audit_events", [{ data: null, error: null }]);
    configureTable("calendar_blocks", [{ data: null, error: null }]); // releaseIfBlocked: no active block

    await expect(declineRequest("req-1", { notes: "No availability." })).resolves.toBeUndefined();
  });
});
