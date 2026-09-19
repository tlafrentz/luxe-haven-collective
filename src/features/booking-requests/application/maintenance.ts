import type { createAdminClient } from "@/lib/supabase/admin";
import { assertBookingRequestTransition, type BookingRequestStatus } from "../domain";
import type { SendBookingNotificationInput } from "../infrastructure/notifier";

type AdminClient = ReturnType<typeof createAdminClient>;

export type MaintenanceDeps = Readonly<{
  notify: (input: SendBookingNotificationInput) => Promise<unknown>;
  /** Creates the owned Action Center task that gets the calendar hold released (LHS-BLK-005). Wired in the app layer. */
  createBlockReleaseTask: (input: Readonly<{ bookingRequestId: string; calendarBlockId: string; propertyId: string; reason: string }>) => Promise<void>;
  now?: Date;
}>;

export type MaintenanceResult = Readonly<{ holdsExpired: number; proposalsExpired: number; overdueReminders: number }>;

const HOLD_EXPIRABLE: readonly BookingRequestStatus[] = ["approved", "awaiting_payment", "payment_failed"];
const BATCH = 200;

type Related<T> = T | T[] | null;
const one = <T,>(value: Related<T>): T | null => (Array.isArray(value) ? (value[0] ?? null) : value);

/**
 * Time-based lifecycle work nothing else does: without it a lapsed hold stays
 * on the calendar forever, an unanswered alternate proposal never closes, and
 * an overdue review is only visible if someone happens to open the admin page.
 * Every step is guarded (status-conditional updates, deduped notifications)
 * so overlapping or repeated runs are harmless.
 */
export async function runBookingRequestMaintenance(db: AdminClient, deps: MaintenanceDeps): Promise<MaintenanceResult> {
  const now = deps.now ?? new Date();
  const nowIso = now.toISOString();
  let holdsExpired = 0;
  let proposalsExpired = 0;
  let overdueReminders = 0;

  // 1. Holds that lapsed while the guest still hadn't paid — or whose request was already expired by
  //    Stripe's checkout.session.expired event (which does not release the hold).
  const { data: blocks } = await db
    .from("calendar_blocks")
    .select("id, booking_request_id, property_id, expires_at, request:booking_requests!inner(status)")
    .eq("status", "active")
    .limit(BATCH);
  for (const block of blocks ?? []) {
    const status = one(block.request as Related<{ status: string }>)?.status as BookingRequestStatus | undefined;
    if (!status) continue;
    const lapsed = new Date(block.expires_at).getTime() <= now.getTime();
    if (!(status === "expired" || (lapsed && HOLD_EXPIRABLE.includes(status)))) continue;

    if (status !== "expired") {
      assertBookingRequestTransition(status, "expired");
      const { data: moved } = await db
        .from("booking_requests")
        .update({ status: "expired", updated_at: nowIso })
        .eq("id", block.booking_request_id)
        .eq("status", status)
        .select("id");
      if (!moved?.length) continue; // it moved on (e.g. paid) since we looked
      await db
        .from("payment_invitations")
        .update({ status: "expired", updated_at: nowIso })
        .eq("booking_request_id", block.booking_request_id)
        .in("status", ["created", "started"]);
    }

    await deps.createBlockReleaseTask({
      bookingRequestId: block.booking_request_id,
      calendarBlockId: block.id,
      propertyId: block.property_id,
      reason: "The payment window elapsed without payment.",
    });
    await deps.notify({ template: "request_expired", bookingRequestId: block.booking_request_id, dedupeKey: "expired" });
    holdsExpired += 1;
  }

  // 2. Alternate-date proposals the guest never answered.
  const { data: quotes } = await db
    .from("request_quotes")
    .select("booking_request_id, request:booking_requests!inner(status)")
    .eq("status", "accepted")
    .lte("expires_at", nowIso)
    .limit(BATCH);
  for (const quote of quotes ?? []) {
    if (one(quote.request as Related<{ status: string }>)?.status !== "alternate_proposed") continue;
    const { data: moved } = await db
      .from("booking_requests")
      .update({ status: "expired", updated_at: nowIso })
      .eq("id", quote.booking_request_id)
      .eq("status", "alternate_proposed")
      .select("id");
    if (!moved?.length) continue;
    await deps.notify({ template: "request_expired", bookingRequestId: quote.booking_request_id, dedupeKey: "expired" });
    proposalsExpired += 1;
  }

  // 3. Requests nobody reviewed inside the response window. Not auto-expired (that is the operator's
  //    call and the guest is still waiting) — but the operator is told, once.
  const { data: overdue } = await db
    .from("booking_requests")
    .select("id")
    .in("status", ["submitted", "under_review"])
    .lte("sla_due_at", nowIso)
    .limit(BATCH);
  for (const request of overdue ?? []) {
    const outcome = await deps.notify({ template: "operator_review_overdue", bookingRequestId: request.id, dedupeKey: "sla-overdue" });
    if (outcome === "sent") overdueReminders += 1;
  }

  return { holdsExpired, proposalsExpired, overdueReminders };
}
