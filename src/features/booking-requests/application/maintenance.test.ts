import { describe, expect, it, vi } from "vitest";
import { runBookingRequestMaintenance } from "./maintenance";

type Rows = unknown[] | null;
type Update = { table: string; payload: Record<string, unknown>; filters: Record<string, unknown> };

/** Fake client: `selects` feed reads per table; `moves` says whether a guarded status update matched a row. */
function fakeDb(selects: Record<string, Rows>, options: { moved?: boolean } = {}) {
  const updates: Update[] = [];
  const moved = options.moved ?? true;
  function table(name: string) {
    let pending: Update | null = null;
    const chain: Record<string, unknown> = {};
    for (const method of ["select", "limit", "lte"]) chain[method] = () => chain;
    chain.eq = (column: string, value: unknown) => ((pending ? (pending.filters[column] = value) : null), chain);
    chain.in = (column: string, value: unknown) => ((pending ? (pending.filters[column] = value) : null), chain);
    chain.update = (payload: Record<string, unknown>) => {
      pending = { table: name, payload, filters: {} };
      updates.push(pending);
      return chain;
    };
    chain.then = (resolve: (value: { data: unknown; error: null }) => unknown) =>
      resolve({ data: pending ? (moved ? [{ id: "x" }] : []) : (selects[name] ?? []), error: null });
    return chain;
  }
  return { db: { from: table } as never, updates };
}

const NOW = new Date("2026-11-05T12:00:00Z");
const PAST = "2026-11-04T12:00:00Z";
const FUTURE = "2026-11-06T12:00:00Z";
const block = (status: string, expiresAt: string, id = "block-1") => ({ id, booking_request_id: `req-${id}`, property_id: "property-1", expires_at: expiresAt, request: { status } });

function deps() {
  return { notify: vi.fn(async () => "sent"), createBlockReleaseTask: vi.fn(async () => {}), now: NOW };
}

describe("runBookingRequestMaintenance", () => {
  it("expires a lapsed hold, closes its payment invitation, queues the calendar release, and tells the guest", async () => {
    const { db, updates } = fakeDb({ calendar_blocks: [block("awaiting_payment", PAST)] });
    const d = deps();
    const result = await runBookingRequestMaintenance(db, d);

    expect(result.holdsExpired).toBe(1);
    expect(updates.find((u) => u.table === "booking_requests")).toMatchObject({ payload: { status: "expired" }, filters: { id: "req-block-1", status: "awaiting_payment" } });
    expect(updates.find((u) => u.table === "payment_invitations")).toMatchObject({ payload: { status: "expired" }, filters: { status: ["created", "started"] } });
    expect(d.createBlockReleaseTask).toHaveBeenCalledWith(expect.objectContaining({ calendarBlockId: "block-1", bookingRequestId: "req-block-1" }));
    expect(d.notify).toHaveBeenCalledWith({ template: "request_expired", bookingRequestId: "req-block-1", dedupeKey: "expired" });
  });

  it("leaves a hold that has not lapsed yet alone", async () => {
    const { db, updates } = fakeDb({ calendar_blocks: [block("awaiting_payment", FUTURE)] });
    const d = deps();
    expect((await runBookingRequestMaintenance(db, d)).holdsExpired).toBe(0);
    expect(updates).toHaveLength(0);
    expect(d.createBlockReleaseTask).not.toHaveBeenCalled();
  });

  it("never touches a request that is already confirmed, declined or withdrawn", async () => {
    const { db, updates } = fakeDb({ calendar_blocks: [block("confirmed", PAST, "a"), block("declined", PAST, "b"), block("withdrawn", PAST, "c")] });
    const d = deps();
    expect((await runBookingRequestMaintenance(db, d)).holdsExpired).toBe(0);
    expect(updates).toHaveLength(0);
    expect(d.notify).not.toHaveBeenCalled();
  });

  it("still releases the hold for a request Stripe already expired, without re-transitioning it", async () => {
    const { db, updates } = fakeDb({ calendar_blocks: [block("expired", FUTURE)] });
    const d = deps();
    expect((await runBookingRequestMaintenance(db, d)).holdsExpired).toBe(1);
    expect(updates).toHaveLength(0);
    expect(d.createBlockReleaseTask).toHaveBeenCalledTimes(1);
  });

  it("skips a request that moved on (e.g. paid) between the read and the guarded update", async () => {
    const { db } = fakeDb({ calendar_blocks: [block("awaiting_payment", PAST)] }, { moved: false });
    const d = deps();
    expect((await runBookingRequestMaintenance(db, d)).holdsExpired).toBe(0);
    expect(d.createBlockReleaseTask).not.toHaveBeenCalled();
    expect(d.notify).not.toHaveBeenCalled();
  });

  it("expires an alternate proposal the guest never answered, but not other request states", async () => {
    const { db, updates } = fakeDb({
      request_quotes: [
        { booking_request_id: "req-alt", request: { status: "alternate_proposed" } },
        { booking_request_id: "req-old-quote", request: { status: "confirmed" } },
      ],
    });
    const d = deps();
    expect((await runBookingRequestMaintenance(db, d)).proposalsExpired).toBe(1);
    expect(updates.filter((u) => u.table === "booking_requests")).toHaveLength(1);
    expect(updates[0]).toMatchObject({ filters: { id: "req-alt", status: "alternate_proposed" } });
    expect(d.notify).toHaveBeenCalledWith({ template: "request_expired", bookingRequestId: "req-alt", dedupeKey: "expired" });
  });

  it("reminds the operator once per overdue review and does not auto-expire it", async () => {
    const { db, updates } = fakeDb({ booking_requests: [{ id: "req-slow" }] });
    const d = deps();
    const result = await runBookingRequestMaintenance(db, d);
    expect(result.overdueReminders).toBe(1);
    expect(d.notify).toHaveBeenCalledWith({ template: "operator_review_overdue", bookingRequestId: "req-slow", dedupeKey: "sla-overdue" });
    expect(updates).toHaveLength(0);
  });

  it("does not count reminders that were skipped or already sent", async () => {
    const { db } = fakeDb({ booking_requests: [{ id: "req-1" }, { id: "req-2" }] });
    const d = deps();
    d.notify.mockResolvedValueOnce("duplicate").mockResolvedValueOnce("skipped");
    expect((await runBookingRequestMaintenance(db, d)).overdueReminders).toBe(0);
  });
});
