import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { Webhook } from "standardwebhooks";
import { createAdminClient } from "@/lib/supabase/admin";
import { recipientDigest } from "@/lib/auth/public-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ResendEvent = {
  type: string;
  created_at: string;
  data?: { email_id?: string; to?: string[]; bounce?: { type?: string } };
};

function providerFor(email: string) {
  const domain = email.toLowerCase().split("@")[1] ?? "";
  return domain.includes("gmail") ? "gmail" : domain.includes("outlook") || domain.includes("hotmail") || domain.includes("live.com") ? "microsoft" : "other";
}

export async function POST(request: Request) {
  const raw = await request.text();
  const secret = process.env.RESEND_WEBHOOK_SIGNING_SECRET;
  const id = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const signature = request.headers.get("svix-signature");
  if (!secret || !id || !timestamp || !signature) return NextResponse.json({ accepted: false, code: "WEBHOOK_SIGNATURE_REQUIRED" }, { status: 400 });
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return NextResponse.json({ accepted: false, code: "WEBHOOK_TIMESTAMP_INVALID" }, { status: 400 });
  let event: ResendEvent;
  try {
    event = new Webhook(secret).verify(raw, { "webhook-id": id, "webhook-timestamp": timestamp, "webhook-signature": signature }) as ResendEvent;
  } catch {
    const hour = new Date(); hour.setMinutes(0,0,0);
    await createAdminClient().from("auth_email_operational_alerts").upsert({ alert_type: "invalid_webhook_signature", dedupe_key: `invalid_webhook_signature:${hour.toISOString()}`, severity: "warning", diagnostic_code: "WEBHOOK_SIGNATURE_INVALID", last_seen_at: new Date().toISOString() }, { onConflict: "dedupe_key" });
    return NextResponse.json({ accepted: false, code: "WEBHOOK_SIGNATURE_INVALID" }, { status: 400 });
  }
  const recipient = event.data?.to?.[0]?.trim().toLowerCase();
  const { data, error } = await createAdminClient().rpc("process_resend_auth_event", {
    p_event_id: id,
    p_event_type: event.type === "email.suppressed" ? "email.rejected" : event.type,
    p_message_id: event.data?.email_id ?? null,
    p_event_at: event.created_at,
    p_payload_digest: createHash("sha256").update(raw).digest("hex"),
    p_recipient_digest: recipient ? recipientDigest(recipient) : null,
    p_recipient_provider: recipient ? providerFor(recipient) : "other",
    p_bounce_type: event.data?.bounce?.type ?? null,
  });
  if (error) {
    const mismatch = error.message.includes("REPLAY_MISMATCH");
    return NextResponse.json({ accepted: false, code: mismatch ? "WEBHOOK_REPLAY_MISMATCH" : "WEBHOOK_PROCESSING_FAILED" }, { status: mismatch ? 409 : 503 });
  }
  return NextResponse.json({ accepted: true, result: data });
}
