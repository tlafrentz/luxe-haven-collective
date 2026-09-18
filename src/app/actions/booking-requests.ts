"use server";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionProfile } from "@/lib/auth/session";
import { calculateProvisionalQuote } from "@/features/booking-requests/domain/quote";
import { assertBookingRequestTransition, type BookingRequestStatus } from "@/features/booking-requests/domain/request-lifecycle";
import { getBookingStripeClient } from "@/features/booking-requests/infrastructure/stripe-payment-client";
import { buildBlockReleaseAction, buildBookingRequestReviewAction } from "@/features/booking-requests/infrastructure/booking-request-action";
import { SupabasePlatformActionRepository } from "@/platform/actions";
import { sanitizeAuditMetadata } from "@/features/admin-operations/domain/operations";

const REVIEW_SLA_HOURS = 24;
const QUOTE_VALID_HOURS = 24;

type AdminClient = ReturnType<typeof createAdminClient>;

// ---------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------

async function adminContext() {
  const { user, profile } = await getSessionProfile();
  if (!user || profile?.role !== "admin") {
    throw new Error("Administrative authorization required.");
  }
  return { user, profile, db: createAdminClient() as AdminClient, correlationId: crypto.randomUUID() };
}

async function audit(
  db: AdminClient,
  input: {
    actorId: string;
    actorRole: string;
    action: string;
    targetId: string;
    result: "succeeded" | "failed" | "denied";
    correlationId: string;
    metadata?: Record<string, unknown>;
  },
) {
  const { error } = await db.from("admin_audit_events").insert({
    actor_id: input.actorId,
    actor_role: input.actorRole,
    action: input.action,
    category: "booking_request",
    target_type: "booking_request",
    target_id: input.targetId,
    result: input.result,
    correlation_id: input.correlationId,
    source: "server_action",
    metadata: sanitizeAuditMetadata(input.metadata ?? {}),
  });
  if (error) {
    console.error("booking_request_audit_write_failed", { action: input.action, correlationId: input.correlationId });
    throw new Error("The operation completed but its required audit event could not be recorded.");
  }
}

function approvedOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const value = new URL(raw);
  if (value.protocol !== "https:" && !value.hostname.endsWith("localhost")) {
    throw new Error("LHS001_RETURN_ORIGIN_INVALID");
  }
  return value.origin;
}

async function resolvePropertyWorkspaceId(db: AdminClient, propertyId: string): Promise<string | null> {
  const { data } = await db.from("properties").select("owner_id").eq("id", propertyId).maybeSingle();
  return data?.owner_id ?? null;
}

async function createActionCenterTask(db: AdminClient, workspaceId: string | null, action: ReturnType<typeof buildBookingRequestReviewAction>) {
  if (!workspaceId) return;
  try {
    await new SupabasePlatformActionRepository(db).add({ action });
  } catch (error) {
    console.error("booking_request_action_create_failed", { error: error instanceof Error ? error.message : "unknown" });
  }
}

async function transition(db: AdminClient, requestId: string, current: BookingRequestStatus, next: BookingRequestStatus) {
  assertBookingRequestTransition(current, next);
  const { error } = await db.from("booking_requests").update({ status: next, updated_at: new Date().toISOString() }).eq("id", requestId).eq("status", current);
  if (error) throw new Error(`Unable to transition booking request: ${error.message}`);
}

// ---------------------------------------------------------------------
// Guest: preview + submit
// ---------------------------------------------------------------------

export type PreviewQuoteInput = { propertySlug: string; arrival: string; departure: string };
export type PreviewQuoteResult =
  | { ok: true; nights: number; nightlyRateMinor: number; subtotalMinor: number; cleaningFeeMinor: number; taxMinor: number; totalMinor: number; currency: string }
  | { ok: false; code: "property_not_found" | "request_intake_disabled" | "invalid_dates" };

