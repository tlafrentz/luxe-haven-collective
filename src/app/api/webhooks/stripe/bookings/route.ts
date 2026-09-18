import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyStripeWebhook, resolveStripeCommerceEnvironment } from "@/platform/commerce";
import { getBookingStripeWebhookConfig } from "@/features/booking-requests/infrastructure/config";
import { normalizeBookingPaymentEvent, BookingPaymentEnvironmentMismatch } from "@/features/booking-requests/infrastructure/webhook-event";
import { track } from "@/lib/analytics/track";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * LHS-PAY-008/009: a dedicated Stripe webhook endpoint for booking
 * payments, isolated from the existing SaaS commerce webhook boundary
 * (/api/webhooks/stripe/route.ts). All confirmation logic lives in the
 * confirm_booking_from_payment Postgres function (see the LHS-001 v2
 * migration) — this route only verifies the signature, normalizes the
 * event, and hands it to that transaction.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();

  let webhookSecret: string;
  try {
    webhookSecret = getBookingStripeWebhookConfig().secret;
  } catch {
    return NextResponse.json({ accepted: false, code: "webhook_not_configured" }, { status: 503 });
  }

  let event;
  try {
    event = await verifyStripeWebhook({
      rawBody,
      signatureHeader: request.headers.get("stripe-signature"),
      secret: webhookSecret,
    });
  } catch {
    return NextResponse.json({ accepted: false, code: "webhook_invalid_signature" }, { status: 401 });
  }

  let normalized;
  try {
    normalized = normalizeBookingPaymentEvent(event, resolveStripeCommerceEnvironment());
  } catch (error) {
    if (error instanceof BookingPaymentEnvironmentMismatch) {
      return NextResponse.json({ accepted: false, code: "environment_mismatch" }, { status: 200 });
    }
    return NextResponse.json({ accepted: false, code: "webhook_normalization_failed" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("confirm_booking_from_payment", { p_event: normalized });

  if (error) {
    console.error("booking_payment_webhook_rpc_failed", { code: error.code, providerEventId: normalized.providerEventId });
    return NextResponse.json({ accepted: false, code: "confirmation_rpc_failed" }, { status: 503 });
  }

  const result = data as { status?: string; bookingId?: string; outcome?: string } | null;

  if (result?.status === "processed" && result.outcome === "confirmed" && result.bookingId) {
    // Fires only after the verified, atomic confirmation transaction commits.
    track("booking_confirmed", { bookingId: result.bookingId });
  }

  return NextResponse.json({ accepted: true, result });
}
