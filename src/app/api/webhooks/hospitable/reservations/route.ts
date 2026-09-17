import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getHospitableReservationDetail } from "@/features/integrations/hospitable/lib/reservations";
import { mapHospitableReservation } from "@/features/integrations/hospitable/lib/reservation-mapper";
import { upsertBooking } from "@/features/integrations/hospitable/lib/sync-reservations";
import { resolveHospitableMessagingWorkspace } from "@/features/integrations/hospitable/lib/messaging-workspace";
import { sanitizeAuditMetadata } from "@/features/admin-operations/domain/operations";
import { buildBookingExceptionAction } from "@/features/integrations/hospitable/lib/booking-exception-action";
import { SupabasePlatformActionRepository } from "@/platform/actions";
import { track } from "@/lib/analytics/track";

/**
 * LHS-INT-010..015: Hospitable reservation webhook.
 *
 * Design choice: the webhook body is treated only as a "go re-check
 * reservation X" trigger, never as authoritative data (LHS-PR-002). Every
 * accepted event re-fetches the reservation from Hospitable's API and
 * upserts through the same pipeline the scheduled sync uses
 * (`upsertBooking`), so the result always converges on Hospitable's current
 * state regardless of webhook delivery order — this is what satisfies
 * LHS-INT-014 (no out-of-order overwrite) without needing a timestamp diff.
 *
 * Known limitation (documented, not fixed in this pass): processing runs
 * synchronously in the request path rather than being queued, so LHS-INT-015
 * ("acknowledgement independent of slow downstream work") is only partially
 * met — acceptable for the pilot's volume, revisit before scaling past Mesa.
 */

type Payload = Record<string, unknown>;

const PROVIDER = "hospitable";
const RESERVATION_EVENT_TYPES = new Set(["reservation.created", "reservation.changed"]);

