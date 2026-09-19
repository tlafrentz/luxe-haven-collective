import { beforeEach, describe, expect, it, vi } from "vitest";

type Response = { data: unknown; error: { code?: string; message: string } | null };

type Write = { table: string; op: "insert" | "update" | "upsert"; payload: Record<string, unknown> };
const writes: Write[] = [];

function makeCallIndexedTable(responses: readonly Response[], table = "unknown") {
  let call = -1;
  function next(): Response {
    call = Math.min(call + 1, responses.length - 1);
    return responses[call] ?? { data: null, error: null };
  }
  function builder(): Record<string, unknown> {
    const chainMethods = ["select", "eq", "neq", "not", "in", "order", "limit", "gte", "lte"];
    const chain: Record<string, unknown> = {};
    for (const method of chainMethods) chain[method] = vi.fn(() => chain);
    chain.insert = vi.fn((payload: Record<string, unknown>) => (writes.push({ table, op: "insert", payload }), chain));
    chain.update = vi.fn((payload: Record<string, unknown>) => (writes.push({ table, op: "update", payload }), chain));
    chain.upsert = vi.fn((payload: Record<string, unknown>) => (writes.push({ table, op: "upsert", payload }), chain));
    chain.maybeSingle = vi.fn(async () => next());
    chain.single = vi.fn(async () => next());
    chain.then = (resolve: (value: Response) => unknown) => resolve(next());
    return chain;
  }
  return { from: () => builder() };
}

const tableState = new Map<string, ReturnType<typeof makeCallIndexedTable>>();
function configureTable(name: string, responses: readonly Response[]) {
  tableState.set(name, makeCallIndexedTable(responses, name));
}

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => (tableState.get(table) ?? makeCallIndexedTable([], table)).from(),
  }),
}));

const createCheckoutSession = vi.fn();
const createRefund = vi.fn();
const retrieveCheckoutSession = vi.fn();
let stripeEnvironment: "test" | "live" = "test";
vi.mock("@/features/booking-requests/infrastructure/stripe-payment-client", () => ({
  getBookingStripeClient: () => ({
    environment: stripeEnvironment,
    createCheckoutSession: (...args: unknown[]) => createCheckoutSession(...args),
    createRefund: (...args: unknown[]) => createRefund(...args),
    retrieveCheckoutSession: (...args: unknown[]) => retrieveCheckoutSession(...args),
  }),
}));

const sendBookingNotification = vi.fn(async () => "sent");
vi.mock("@/features/booking-requests/infrastructure/notifier", () => ({ sendBookingNotification: (...args: unknown[]) => sendBookingNotification(...(args as [])) }));

const track = vi.fn();
vi.mock("@/lib/analytics/track", () => ({ track: (...args: unknown[]) => track(...args) }));

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

