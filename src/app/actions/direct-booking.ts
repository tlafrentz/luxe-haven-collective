"use server";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDirectBookingWidgetConfig, buildHospitableCheckoutUrl } from "@/lib/direct-booking";

const ACTIVE_ATTEMPT_STATUSES = ["started", "redirected", "verification_pending"];

export type StartCheckoutAttemptInput = {
  propertySlug: string;
  arrival?: string;
  departure?: string;
  guestCount?: number;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  referralId?: string;
  /** Reuse a still-active attempt instead of starting a new one — LHS-UX-021:
   * repeated activation must not create multiple concurrent attempts. */
  existingAttemptToken?: string;
};

export type StartCheckoutAttemptResult =
  | { ok: true; attemptToken: string; redirectUrl: string | null }
  | { ok: false; code: "property_not_found" | "direct_booking_disabled" };

function approvedOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const value = new URL(raw);
  if (value.protocol !== "https:" && !value.hostname.endsWith("localhost")) {
    throw new Error("LHS001_RETURN_ORIGIN_INVALID");
  }
  return value.origin;
}

function buildRedirect(attemptToken: string, externalPropertyId: string | null): string | null {
  const config = getDirectBookingWidgetConfig();
  if (!externalPropertyId || !config.checkoutUrlTemplate) {
    // Foundation-phase placeholder: no live Hospitable Direct checkout target
    // configured yet. The checkout page shows a "not yet available" state
    // instead of a broken or fabricated redirect (LHS-NFR-002).
    return null;
  }
  const returnUrl = `${approvedOrigin()}/stays/booking/return?attempt=${attemptToken}`;
  return buildHospitableCheckoutUrl(config.checkoutUrlTemplate, { externalPropertyId, returnUrl });
}

export async function startCheckoutAttempt(
  input: StartCheckoutAttemptInput,
): Promise<StartCheckoutAttemptResult> {
  const admin = createAdminClient();

  const { data: property } = await admin
    .from("properties")
    .select("id, metadata")
    .eq("slug", input.propertySlug)
    .eq("status", "active")
    .maybeSingle();

  if (!property) return { ok: false, code: "property_not_found" };

  const metadata = property.metadata as Record<string, unknown> | null;
  if (!metadata || metadata.direct_booking_enabled !== true) {
    return { ok: false, code: "direct_booking_disabled" };
  }

  const { data: link } = await admin
    .from("external_properties")
    .select("external_id")
    .eq("provider", "hospitable")
    .eq("property_id", property.id)
    .maybeSingle();
  const externalPropertyId = link?.external_id ?? null;

  if (input.existingAttemptToken) {
    const { data: existing } = await admin
      .from("checkout_attempts")
      .select("attempt_token, status, expires_at")
      .eq("attempt_token", input.existingAttemptToken)
      .eq("property_id", property.id)
      .maybeSingle();

    if (
      existing &&
      ACTIVE_ATTEMPT_STATUSES.includes(existing.status) &&
      new Date(existing.expires_at).getTime() > Date.now()
    ) {
      return { ok: true, attemptToken: existing.attempt_token, redirectUrl: buildRedirect(existing.attempt_token, externalPropertyId) };
    }
  }

  const attemptToken = randomBytes(24).toString("base64url");
  const { error } = await admin.from("checkout_attempts").insert({
    attempt_token: attemptToken,
    property_id: property.id,
    external_property_id: externalPropertyId,
    arrival: input.arrival ?? null,
    departure: input.departure ?? null,
    guest_count: input.guestCount ?? null,
    status: "started",
    utm_source: input.utmSource ?? null,
    utm_medium: input.utmMedium ?? null,
    utm_campaign: input.utmCampaign ?? null,
    referral_id: input.referralId ?? null,
  });

  if (error) {
    throw new Error(`Unable to start checkout attempt: ${error.message}`);
  }

  return { ok: true, attemptToken, redirectUrl: buildRedirect(attemptToken, externalPropertyId) };
}

export type CheckoutAttemptVerification =
  | { state: "not_found" }
  | { state: "pending" }
  | {
      state: "confirmed";
      confirmationCode: string | null;
      propertyName: string;
      checkIn: string;
      checkOut: string;
      guests: number;
    };

/**
 * LHS-UX-040/041/PR-002: never trust the return URL's own parameters. This
 * looks up the attempt by its token, then requires a matching verified
 * `bookings` projection (written only by the webhook/reconciliation path)
 * before ever rendering "confirmed".
 */
export async function verifyCheckoutAttempt(attemptToken: string): Promise<CheckoutAttemptVerification> {
  if (!attemptToken) return { state: "not_found" };
  const admin = createAdminClient();

  const { data: attempt } = await admin
    .from("checkout_attempts")
    .select("id, property_id, external_property_id, arrival, departure")
    .eq("attempt_token", attemptToken)
    .maybeSingle();

  if (!attempt) return { state: "not_found" };

  const { data: booking } = await admin
    .from("bookings")
    .select("booking_code, check_in, check_out, guests, property:properties!inner(name)")
    .eq("checkout_attempt_id", attempt.id)
    .eq("external_provider", "hospitable")
    .in("status", ["confirmed", "completed"])
    .maybeSingle();

  if (!booking) {
    // Fall back to a best-effort match on property + dates for the case
    // where the reservation arrived before we could correlate it back to
    // this attempt (see the webhook's reservation-to-attempt heuristic).
    if (attempt.arrival && attempt.departure) {
      const { data: fallbackBooking } = await admin
        .from("bookings")
        .select("booking_code, check_in, check_out, guests, property:properties!inner(name)")
        .eq("property_id", attempt.property_id)
        .eq("external_provider", "hospitable")
        .eq("external_platform", "direct")
        .eq("check_in", attempt.arrival)
        .eq("check_out", attempt.departure)
        .in("status", ["confirmed", "completed"])
        .order("last_synced_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (fallbackBooking) {
        const property = fallbackBooking.property as unknown as { name: string } | { name: string }[];
        const propertyName = Array.isArray(property) ? property[0]?.name : property?.name;
        return {
          state: "confirmed",
          confirmationCode: fallbackBooking.booking_code,
          propertyName: propertyName ?? "your stay",
          checkIn: fallbackBooking.check_in,
          checkOut: fallbackBooking.check_out,
          guests: fallbackBooking.guests,
        };
      }
    }
    return { state: "pending" };
  }

  const property = booking.property as unknown as { name: string } | { name: string }[];
  const propertyName = Array.isArray(property) ? property[0]?.name : property?.name;

  return {
    state: "confirmed",
    confirmationCode: booking.booking_code,
    propertyName: propertyName ?? "your stay",
    checkIn: booking.check_in,
    checkOut: booking.check_out,
    guests: booking.guests,
  };
}
