import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CommercePaymentError,
  getStripeWebhookConfig,
  normalizeStripeWebhookEvent,
  verifyStripeWebhook,
} from "@/platform/commerce";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();
  let normalized;
  try {
    const config = getStripeWebhookConfig();
    const verified = await verifyStripeWebhook({
      rawBody,
      signatureHeader: request.headers.get("stripe-signature"),
      secret: config.secret,
    });
    normalized = normalizeStripeWebhookEvent(verified, config.environment);
  } catch (error) {
    const code = error instanceof CommercePaymentError ? error.code : "commerce_webhook_processing_failed";
    return NextResponse.json({ accepted: false, code }, { status: 400 });
  }

  const client = createAdminClient();
  const receiptId = `commerce-receipt-${normalized.providerEventId}`;
  const serialized = {
    ...normalized,
    providerCreatedAt: normalized.providerCreatedAt.toISOString(),
  };
  const { error: receiptError } = await client.from("commerce_webhook_receipts").upsert({
    id: receiptId,
    provider: normalized.provider,
    environment: normalized.environment,
    provider_event_id: normalized.providerEventId,
    provider_event_type: normalized.providerEventType,
    provider_created_at: normalized.providerCreatedAt.toISOString(),
    normalized_event_type: normalized.eventType,
    normalized_event: serialized,
    status: "verified",
    received_at: new Date().toISOString(),
    verified_at: new Date().toISOString(),
  }, { onConflict: "provider,environment,provider_event_id", ignoreDuplicates: true });
  if (receiptError) {
    return NextResponse.json({ accepted: false, code: "commerce_webhook_processing_failed" }, { status: 503 });
  }

  const billingEvent = (normalized.eventType.startsWith("subscription.") && normalized.eventType !== "subscription.checkout.completed")
    || normalized.eventType.startsWith("invoice.") || normalized.eventType.startsWith("billing.");
  const { data, error } = await client.rpc(
    billingEvent ? "process_commerce_billing_event" : "process_commerce_provider_event",
    { p_event: serialized },
  );
  if (error) {
    return NextResponse.json({ accepted: false, code: "commerce_webhook_processing_failed" }, { status: 503 });
  }
  const result = data as { status?: string; errorCode?: string };
  if (result.status === "processed") {
    // Bounded process-manager handoff. Payment/Billing truth has already committed.
    await client.rpc("process_pending_commerce_fulfillment", { p_limit: 20 });
  }
  // A verified event is safely accepted even when business reconciliation needs operator review.
  return NextResponse.json({
    accepted: true,
    status: result.status ?? "processed",
    ...(result.errorCode ? { code: result.errorCode } : {}),
  });
}