export async function previewBookingRequestQuote(input: PreviewQuoteInput): Promise<PreviewQuoteResult> {
  const admin = createAdminClient();
  const { data: property } = await admin
    .from("properties")
    .select("id, metadata, nightly_rate, cleaning_fee, tax_rate")
    .eq("slug", input.propertySlug)
    .eq("status", "active")
    .maybeSingle();
  if (!property) return { ok: false, code: "property_not_found" };
  if (!isRequestIntakeEnabled(property.metadata)) return { ok: false, code: "request_intake_disabled" };

  try {
    const quote = calculateProvisionalQuote(
      { nightlyRate: Number(property.nightly_rate), cleaningFee: Number(property.cleaning_fee), taxRate: property.tax_rate === null ? null : Number(property.tax_rate) },
      { arrival: input.arrival, departure: input.departure },
    );
    return { ok: true, ...quote };
  } catch {
    return { ok: false, code: "invalid_dates" };
  }
}

function isRequestIntakeEnabled(metadata: unknown): boolean {
  return Boolean(metadata && typeof metadata === "object" && (metadata as Record<string, unknown>).direct_booking_enabled === true && process.env.BOOKING_REQUEST_INTAKE_ENABLED !== "false");
}

export type SubmitBookingRequestInput = {
  propertySlug: string;
  arrival: string;
  departure: string;
  adults: number;
  children?: number;
  pets?: number;
  fullName: string;
  email: string;
  phone?: string;
  visitPurpose?: string;
  accessibilityNeeds?: string;
  consentAcknowledged: boolean;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  referralId?: string;
};

export type SubmitBookingRequestResult =
  | { ok: true; requestToken: string; slaDueAt: string; totalMinor: number; currency: string }
  | { ok: false; code: "property_not_found" | "request_intake_disabled" | "invalid_dates" | "invalid_input" };

// LHS-UX-005: validate stay length, occupancy, date order, and required
// fields before ever writing a row.
function validateSubmission(input: SubmitBookingRequestInput, maxGuests: number, minimumNights: number, nights: number): boolean {
  if (!input.fullName.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) return false;
  if (!input.consentAcknowledged) return false;
  if (!Number.isInteger(input.adults) || input.adults < 1) return false;
  const children = input.children ?? 0;
  const pets = input.pets ?? 0;
  if (!Number.isInteger(children) || children < 0 || !Number.isInteger(pets) || pets < 0) return false;
  if (input.adults + children > maxGuests) return false;
  if (nights < minimumNights) return false;
  return true;
}