export async function POST(request: Request) {
  const secret = process.env.HOSPITABLE_RESERVATIONS_WEBHOOK_SECRET;
  const rawBody = await request.text();

  if (!secret || !authenticated(request, rawBody, secret)) {
    return NextResponse.json({ accepted: false, code: "webhook_unauthorized" }, { status: 401 });
  }

  let envelope: Payload;
  try {
    envelope = JSON.parse(rawBody) as Payload;
  } catch {
    return NextResponse.json({ accepted: false, code: "webhook_invalid" }, { status: 400 });
  }

  const eventType = text(envelope, "event") || text(envelope, "type");
  const data = (envelope.data && typeof envelope.data === "object" ? envelope.data : envelope) as Payload;
  const reservationId = text(data, "id") || text(data, "reservation_id") || text(data, "reservation_uuid");

  if (!RESERVATION_EVENT_TYPES.has(eventType) || !reservationId) {
    // Not a reservation lifecycle event this route handles; ack so Hospitable
    // does not retry an event we will never process.
    return NextResponse.json({ accepted: true, code: "event_ignored" });
  }

  const providerEventId =
    text(envelope, "id") ||
    text(envelope, "event_id") ||
    text(data, "event_id") ||
    // Deterministic fallback per LHS-INT-013. Coarser than an ideal provider
    // event id: revisit once a real Hospitable payload sample confirms
    // whether a stable per-delivery id is available.
    `${eventType}:${reservationId}:${text(data, "updated_at") || text(envelope, "occurred_at") || text(envelope, "created_at") || ""}`;

  const admin = createAdminClient();

  const existing = await findOrCreateReceipt(admin, providerEventId, eventType);
  if (existing.duplicate) {
    return NextResponse.json({ accepted: true, code: "duplicate_event" });
  }
  const receiptId = existing.receiptId;

  let reservation;
  try {
    reservation = await getHospitableReservationDetail(reservationId);
  } catch (error) {
    await markReceiptFailed(admin, receiptId, "reservation_fetch_failed", error);
    return NextResponse.json({ accepted: false, code: "reservation_fetch_failed" }, { status: 503 });
  }

  const externalPropertyId = reservation.properties?.[0]?.id;
  if (!externalPropertyId) {
    await markReceiptUnresolved(admin, receiptId, reservationId, null);
    await createException(admin, {
      reservationExternalId: reservationId,
      propertyId: null,
      issueType: "reservation_missing_property",
      evidence: { eventType, reservationId },
    });
    return NextResponse.json({ accepted: true, code: "reservation_missing_property", reviewRequired: true }, { status: 202 });
  }

  const { data: link, error: linkError } = await admin
    .from("external_properties")
    .select("property_id, connection_id")
    .eq("provider", PROVIDER)
    .eq("external_id", externalPropertyId)
    .not("property_id", "is", null)
    .maybeSingle();

  if (linkError || !link?.property_id) {
    await markReceiptUnresolved(admin, receiptId, reservationId, null);
    await createException(admin, {
      reservationExternalId: reservationId,
      propertyId: null,
      issueType: "unmapped_property",
      evidence: { eventType, reservationId, externalPropertyId },
    });
    return NextResponse.json({ accepted: true, code: "unmapped_property", reviewRequired: true }, { status: 202 });
  }

  const localPropertyId = String(link.property_id);

  try {
    const messagingWorkspace = await resolveHospitableMessagingWorkspace({
      connectionId: link.connection_id ? String(link.connection_id) : undefined,
      propertyId: localPropertyId,
    });
    const mapping = mapHospitableReservation({ reservation, localPropertyId });
    await upsertBooking(mapping.booking, messagingWorkspace.workspaceId);
    await correlateCheckoutAttempt(admin, localPropertyId, mapping.booking);
    if (mapping.booking.status === "cancelled" && mapping.booking.external_platform.toLowerCase() === "direct") {
      track("stay_booking_cancelled", { reservationId });
    }
  } catch (error) {
    await markReceiptFailed(admin, receiptId, "reservation_upsert_failed", error);
    await createException(admin, {
      reservationExternalId: reservationId,
      propertyId: localPropertyId,
      issueType: "reservation_upsert_failed",
      evidence: { eventType, reservationId },
    });
    await createBookingExceptionAction(admin, localPropertyId, "reservation_upsert_failed", reservationId);
    return NextResponse.json({ accepted: false, code: "reservation_upsert_failed" }, { status: 503 });
  }

  await admin
    .from("hospitable_reservation_events")
    .update({
      status: "processed",
      processed_at: new Date().toISOString(),
      related_property_id: localPropertyId,
      related_reservation_external_id: reservationId,
    })
    .eq("id", receiptId);

  return NextResponse.json({ accepted: true });
}

async function findOrCreateReceipt(
  admin: ReturnType<typeof createAdminClient>,
  providerEventId: string,
  eventType: string,
): Promise<{ duplicate: boolean; receiptId: string }> {
  const { data: existing, error: selectError } = await admin
    .from("hospitable_reservation_events")
    .select("id, status")
    .eq("environment", "live")
    .eq("provider_event_id", providerEventId)
    .maybeSingle();

  if (selectError) {
    throw new Error(`Unable to check Hospitable reservation event receipt: ${selectError.message}`);
  }

  if (existing) {
    const terminal = existing.status === "processed" || existing.status === "ignored" || existing.status === "unresolved";
    return { duplicate: terminal, receiptId: String(existing.id) };
  }

  const { data: inserted, error: insertError } = await admin
    .from("hospitable_reservation_events")
    .insert({
      environment: "live",
      provider_event_id: providerEventId,
      provider_event_type: eventType,
      status: "received",
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      // Concurrent delivery raced us; the other request owns processing.
      return { duplicate: true, receiptId: "" };
    }
    throw new Error(`Unable to record Hospitable reservation event receipt: ${insertError.message}`);
  }

  return { duplicate: false, receiptId: String(inserted.id) };
}

async function markReceiptFailed(
  admin: ReturnType<typeof createAdminClient>,
  receiptId: string,
  code: string,
  error: unknown,
): Promise<void> {
  if (!receiptId) return;
  await admin
    .from("hospitable_reservation_events")
    .update({
      status: "failed",
      processed_at: new Date().toISOString(),
      last_error_code: code,
      last_error_message: error instanceof Error ? error.message.slice(0, 500) : "Unknown error.",
    })
    .eq("id", receiptId);
}

