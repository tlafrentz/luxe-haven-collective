/**
 * Transactional email copy for the request-to-book flow. Pure (no I/O) so the
 * wording, escaping and money/date formatting are unit-testable. Copy is
 * deliberately policy-neutral: the business cancellation/refund policy is an
 * open PRD decision, so no email states one.
 */
export const GUEST_NOTIFICATION_TEMPLATES = [
  "request_received",
  "alternate_proposed",
  "payment_ready",
  "request_declined",
  "request_expired",
  "booking_confirmed",
  "refund_issued",
] as const;
export const OPERATOR_NOTIFICATION_TEMPLATES = ["operator_new_request", "operator_review_overdue"] as const;

export type GuestNotificationTemplate = (typeof GUEST_NOTIFICATION_TEMPLATES)[number];
export type OperatorNotificationTemplate = (typeof OPERATOR_NOTIFICATION_TEMPLATES)[number];
export type BookingNotificationTemplate = GuestNotificationTemplate | OperatorNotificationTemplate;

export function notificationAudience(template: BookingNotificationTemplate): "guest" | "operator" {
  return (OPERATOR_NOTIFICATION_TEMPLATES as readonly string[]).includes(template) ? "operator" : "guest";
}

/** The Mesa pilot property is in Arizona (no DST); properties have no timezone column yet. */
export const NOTIFICATION_TIME_ZONE = "America/Phoenix";

export type BookingEmailContext = Readonly<{
  propertyName: string;
  arrival: string;
  departure: string;
  guestName: string;
  statusUrl: string;
  adminUrl: string;
  slaDueAt?: string | null;
  holdExpiresAt?: string | null;
  confirmationCode?: string | null;
  amountMinor?: number | null;
  currency?: string | null;
  bookingCancelled?: boolean;
}>;

export type RenderedEmail = Readonly<{ subject: string; html: string }>;

const escape = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

export function formatMoney(minor: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);
}

export function formatStayDate(isoDate: string): string {
  // Date-only strings are calendar dates, not instants — format in UTC so they never shift a day.
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${isoDate}T00:00:00Z`));
}

export function formatInstant(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: NOTIFICATION_TIME_ZONE }).format(new Date(iso)) + " Arizona time";
}

function stay(ctx: BookingEmailContext): string {
  return `${escape(ctx.propertyName)}, ${escape(formatStayDate(ctx.arrival))} to ${escape(formatStayDate(ctx.departure))}`;
}

function shell(heading: string, body: string): string {
  return `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#171412;max-width:560px;"><h1 style="font-size:22px;">${escape(heading)}</h1>${body}<p style="margin-top:24px;">— Luxe Haven Stays</p></div>`;
}

function button(href: string, label: string): string {
  return `<p><a href="${escape(href)}" style="display:inline-block;background:#171412;color:#ffffff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:600;">${escape(label)}</a></p>`;
}