import { buildBlockReleaseAction } from "@/features/booking-requests/infrastructure/booking-request-action";
import { approveRequestForBlock, createPaymentInvitation, declineRequest, previewBookingRequestQuote, recordCalendarBlock, refundBooking, submitBookingRequest } from "./booking-requests";

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

  it("hands the guest back to a session that is still open instead of creating a second one", async () => {
    configureTable("booking_requests", [{ data: { id: "req-1", status: "awaiting_payment", property_id: "property-1", request_token: "tok-1" }, error: null }]);
    configureTable("request_quotes", [{ data: { id: "quote-1", total_minor: 163_800, currency: "USD", expires_at: FUTURE }, error: null }]);
    configureTable("calendar_blocks", [{ data: { id: "block-1", quote_id: "quote-1", expires_at: FUTURE }, error: null }]);
    configureTable("booking_request_guests", [{ data: { email: "guest@example.com", full_name: "Guest" }, error: null }]);
    configureTable("properties", [{ data: { name: "Mesa stay" }, error: null }]);
    configureTable("payment_invitations", [{ data: { stripe_checkout_session_id: "cs_existing", status: "created", environment: "test" }, error: null }]);
    retrieveCheckoutSession.mockResolvedValue({ id: "cs_existing", url: "https://checkout.stripe.com/cs_existing", status: "open" });

    const result = await createPaymentInvitation("tok-1");
    expect(result).toEqual({ ok: true, redirectUrl: "https://checkout.stripe.com/cs_existing" });
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
    expect(createCheckoutSession.mock.calls[0][0]).toMatchObject({ amountMinor: 163_800, currency: "USD", holdExpiresAt: new Date(FUTURE) });
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

  it("declineRequest emails the guest once the decline is recorded", async () => {
    sendBookingNotification.mockClear();
    configureTable("booking_requests", [{ data: { status: "submitted", property_id: "property-1" }, error: null }, { data: null, error: null }, { data: null, error: null }]);
    configureTable("request_reviews", [{ data: null, error: null }]);
    configureTable("admin_audit_events", [{ data: null, error: null }]);
    configureTable("calendar_blocks", [{ data: null, error: null }]);
    await declineRequest("req-1", { notes: "No availability." });
    expect(sendBookingNotification).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ template: "request_declined", bookingRequestId: "req-1" }));
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

// ---------------------------------------------------------------------
// Refunds (LHS-CAN-001..003)
// ---------------------------------------------------------------------

describe("refundBooking", () => {
  const PAID = 163_800;
  const directBooking = {
    id: "booking-1",
    source: "Luxe Haven Direct",
    status: "confirmed",
    property_id: "property-1",
    booking_request_id: "req-1",
    payment_invitation_id: "inv-1",
    stripe_payment_intent_id: "pi_123",
    currency: "USD",
  };
  const KEY = "request-key-0001";
  const input = { amountMinor: 50_000, reason: "Guest illness", cancelBooking: false, requestKey: KEY };

  function arrange(options: { booking?: Record<string, unknown> | null; environment?: string; ledger?: { amount_minor: number; status: string }[]; existing?: Record<string, unknown> | null } = {}) {
    configureTable("bookings", [{ data: options.booking === undefined ? directBooking : options.booking, error: null }, { data: null, error: null }]);
    configureTable("payment_invitations", [{ data: { id: "inv-1", environment: options.environment ?? "test", amount_minor: PAID, currency: "USD" }, error: null }]);
    configureTable("booking_refunds", [
      { data: options.existing ?? null, error: null }, // idempotency lookup
      { data: options.ledger ?? [], error: null }, // ledger
      { data: { id: "refund-1", amount_minor: 0, status: "requested", stripe_refund_id: null, cancel_booking: false }, error: null }, // insert (patched below)
      { data: null, error: null },
    ]);
    configureTable("calendar_blocks", [{ data: { id: "block-1" }, error: null }]);
    configureTable("properties", [{ data: { owner_id: "ws-1" }, error: null }, { data: { name: "Mesa stay" }, error: null }]);
  }

  /** The insert response must echo the requested amount/cancel flag like the real row would. */
  function arrangeInsertEcho(amountMinor: number, cancelBooking: boolean) {
    const insertResponse = { data: { id: "refund-1", amount_minor: amountMinor, status: "requested", stripe_refund_id: null, cancel_booking: cancelBooking }, error: null };
    configureTable("booking_refunds", [
      { data: null, error: null },
      { data: [], error: null },
      insertResponse,
      { data: null, error: null },
    ]);
  }

  beforeEach(() => {
    tableState.clear();
    writes.length = 0;
    stripeEnvironment = "test";
    createRefund.mockReset().mockResolvedValue({ id: "re_1", status: "succeeded", amountMinor: 50_000 });
    track.mockReset();
    sendBookingNotification.mockClear();
    vi.mocked(buildBlockReleaseAction).mockClear();
  });

  it("rejects a malformed request key before touching anything", async () => {
    const result = await refundBooking("booking-1", { ...input, requestKey: "x" });
    expect(result).toMatchObject({ ok: false, code: "invalid_request_key" });
    expect(createRefund).not.toHaveBeenCalled();
  });

  it("refuses bookings that are not direct payments", async () => {
    arrange({ booking: { ...directBooking, source: "Airbnb" } });
    expect(await refundBooking("booking-1", input)).toMatchObject({ ok: false, code: "not_refundable" });
    arrange({ booking: { ...directBooking, stripe_payment_intent_id: null } });
    expect(await refundBooking("booking-1", input)).toMatchObject({ ok: false, code: "not_refundable" });
    arrange({ booking: null });
    expect(await refundBooking("booking-1", input)).toMatchObject({ ok: false, code: "not_refundable" });
    expect(createRefund).not.toHaveBeenCalled();
  });

  it("fails closed when the payment was made in a different Stripe environment", async () => {
    arrange({ environment: "live" });
    expect(await refundBooking("booking-1", input)).toMatchObject({ ok: false, code: "environment_mismatch" });
    expect(createRefund).not.toHaveBeenCalled();
    expect(writes.filter((write) => write.table === "booking_refunds")).toHaveLength(0);
  });

  it("refuses a refund above what remains refundable, counting earlier non-failed refunds only", async () => {
    arrange({ ledger: [{ amount_minor: 100_000, status: "succeeded" }, { amount_minor: 900_000, status: "failed" }] });
    // 163_800 paid - 100_000 already refunded (failed one ignored) = 63_800 remaining
    expect(await refundBooking("booking-1", { ...input, amountMinor: 63_801 })).toMatchObject({ ok: false, code: "exceeds_refundable" });
    expect(createRefund).not.toHaveBeenCalled();
  });

  it("requires a reason and a positive amount", async () => {
    arrange();
    expect(await refundBooking("booking-1", { ...input, reason: "  " })).toMatchObject({ ok: false, code: "reason_required" });
    arrange();
    expect(await refundBooking("booking-1", { ...input, amountMinor: 0 })).toMatchObject({ ok: false, code: "invalid_amount" });
    expect(createRefund).not.toHaveBeenCalled();
  });

  it("issues a partial refund through Stripe with a stable idempotency key and does not cancel", async () => {
    arrange();
    arrangeInsertEcho(50_000, false);
    const result = await refundBooking("booking-1", input);

    expect(result).toEqual({ ok: true, refundId: "refund-1", status: "succeeded", cancelled: false });
    expect(createRefund).toHaveBeenCalledTimes(1);
    expect(createRefund.mock.calls[0][0]).toMatchObject({
      paymentIntentId: "pi_123",
      amountMinor: 50_000,
      idempotencyKey: `booking-refund:booking-1:${KEY}`,
      metadata: { booking_refund_id: "refund-1", booking_id: "booking-1" },
    });
    expect(writes.some((write) => write.table === "bookings" && write.op === "update")).toBe(false);
    expect(buildBlockReleaseAction).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith("booking_refunded", { bookingId: "booking-1" });
    expect(track).not.toHaveBeenCalledWith("booking_cancelled", expect.anything());
    expect(sendBookingNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ template: "refund_issued", bookingRequestId: "req-1", dedupeKey: "refund-1", extras: { amountMinor: 50_000, currency: "USD", bookingCancelled: false } }),
    );
  });

  it("records the requester and reason on the refund row", async () => {
    arrange();
    arrangeInsertEcho(50_000, false);
    await refundBooking("booking-1", input);
    const insert = writes.find((write) => write.table === "booking_refunds" && write.op === "insert");
    expect(insert?.payload).toMatchObject({ booking_id: "booking-1", amount_minor: 50_000, reason: "Guest illness", origin: "app", requested_by: "admin-1", status: "requested", environment: "test" });
  });

  it("cancels the booking and queues a calendar-release task on a full refund with cancel selected", async () => {
    arrange();
    arrangeInsertEcho(PAID, true);
    createRefund.mockResolvedValue({ id: "re_full", status: "succeeded", amountMinor: PAID });

    const result = await refundBooking("booking-1", { ...input, amountMinor: PAID, cancelBooking: true });

    expect(result).toEqual({ ok: true, refundId: "refund-1", status: "succeeded", cancelled: true });
    const bookingUpdate = writes.find((write) => write.table === "bookings" && write.op === "update");
    expect(bookingUpdate?.payload).toMatchObject({ status: "cancelled", payment_status: "refunded" });
    expect(buildBlockReleaseAction).toHaveBeenCalledWith(expect.objectContaining({ bookingRequestId: "req-1", calendarBlockId: "block-1" }));
    expect(track).toHaveBeenCalledWith("booking_cancelled", { bookingId: "booking-1" });
    expect(sendBookingNotification).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ template: "refund_issued", extras: expect.objectContaining({ bookingCancelled: true }) }));
  });

  it("does not cancel when the refund is full but cancel was not selected", async () => {
    arrange();
    arrangeInsertEcho(PAID, false);
    createRefund.mockResolvedValue({ id: "re_full", status: "succeeded", amountMinor: PAID });
    const result = await refundBooking("booking-1", { ...input, amountMinor: PAID, cancelBooking: false });
    expect(result).toMatchObject({ ok: true, cancelled: false });
    expect(writes.some((write) => write.table === "bookings" && write.op === "update")).toBe(false);
  });

  it("does not cancel on a partial refund even if cancel was selected", async () => {
    arrange();
    arrangeInsertEcho(50_000, true);
    const result = await refundBooking("booking-1", { ...input, cancelBooking: true });
    expect(result).toMatchObject({ ok: true, cancelled: false });
    expect(writes.some((write) => write.table === "bookings" && write.op === "update")).toBe(false);
  });

  it("marks the row failed and reports failure when Stripe rejects the refund", async () => {
    arrange();
    arrangeInsertEcho(50_000, false);
    createRefund.mockRejectedValue(Object.assign(new Error("Charge has already been refunded."), { code: "charge_already_refunded" }));

    const result = await refundBooking("booking-1", input);

    expect(result).toMatchObject({ ok: false, code: "stripe_failed" });
    const failedUpdate = writes.find((write) => write.table === "booking_refunds" && write.op === "update");
    expect(failedUpdate?.payload).toMatchObject({ status: "failed", failure_code: "charge_already_refunded" });
    expect(writes.some((write) => write.table === "bookings" && write.op === "update")).toBe(false);
    expect(track).not.toHaveBeenCalled();
    expect(sendBookingNotification).not.toHaveBeenCalled();
  });

  it("reuses the first attempt when the same request key is submitted again", async () => {
    arrange({ existing: { id: "refund-1", amount_minor: 50_000, status: "succeeded", stripe_refund_id: "re_1", cancel_booking: false } });
    const result = await refundBooking("booking-1", input);
    expect(result).toEqual({ ok: true, refundId: "refund-1", status: "succeeded", cancelled: false });
    expect(createRefund).not.toHaveBeenCalled();
    expect(writes.filter((write) => write.table === "booking_refunds")).toHaveLength(0);
  });

  it("does not report a previously failed attempt as a success on replay", async () => {
    arrange({ existing: { id: "refund-1", amount_minor: 50_000, status: "failed", stripe_refund_id: null, cancel_booking: false } });
    expect(await refundBooking("booking-1", input)).toMatchObject({ ok: false, code: "stripe_failed" });
    expect(createRefund).not.toHaveBeenCalled();
  });

  it("does not cancel or track a refund that Stripe reports as failed at creation", async () => {
    arrange();
    arrangeInsertEcho(PAID, true);
    createRefund.mockResolvedValue({ id: "re_x", status: "failed", amountMinor: PAID, failureCode: "expired_or_canceled_card" });
    const result = await refundBooking("booking-1", { ...input, amountMinor: PAID, cancelBooking: true });
    expect(result).toMatchObject({ ok: false, code: "stripe_failed" });
    expect(writes.some((write) => write.table === "bookings" && write.op === "update")).toBe(false);
    expect(track).not.toHaveBeenCalledWith("booking_refunded", expect.anything());
  });
});