async function markReceiptUnresolved(
  admin: ReturnType<typeof createAdminClient>,
  receiptId: string,
  reservationId: string,
  propertyId: string | null,
): Promise<void> {
  if (!receiptId) return;
  await admin
    .from("hospitable_reservation_events")
    .update({
      status: "unresolved",
      processed_at: new Date().toISOString(),
      related_property_id: propertyId,
      related_reservation_external_id: reservationId,
    })
    .eq("id", receiptId);
}

/**
 * Best-effort attribution join (LHS-AN-002/003): Hospitable's checkout does
 * not currently echo our attempt token back on the reservation, so this
 * matches on property + exact dates among still-open attempts. If Hospitable
 * Direct later supports a passthrough reference, prefer that over this.
 */
async function correlateCheckoutAttempt(
  admin: ReturnType<typeof createAdminClient>,
  localPropertyId: string,
  booking: { external_reservation_id: string; check_in: string; check_out: string; external_platform: string },
): Promise<void> {
  if (booking.external_platform.toLowerCase() !== "direct") return;

  const { data: attempt } = await admin
    .from("checkout_attempts")
    .select("id")
    .eq("property_id", localPropertyId)
    .eq("arrival", booking.check_in)
    .eq("departure", booking.check_out)
    .in("status", ["started", "redirected", "verification_pending"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!attempt) return;

  await admin
    .from("bookings")
    .update({ checkout_attempt_id: attempt.id })
    .eq("external_provider", "hospitable")
    .eq("external_reservation_id", booking.external_reservation_id);

  await admin.from("checkout_attempts").update({ status: "confirmed", updated_at: new Date().toISOString() }).eq("id", attempt.id);
}

async function createBookingExceptionAction(
  admin: ReturnType<typeof createAdminClient>,
  propertyId: string,
  issueType: string,
  reservationExternalId: string | null,
): Promise<void> {
  try {
    const { workspaceId } = await resolveHospitableMessagingWorkspace({ propertyId });
    const action = buildBookingExceptionAction({ workspaceId, issueType, reservationExternalId, propertyId });
    await new SupabasePlatformActionRepository(admin).add({ action });
  } catch (error) {
    // No resolvable workspace, or a duplicate of an already-created task on
    // retry — never let this surface as a webhook processing error.
    console.error("booking_exception_action_create_failed", {
      issueType,
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}

async function createException(
  admin: ReturnType<typeof createAdminClient>,
  input: { reservationExternalId: string; propertyId: string | null; issueType: string; evidence: Record<string, unknown> },
): Promise<void> {
  const { error } = await admin.from("booking_exceptions").insert({
    reservation_external_id: input.reservationExternalId,
    property_id: input.propertyId,
    issue_type: input.issueType,
    provider_evidence: sanitizeAuditMetadata(input.evidence),
    status: "open",
  });
  if (error) {
    console.error("booking_exception_create_failed", { issueType: input.issueType, errorCode: error.code });
  }
}

function text(value: Payload, key: string): string {
  return typeof value[key] === "string" ? String(value[key]).trim() : "";
}

function safeEqual(first: string, second: string): boolean {
  const a = Buffer.from(first);
  const b = Buffer.from(second);
  return a.length === b.length && timingSafeEqual(a, b);
}

function authenticated(request: Request, rawBody: string, secret: string): boolean {
  const authorization = request.headers.get("authorization") ?? "";
  if (safeEqual(authorization, `Bearer ${secret}`)) return true;

  const timestamp = request.headers.get("x-luxe-webhook-timestamp") ?? "";
  const signature = (request.headers.get("x-luxe-webhook-signature") ?? "").replace(/^sha256=/, "");
  const time = Number(timestamp);
  if (!Number.isFinite(time) || Math.abs(Date.now() - time * 1000) > 300_000) return false;
  return safeEqual(signature, createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex"));
}