export function renderBookingEmail(template: BookingNotificationTemplate, ctx: BookingEmailContext): RenderedEmail {
  const greeting = `<p>Hi ${escape(ctx.guestName)},</p>`;

  switch (template) {
    case "request_received":
      return {
        subject: `We received your stay request — ${ctx.propertyName}`,
        html: shell(
          "We received your request",
          `${greeting}<p>Thanks for requesting ${stay(ctx)}. This is a request, not a confirmed reservation — your dates are not held and nothing has been charged.</p>` +
            `<p>We're checking the calendar now${ctx.slaDueAt ? ` and expect to reply by ${escape(formatInstant(ctx.slaDueAt))}` : ""}. You can check progress any time:</p>${button(ctx.statusUrl, "View request status")}`,
        ),
      };
    case "alternate_proposed":
      return {
        subject: `Alternate dates for your stay — ${ctx.propertyName}`,
        html: shell(
          "We have alternate dates for you",
          `${greeting}<p>Your original dates weren't available, but we can offer ${stay(ctx)}. Nothing is charged until you confirm and pay.</p>${button(ctx.statusUrl, "Review the new dates")}`,
        ),
      };
    case "payment_ready":
      return {
        subject: `Your dates are available — complete payment for ${ctx.propertyName}`,
        html: shell(
          "Your dates are available",
          `${greeting}<p>Good news — ${stay(ctx)} is available and we're holding it for you${ctx.holdExpiresAt ? ` until ${escape(formatInstant(ctx.holdExpiresAt))}` : " for a limited time"}.</p>` +
            `<p>Your stay is only confirmed once payment is complete.</p>${button(ctx.statusUrl, "Review terms and pay")}`,
        ),
      };
    case "request_declined":
      return {
        subject: `About your stay request — ${ctx.propertyName}`,
        html: shell(
          "We can't offer these dates",
          `${greeting}<p>Unfortunately we can't accommodate ${stay(ctx)}. Nothing was charged. You're welcome to request different dates or reply to this email and we'll help find an alternative.</p>`,
        ),
      };
    case "request_expired":
      return {
        subject: `Your stay request has expired — ${ctx.propertyName}`,
        html: shell(
          "Your request has expired",
          `${greeting}<p>The window to complete your request for ${stay(ctx)} has passed, so we've released the dates. Nothing was charged. Reply to this email or submit a new request any time.</p>`,
        ),
      };
    case "booking_confirmed":
      return {
        subject: `Your stay is confirmed — ${ctx.propertyName}`,
        html: shell(
          "Your stay is confirmed",
          `${greeting}<p>Payment received — you're booked for ${stay(ctx)}.</p>` +
            `<p>${ctx.confirmationCode ? `<strong>Confirmation:</strong> ${escape(ctx.confirmationCode)}<br>` : ""}${
              ctx.amountMinor != null && ctx.currency ? `<strong>Paid:</strong> ${escape(formatMoney(ctx.amountMinor, ctx.currency))}` : ""
            }</p><p>Check-in and arrival details will follow separately. You can view your booking any time:</p>${button(ctx.statusUrl, "View your booking")}`,
        ),
      };
    case "refund_issued":
      return {
        subject: `Refund issued — ${ctx.propertyName}`,
        html: shell(
          ctx.bookingCancelled ? "Your booking was cancelled and refunded" : "A refund was issued",
          `${greeting}<p>${
            ctx.amountMinor != null && ctx.currency ? `We've refunded ${escape(formatMoney(ctx.amountMinor, ctx.currency))}` : "We've issued a refund"
          } for your stay at ${stay(ctx)} to your original payment method. It can take 5–10 business days to appear, depending on your bank.</p>` +
            `${ctx.bookingCancelled ? "<p>This booking has been cancelled.</p>" : ""}<p>Reply to this email if you have any questions.</p>`,
        ),
      };
    case "operator_new_request":
      return {
        subject: `New stay request — ${ctx.propertyName}, ${formatStayDate(ctx.arrival)}`,
        html: shell(
          "New stay request to review",
          `<p>${escape(ctx.guestName)} requested ${stay(ctx)}.${ctx.slaDueAt ? ` Review due by ${escape(formatInstant(ctx.slaDueAt))}.` : ""}</p>` +
            `<p>Check the shared calendar for conflicts, then approve for block, propose alternate dates, or decline.</p>${button(ctx.adminUrl, "Open request")}`,
        ),
      };
    case "operator_review_overdue":
      return {
        subject: `Overdue: stay request awaiting review — ${ctx.propertyName}`,
        html: shell(
          "A stay request is past its review deadline",
          `<p>${escape(ctx.guestName)}'s request for ${stay(ctx)} has not been reviewed within the response window${ctx.slaDueAt ? ` (due ${escape(formatInstant(ctx.slaDueAt))})` : ""}. The guest is waiting.</p>${button(ctx.adminUrl, "Open request")}`,
        ),
      };
  }
}
