import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeRefundable, sumCommittedRefunds, type BookingRequestStatus, type RefundStatus } from "../domain";

async function requireAdmin() {
  const { getSessionProfile } = await import("@/lib/auth/session");
  const { user, profile } = await getSessionProfile();
  if (!user || profile?.role !== "admin") throw new Error("Administrative authorization required.");
  return createAdminClient();
}

export type BookingRequestListRow = {
  id: string;
  requestToken: string;
  status: BookingRequestStatus;
  propertyName: string;
  arrival: string;
  departure: string;
  guestCount: number;
  totalMinor: number | null;
  currency: string | null;
  slaDueAt: string | null;
  createdAt: string;
};

export async function listBookingRequests(filters: { status?: string } = {}): Promise<readonly BookingRequestListRow[]> {
  const db = await requireAdmin();
  let query = db
    .from("booking_requests")
    .select("id, request_token, status, arrival, departure, guest_count, sla_due_at, created_at, property:properties!inner(name)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (filters.status) query = query.eq("status", filters.status);
  const { data, error } = await query;
  if (error) throw new Error("Unable to load booking requests.");

  const ids = (data ?? []).map((row) => row.id);
  const { data: quotes } = ids.length
    ? await db.from("request_quotes").select("booking_request_id, total_minor, currency, version").in("booking_request_id", ids).eq("status", "accepted")
    : { data: [] as { booking_request_id: string; total_minor: number; currency: string; version: number }[] };
  const latestQuoteByRequest = new Map<string, { total_minor: number; currency: string }>();
  for (const quote of quotes ?? []) {
    const current = latestQuoteByRequest.get(quote.booking_request_id);
    if (!current) latestQuoteByRequest.set(quote.booking_request_id, quote);
  }

  return (data ?? []).map((row) => {
    const property = row.property as unknown as { name: string } | { name: string }[];
    const propertyName = Array.isArray(property) ? property[0]?.name : property?.name;
    const quote = latestQuoteByRequest.get(row.id);
    return {
      id: row.id,
      requestToken: row.request_token,
      status: row.status as BookingRequestStatus,
      propertyName: propertyName ?? "Unknown property",
      arrival: row.arrival,
      departure: row.departure,
      guestCount: row.guest_count ?? 0,
      totalMinor: quote?.total_minor ?? null,
      currency: quote?.currency ?? null,
      slaDueAt: row.sla_due_at,
      createdAt: row.created_at,
    };
  });
}

export type BookingRequestDetail = {
  id: string;
  requestToken: string;
  status: BookingRequestStatus;
  propertyId: string;
  propertyName: string;
  arrival: string;
  departure: string;
  guestCount: number;
  adults: number | null;
  children: number;
  pets: number;
  slaDueAt: string | null;
  createdAt: string;
  guest: { fullName: string; email: string; phone: string | null; visitPurpose: string | null; accessibilityNeeds: string | null } | null;
  quotes: readonly { id: string; version: number; status: string; totalMinor: number; currency: string; expiresAt: string }[];
  reviews: readonly { id: string; decision: string; actorId: string | null; decidedAt: string; notes: string | null }[];
  blocks: readonly { id: string; status: string; calendarSystem: string; externalReference: string | null; operatorId: string; createdAt: string; expiresAt: string }[];
  invitations: readonly { id: string; status: string; amountMinor: number; currency: string; expiresAt: string }[];
  booking: BookingRefundSummary | null;
};

export type BookingRefundSummary = {
  bookingId: string;
  bookingCode: string | null;
  bookingStatus: string;
  paymentStatus: string;
  currency: string;
  paidMinor: number;
  refundedMinor: number;
  refundableMinor: number;
  refunds: readonly {
    id: string;
    amountMinor: number;
    status: RefundStatus;
    origin: string;
    reason: string | null;
    failureCode: string | null;
    createdAt: string;
  }[];
};

export async function getBookingRequestDetail(id: string): Promise<BookingRequestDetail | null> {
  const db = await requireAdmin();
  const { data: request } = await db
    .from("booking_requests")
    .select("id, request_token, status, property_id, arrival, departure, guest_count, adults, children, pets, sla_due_at, created_at, property:properties!inner(name)")
    .eq("id", id)
    .maybeSingle();
  if (!request) return null;

  const [{ data: guest }, { data: quotes }, { data: reviews }, { data: blocks }, { data: invitations }] = await Promise.all([
    db.from("booking_request_guests").select("full_name, email, phone, visit_purpose, accessibility_needs").eq("booking_request_id", id).maybeSingle(),
    db.from("request_quotes").select("id, version, status, total_minor, currency, expires_at").eq("booking_request_id", id).order("version", { ascending: false }),
    db.from("request_reviews").select("id, decision, actor_id, decided_at, notes").eq("booking_request_id", id).order("decided_at", { ascending: false }),
    db.from("calendar_blocks").select("id, status, calendar_system, external_reference, operator_id, created_at, expires_at").eq("booking_request_id", id).order("created_at", { ascending: false }),
    db.from("payment_invitations").select("id, status, amount_minor, currency, expires_at").eq("booking_request_id", id).order("created_at", { ascending: false }),
  ]);

  const property = request.property as unknown as { name: string } | { name: string }[];
  const propertyName = Array.isArray(property) ? property[0]?.name : property?.name;

  const { data: bookingRow } = await db
    .from("bookings")
    .select("id, booking_code, status, payment_status, currency, payment_invitation_id")
    .eq("booking_request_id", id)
    .maybeSingle();
  let booking: BookingRefundSummary | null = null;
  if (bookingRow) {
    const paidInvitation = (invitations ?? []).find((invitation) => invitation.id === bookingRow.payment_invitation_id);
    const { data: refundRows } = await db
      .from("booking_refunds")
      .select("id, amount_minor, status, origin, reason, failure_code, created_at")
      .eq("booking_id", bookingRow.id)
      .order("created_at", { ascending: false });
    const ledger = (refundRows ?? []).map((refund) => ({ amountMinor: Number(refund.amount_minor), status: refund.status as RefundStatus }));
    const paidMinor = paidInvitation ? Number(paidInvitation.amount_minor) : 0;
    booking = {
      bookingId: bookingRow.id,
      bookingCode: bookingRow.booking_code,
      bookingStatus: bookingRow.status,
      paymentStatus: bookingRow.payment_status,
      currency: paidInvitation?.currency ?? bookingRow.currency ?? "USD",
      paidMinor,
      refundedMinor: sumCommittedRefunds(ledger),
      refundableMinor: computeRefundable(paidMinor, ledger),
      refunds: (refundRows ?? []).map((refund) => ({
        id: refund.id,
        amountMinor: Number(refund.amount_minor),
        status: refund.status as RefundStatus,
        origin: refund.origin,
        reason: refund.reason,
        failureCode: refund.failure_code,
        createdAt: refund.created_at,
      })),
    };
  }

  return {
    id: request.id,
    requestToken: request.request_token,
    status: request.status as BookingRequestStatus,
    propertyId: request.property_id,
    propertyName: propertyName ?? "Unknown property",
    arrival: request.arrival,
    departure: request.departure,
    guestCount: request.guest_count ?? 0,
    adults: request.adults,
    children: request.children,
    pets: request.pets,
    slaDueAt: request.sla_due_at,
    createdAt: request.created_at,
    guest: guest ? { fullName: guest.full_name, email: guest.email, phone: guest.phone, visitPurpose: guest.visit_purpose, accessibilityNeeds: guest.accessibility_needs } : null,
    quotes: (quotes ?? []).map((quote) => ({ id: quote.id, version: quote.version, status: quote.status, totalMinor: quote.total_minor, currency: quote.currency, expiresAt: quote.expires_at })),
    reviews: (reviews ?? []).map((review) => ({ id: review.id, decision: review.decision, actorId: review.actor_id, decidedAt: review.decided_at, notes: review.notes })),
    blocks: (blocks ?? []).map((block) => ({ id: block.id, status: block.status, calendarSystem: block.calendar_system, externalReference: block.external_reference, operatorId: block.operator_id, createdAt: block.created_at, expiresAt: block.expires_at })),
    invitations: (invitations ?? []).map((invitation) => ({ id: invitation.id, status: invitation.status, amountMinor: invitation.amount_minor, currency: invitation.currency, expiresAt: invitation.expires_at })),
    booking,
  };
}
