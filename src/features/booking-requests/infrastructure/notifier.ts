import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { recipientDigest } from "@/lib/auth/public-auth";
import { sendEmail } from "@/lib/email/send";
import { notificationAudience, renderBookingEmail, type BookingEmailContext, type BookingNotificationTemplate } from "../domain/notification-templates";

type AdminClient = ReturnType<typeof createAdminClient>;

export type BookingNotificationOutcome = "sent" | "failed" | "skipped" | "duplicate";

export type SendBookingNotificationInput = Readonly<{
  template: BookingNotificationTemplate;
  bookingRequestId: string;
  /** Identifies *this* occurrence (e.g. a block id or refund id) so retries collapse but repeats don't. */
  dedupeKey: string;
  extras?: Partial<Pick<BookingEmailContext, "holdExpiresAt" | "confirmationCode" | "amountMinor" | "currency" | "bookingCancelled">>;
}>;

function siteOrigin(): string {
  try {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://luxehavencollective.co").origin;
  } catch {
    return "https://luxehavencollective.co";
  }
}

function operatorEmail(): string | null {
  const value = (process.env.BOOKING_OPERATOR_EMAIL ?? process.env.CONTACT_TO_EMAIL ?? "").split(",")[0]?.trim();
  return value || null;
}

/** Local dev and preview deployments share the production database; they must never email real people. */
function emailsAllowedInThisRuntime(): boolean {
  return process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview";
}

async function finish(db: AdminClient, id: string, status: "sent" | "failed" | "skipped", detail: { providerMessageId?: string | null; failureCode?: string }) {
  await db
    .from("booking_notifications")
    .update({ status, provider_message_id: detail.providerMessageId ?? null, failure_code: detail.failureCode ?? null, updated_at: new Date().toISOString() })
    .eq("id", id);
}

/**
 * Best-effort, at-most-once transactional email. It NEVER throws: a mail
 * failure must not undo or block a booking transition, a webhook
 * acknowledgement, or a refund. Outcomes are recorded in booking_notifications
 * so an operator can see what was (not) sent.
 */
export async function sendBookingNotification(db: AdminClient, input: SendBookingNotificationInput): Promise<BookingNotificationOutcome> {
  let claimId: string | null = null;
  try {
    const { data: claim, error: claimError } = await db
      .from("booking_notifications")
      .insert({
        booking_request_id: input.bookingRequestId,
        template: input.template,
        audience: notificationAudience(input.template),
        dedupe_key: input.dedupeKey,
        status: "pending",
      })
      .select("id")
      .single();
    if (claimError) {
      if ((claimError as { code?: string }).code === "23505") return "duplicate";
      throw new Error(claimError.message);
    }
    claimId = claim.id;

    if (!emailsAllowedInThisRuntime()) {
      await finish(db, claimId!, "skipped", { failureCode: "non_production_runtime" });
      return "skipped";
    }
    if (!process.env.RESEND_API_KEY) {
      await finish(db, claimId!, "skipped", { failureCode: "email_not_configured" });
      return "skipped";
    }

    const { data: request } = await db
      .from("booking_requests")
      .select("request_token, arrival, departure, sla_due_at, property:properties!inner(name)")
      .eq("id", input.bookingRequestId)
      .maybeSingle();
    const { data: guest } = await db.from("booking_request_guests").select("full_name, email").eq("booking_request_id", input.bookingRequestId).maybeSingle();
    if (!request || !guest) {
      await finish(db, claimId!, "skipped", { failureCode: "request_not_found" });
      return "skipped";
    }

    const audience = notificationAudience(input.template);
    const recipient = audience === "guest" ? guest.email?.trim() : operatorEmail();
    if (!recipient) {
      await finish(db, claimId!, "skipped", { failureCode: "no_recipient" });
      return "skipped";
    }
    if (audience === "guest") {
      const { data: suppression } = await db
        .from("auth_email_suppressions")
        .select("id")
        .eq("recipient_digest", recipientDigest(recipient))
        .eq("active", true)
        .maybeSingle();
      if (suppression) {
        await finish(db, claimId!, "skipped", { failureCode: "recipient_suppressed" });
        return "skipped";
      }
    }

    const property = request.property as unknown as { name: string } | { name: string }[];
    const origin = siteOrigin();
    const email = renderBookingEmail(input.template, {
      propertyName: (Array.isArray(property) ? property[0]?.name : property?.name) ?? "your stay",
      arrival: request.arrival,
      departure: request.departure,
      guestName: guest.full_name,
      statusUrl: `${origin}/stays/booking/status?request=${request.request_token}`,
      adminUrl: `${origin}/admin/booking-requests/${input.bookingRequestId}`,
      slaDueAt: request.sla_due_at,
      ...input.extras,
    });

    const handoff = await sendEmail({
      to: recipient,
      subject: email.subject,
      html: email.html,
      ...(audience === "guest" && operatorEmail() ? { replyTo: operatorEmail()! } : {}),
    });
    await finish(db, claimId!, "sent", { providerMessageId: handoff?.id ?? null });
    return "sent";
  } catch (error) {
    console.error("booking_notification_failed", { template: input.template, bookingRequestId: input.bookingRequestId, message: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
    if (claimId) {
      try {
        await finish(db, claimId, "failed", { failureCode: "send_failed" });
      } catch {
        // Nothing more can be done; the console error above is the record.
      }
    }
    return "failed";
  }
}