export async function submitBookingRequest(input: SubmitBookingRequestInput): Promise<SubmitBookingRequestResult> {
  const admin = createAdminClient();
  const { data: property } = await admin
    .from("properties")
    .select("id, name, metadata, nightly_rate, cleaning_fee, tax_rate, max_guests, minimum_nights")
    .eq("slug", input.propertySlug)
    .eq("status", "active")
    .maybeSingle();
  if (!property) return { ok: false, code: "property_not_found" };
  if (!isRequestIntakeEnabled(property.metadata)) return { ok: false, code: "request_intake_disabled" };

  let quote: ReturnType<typeof calculateProvisionalQuote>;
  try {
    quote = calculateProvisionalQuote(
      { nightlyRate: Number(property.nightly_rate), cleaningFee: Number(property.cleaning_fee), taxRate: property.tax_rate === null ? null : Number(property.tax_rate) },
      { arrival: input.arrival, departure: input.departure },
    );
  } catch {
    return { ok: false, code: "invalid_dates" };
  }

  if (!validateSubmission(input, property.max_guests, property.minimum_nights, quote.nights)) {
    return { ok: false, code: "invalid_input" };
  }

  const requestToken = randomBytes(24).toString("base64url");
  const now = new Date();
  const slaDueAt = new Date(now.getTime() + REVIEW_SLA_HOURS * 60 * 60 * 1000);

  const { data: request, error } = await admin
    .from("booking_requests")
    .insert({
      request_token: requestToken,
      property_id: property.id,
      arrival: input.arrival,
      departure: input.departure,
      guest_count: input.adults + (input.children ?? 0),
      adults: input.adults,
      children: input.children ?? 0,
      pets: input.pets ?? 0,
      status: "submitted",
      sla_due_at: slaDueAt.toISOString(),
      utm_source: input.utmSource ?? null,
      utm_medium: input.utmMedium ?? null,
      utm_campaign: input.utmCampaign ?? null,
      referral_id: input.referralId ?? null,
      expires_at: slaDueAt.toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new Error(`Unable to submit booking request: ${error.message}`);

  const { error: guestError } = await admin.from("booking_request_guests").insert({
    booking_request_id: request.id,
    full_name: input.fullName.trim(),
    email: input.email.trim(),
    phone: input.phone?.trim() || null,
    visit_purpose: input.visitPurpose?.trim() || null,
    accessibility_needs: input.accessibilityNeeds?.trim() || null,
  });
  if (guestError) throw new Error(`Unable to record request contact details: ${guestError.message}`);

  const { error: quoteError } = await admin.from("request_quotes").insert({
    booking_request_id: request.id,
    version: 1,
    status: "accepted",
    nights: quote.nights,
    nightly_rate_minor: quote.nightlyRateMinor,
    subtotal_minor: quote.subtotalMinor,
    cleaning_fee_minor: quote.cleaningFeeMinor,
    tax_minor: quote.taxMinor,
    total_minor: quote.totalMinor,
    currency: quote.currency,
    rate_config_version: `property:${property.id}:v1`,
    expires_at: slaDueAt.toISOString(),
  });
  if (quoteError) throw new Error(`Unable to record the request quote: ${quoteError.message}`);

  const workspaceId = await resolvePropertyWorkspaceId(admin, property.id);
  await createActionCenterTask(
    admin,
    workspaceId,
    buildBookingRequestReviewAction({
      workspaceId: workspaceId ?? "",
      bookingRequestId: request.id,
      propertyName: property.name,
      arrival: input.arrival,
      departure: input.departure,
      slaDueAt: slaDueAt.toISOString(),
    }),
  );

  return { ok: true, requestToken, slaDueAt: slaDueAt.toISOString(), totalMinor: quote.totalMinor, currency: quote.currency };
}

// ---------------------------------------------------------------------
// Guest: status, withdrawal
// ---------------------------------------------------------------------

export type BookingRequestStatusView = {
  state: "not_found";
} | {
  state: "active";
  status: BookingRequestStatus;
  propertyName: string;
  propertySlug: string;
  arrival: string;
  departure: string;
  guestCount: number;
  totalMinor: number | null;
  currency: string | null;
  slaDueAt: string | null;
  requestToken: string;
} | {
  state: "confirmed";
  confirmationCode: string | null;
  propertyName: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  amountPaidMinor: number | null;
  currency: string | null;
};

export async function getBookingRequestStatus(requestToken: string): Promise<BookingRequestStatusView> {
  if (!requestToken) return { state: "not_found" };
  const admin = createAdminClient();
  const { data: request } = await admin
    .from("booking_requests")
    .select("id, status, arrival, departure, guest_count, property:properties!inner(name, slug)")
    .eq("request_token", requestToken)
    .maybeSingle();
  if (!request) return { state: "not_found" };

  const property = request.property as unknown as { name: string; slug: string } | { name: string; slug: string }[];
  const propertyRow = Array.isArray(property) ? property[0] : property;
  const propertyName = propertyRow?.name;
  const propertySlug = propertyRow?.slug ?? "mesa";

  if (request.status === "confirmed") {
    const { data: booking } = await admin
      .from("bookings")
      .select("booking_code, check_in, check_out, guests, total_amount, currency")
      .eq("booking_request_id", request.id)
      .maybeSingle();
    if (booking) {
      return {
        state: "confirmed",
        confirmationCode: booking.booking_code,
        propertyName: propertyName ?? "your stay",
        checkIn: booking.check_in,
        checkOut: booking.check_out,
        guests: booking.guests,
        amountPaidMinor: booking.total_amount === null ? null : Math.round(Number(booking.total_amount) * 100),
        currency: booking.currency,
      };
    }
    // Payment verified but booking not yet visible — treat as still active/pending.
  }

  const { data: quote } = await admin
    .from("request_quotes")
    .select("total_minor, currency")
    .eq("booking_request_id", request.id)
    .eq("status", "accepted")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: requestRow } = await admin.from("booking_requests").select("sla_due_at").eq("id", request.id).maybeSingle();

  return {
    state: "active",
    status: request.status as BookingRequestStatus,
    propertyName: propertyName ?? "your stay",
    propertySlug,
    arrival: request.arrival,
    departure: request.departure,
    guestCount: request.guest_count ?? 0,
    totalMinor: quote?.total_minor ?? null,
    currency: quote?.currency ?? null,
    slaDueAt: requestRow?.sla_due_at ?? null,
    requestToken,
  };
}

export async function withdrawBookingRequest(requestToken: string): Promise<{ ok: boolean }> {
  const admin = createAdminClient();
  const { data: request } = await admin.from("booking_requests").select("id, status").eq("request_token", requestToken).maybeSingle();
  if (!request) return { ok: false };
  try {
    await transition(admin, request.id, request.status as BookingRequestStatus, "withdrawn");
    await admin.from("booking_requests").update({ withdrawn_at: new Date().toISOString() }).eq("id", request.id);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

// ---------------------------------------------------------------------
// Operator: review, block, release
// ---------------------------------------------------------------------

export async function approveRequestForBlock(requestId: string, input: { conflictCheckEvidence: Record<string, boolean>; notes?: string }): Promise<void> {
  const c = await adminContext();
  const { data: request, error } = await c.db.from("booking_requests").select("status").eq("id", requestId).single();
  if (error || !request) throw new Error("Booking request not found.");

  const { data: quote } = await c.db.from("request_quotes").select("id").eq("booking_request_id", requestId).eq("status", "accepted").order("version", { ascending: false }).limit(1).maybeSingle();

  await transition(c.db, requestId, request.status as BookingRequestStatus, "approved");
  const { error: reviewError } = await c.db.from("request_reviews").insert({
    booking_request_id: requestId,
    decision: "approved",
    actor_id: c.user.id,
    conflict_check_evidence: input.conflictCheckEvidence,
    quote_id: quote?.id ?? null,
    notes: input.notes?.trim() || null,
  });
  if (reviewError) throw new Error(`Unable to record the review: ${reviewError.message}`);

  await audit(c.db, { actorId: c.user.id, actorRole: c.profile.role, action: "booking_request.approved", targetId: requestId, result: "succeeded", correlationId: c.correlationId });
}

export async function declineRequest(requestId: string, input: { notes: string }): Promise<void> {
  const c = await adminContext();
  const { data: request, error } = await c.db.from("booking_requests").select("status, property_id").eq("id", requestId).single();
  if (error || !request) throw new Error("Booking request not found.");

  await transition(c.db, requestId, request.status as BookingRequestStatus, "declined");
  await c.db.from("request_reviews").insert({ booking_request_id: requestId, decision: "declined", actor_id: c.user.id, notes: input.notes.trim() });
  await audit(c.db, { actorId: c.user.id, actorRole: c.profile.role, action: "booking_request.declined", targetId: requestId, result: "succeeded", correlationId: c.correlationId, metadata: { reason: "operator_declined" } });

  await releaseIfBlocked(c.db, requestId, request.property_id, "Request declined.");
}

export async function proposeAlternateRequestDates(
  requestId: string,
  input: { arrival: string; departure: string; notes?: string },
): Promise<void> {
  const c = await adminContext();
  const { data: request, error } = await c.db.from("booking_requests").select("status, property_id").eq("id", requestId).single();
  if (error || !request) throw new Error("Booking request not found.");

  const { data: property } = await c.db.from("properties").select("nightly_rate, cleaning_fee, tax_rate").eq("id", request.property_id).single();
  const { data: currentQuote } = await c.db.from("request_quotes").select("version").eq("booking_request_id", requestId).order("version", { ascending: false }).limit(1).single();

  const quote = calculateProvisionalQuote(
    { nightlyRate: Number(property!.nightly_rate), cleaningFee: Number(property!.cleaning_fee), taxRate: property!.tax_rate === null ? null : Number(property!.tax_rate) },
    { arrival: input.arrival, departure: input.departure },
  );
  const expiresAt = new Date(Date.now() + QUOTE_VALID_HOURS * 60 * 60 * 1000).toISOString();
  const nextVersion = (currentQuote?.version ?? 0) + 1;

  await c.db.from("request_quotes").update({ status: "superseded" }).eq("booking_request_id", requestId).eq("status", "accepted");
  const { data: newQuote, error: quoteError } = await c.db
    .from("request_quotes")
    .insert({
      booking_request_id: requestId, version: nextVersion, status: "accepted",
      nights: quote.nights, nightly_rate_minor: quote.nightlyRateMinor, subtotal_minor: quote.subtotalMinor,
      cleaning_fee_minor: quote.cleaningFeeMinor, tax_minor: quote.taxMinor, total_minor: quote.totalMinor,
      currency: quote.currency, rate_config_version: `property:${request.property_id}:v1`, expires_at: expiresAt,
    })
    .select("id")
    .single();
  if (quoteError) throw new Error(`Unable to record the alternate quote: ${quoteError.message}`);

  await c.db.from("booking_requests").update({ arrival: input.arrival, departure: input.departure, updated_at: new Date().toISOString() }).eq("id", requestId);
  await transition(c.db, requestId, request.status as BookingRequestStatus, "alternate_proposed");
  await c.db.from("request_reviews").insert({ booking_request_id: requestId, decision: "alternate_proposed", actor_id: c.user.id, quote_id: newQuote.id, notes: input.notes?.trim() || null });
  await audit(c.db, { actorId: c.user.id, actorRole: c.profile.role, action: "booking_request.alternate_proposed", targetId: requestId, result: "succeeded", correlationId: c.correlationId });
}

export async function acceptAlternateProposal(requestToken: string): Promise<{ ok: boolean }> {
  const admin = createAdminClient();
  const { data: request } = await admin.from("booking_requests").select("id, status").eq("request_token", requestToken).maybeSingle();
  if (!request) return { ok: false };
  try {
    await transition(admin, request.id, request.status as BookingRequestStatus, "submitted");
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export type RecordCalendarBlockInput = {
  calendarSystem: string;
  externalReference?: string;
  attestation?: string;
  artifactReference?: string;
  expiresAt: string;
};

export async function recordCalendarBlock(requestId: string, input: RecordCalendarBlockInput): Promise<void> {
  const c = await adminContext();
  const { data: request, error } = await c.db.from("booking_requests").select("status, property_id, arrival, departure").eq("id", requestId).single();
  if (error || !request) throw new Error("Booking request not found.");
  if (request.status !== "approved") throw new Error("Only an approved request can be blocked.");

  const { data: quote, error: quoteError } = await c.db.from("request_quotes").select("id, expires_at").eq("booking_request_id", requestId).eq("status", "accepted").order("version", { ascending: false }).limit(1).single();
  if (quoteError || !quote) throw new Error("No accepted quote to bind the block to.");
  if (!input.calendarSystem.trim() || (!input.externalReference?.trim() && !input.attestation?.trim())) {
    throw new Error("Block evidence requires a calendar system and either a reference or an attestation.");
  }

  const { error: blockError } = await c.db.from("calendar_blocks").insert({
    booking_request_id: requestId,
    property_id: request.property_id,
    arrival: request.arrival,
    departure: request.departure,
    quote_id: quote.id,
    calendar_system: input.calendarSystem.trim(),
    external_reference: input.externalReference?.trim() || null,
    attestation: input.attestation?.trim() || null,
    artifact_reference: input.artifactReference?.trim() || null,
    operator_id: c.user.id,
    expires_at: input.expiresAt,
  });
  if (blockError) throw new Error(`Unable to record the calendar block: ${blockError.message}`);

  await transition(c.db, requestId, "approved", "awaiting_payment");
  await audit(c.db, { actorId: c.user.id, actorRole: c.profile.role, action: "booking_request.block_recorded", targetId: requestId, result: "succeeded", correlationId: c.correlationId, metadata: { calendarSystem: input.calendarSystem } });
}

export async function releaseCalendarBlock(blockId: string, input: { reference?: string; outcome: string }): Promise<void> {
  const c = await adminContext();
  const { error } = await c.db
    .from("calendar_blocks")
    .update({ status: "released", released_at: new Date().toISOString(), release_operator_id: c.user.id, release_reference: input.reference?.trim() || null, release_outcome: input.outcome.trim() })
    .eq("id", blockId)
    .eq("status", "active");
  if (error) throw new Error(`Unable to release the calendar block: ${error.message}`);
  await audit(c.db, { actorId: c.user.id, actorRole: c.profile.role, action: "booking_request.block_released", targetId: blockId, result: "succeeded", correlationId: c.correlationId });
}

async function releaseIfBlocked(db: AdminClient, requestId: string, propertyId: string, reason: string): Promise<void> {
  const { data: block } = await db.from("calendar_blocks").select("id").eq("booking_request_id", requestId).eq("status", "active").maybeSingle();
  if (!block) return;
  const workspaceId = await resolvePropertyWorkspaceId(db, propertyId);
  const { data: property } = await db.from("properties").select("name").eq("id", propertyId).maybeSingle();
  await createActionCenterTask(
    db,
    workspaceId,
    buildBlockReleaseAction({ workspaceId: workspaceId ?? "", bookingRequestId: requestId, calendarBlockId: block.id, propertyName: property?.name ?? "the property", reason }),
  );
}

// ---------------------------------------------------------------------
// Guest: payment invitation — the hard gate (LHS-PR-002/LHS-BLK-003)
// ---------------------------------------------------------------------

export type CreatePaymentInvitationResult =
  | { ok: true; redirectUrl: string }
  | { ok: false; code: "not_found" | "gate_not_ready" | "checkout_unavailable" };

export async function createPaymentInvitation(requestToken: string): Promise<CreatePaymentInvitationResult> {
  const admin = createAdminClient();
  const { data: request } = await admin
    .from("booking_requests")
    .select("id, status, property_id, request_token")
    .eq("request_token", requestToken)
    .maybeSingle();
  if (!request) return { ok: false, code: "not_found" };

  // Re-validate the entire gate here, on the server, at invitation time —
  // never trust that an earlier check still holds (LHS-PR-002).
  if (request.status !== "awaiting_payment") return { ok: false, code: "gate_not_ready" };

  const { data: quote } = await admin.from("request_quotes").select("*").eq("booking_request_id", request.id).eq("status", "accepted").order("version", { ascending: false }).limit(1).maybeSingle();
  if (!quote || new Date(quote.expires_at).getTime() <= Date.now()) return { ok: false, code: "gate_not_ready" };

  const { data: block } = await admin
    .from("calendar_blocks")
    .select("*")
    .eq("booking_request_id", request.id)
    .eq("status", "active")
    .maybeSingle();
  if (!block || block.quote_id !== quote.id || new Date(block.expires_at).getTime() <= Date.now()) {
    return { ok: false, code: "gate_not_ready" };
  }

  const { data: guest } = await admin.from("booking_request_guests").select("email, full_name").eq("booking_request_id", request.id).maybeSingle();
  const { data: property } = await admin.from("properties").select("name").eq("id", request.property_id).maybeSingle();
  if (!guest || !property) return { ok: false, code: "gate_not_ready" };

  const idempotencyKey = `booking-request:${request.id}:invitation:${quote.id}`;
  const returnBase = approvedOrigin();

  try {
    const client = getBookingStripeClient();
    const session = await client.createCheckoutSession({
      customerEmail: guest.email,
      currency: quote.currency,
      amountMinor: quote.total_minor,
      productName: `${property.name} stay`,
      successUrl: `${returnBase}/stays/booking/return?request=${requestToken}`,
      cancelUrl: `${returnBase}/stays/booking/status?request=${requestToken}`,
      metadata: {
        booking_request_id: request.id,
        property_id: request.property_id,
        quote_id: quote.id,
        calendar_block_id: block.id,
      },
      idempotencyKey,
    });

    await admin.from("payment_invitations").upsert(
      {
        booking_request_id: request.id,
        quote_id: quote.id,
        calendar_block_id: block.id,
        environment: session.environment,
        stripe_checkout_session_id: session.id,
        amount_minor: quote.total_minor,
        currency: quote.currency,
        idempotency_key: idempotencyKey,
        expires_at: block.expires_at,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "idempotency_key" },
    );

    if (!session.url) return { ok: false, code: "checkout_unavailable" };
    return { ok: true, redirectUrl: session.url };
  } catch (error) {
    console.error("booking_request_payment_invitation_failed", { requestId: request.id, error: error instanceof Error ? error.message : "unknown" });
    return { ok: false, code: "checkout_unavailable" };
  }
}