describe("submitBookingRequest", () => {
  const property = { id: "property-1", name: "Mesa stay", metadata: { direct_booking_enabled: true }, nightly_rate: 148, cleaning_fee: 145, tax_rate: 0.0825, max_guests: 4, minimum_nights: 2 };
  const base = { propertySlug: "mesa", arrival: "2026-11-10", departure: "2026-11-13", adults: 2, fullName: "Sam Guest", email: "sam@example.com", consentAcknowledged: true };

  beforeEach(() => {
    tableState.clear();
    writes.length = 0;
    sendBookingNotification.mockClear();
    configureTable("properties", [{ data: property, error: null }, { data: { owner_id: "ws-1" }, error: null }]);
    configureTable("booking_requests", [{ data: { id: "req-1" }, error: null }]);
  });

  it("does not accept or store a pet count — pets are not permitted at the property", async () => {
    const result = await submitBookingRequest({ ...base, pets: 2 } as never);
    expect(result.ok).toBe(true);
    const insert = writes.find((write) => write.table === "booking_requests" && write.op === "insert");
    expect(insert?.payload).not.toHaveProperty("pets");
  });

  it("emails the guest a receipt and the operator a review prompt after the request is stored", async () => {
    await submitBookingRequest(base);
    const templates = sendBookingNotification.mock.calls.map((call) => (call as unknown as [unknown, { template: string }])[1].template);
    expect(templates).toEqual(["request_received", "operator_new_request"]);
  });

  it("sends no email for an invalid submission", async () => {
    const result = await submitBookingRequest({ ...base, consentAcknowledged: false });
    expect(result).toEqual({ ok: false, code: "invalid_input" });
    expect(sendBookingNotification).not.toHaveBeenCalled();
  });
});
