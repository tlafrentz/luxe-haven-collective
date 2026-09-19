import { describe, expect, it } from "vitest";
import {
  GUEST_NOTIFICATION_TEMPLATES,
  OPERATOR_NOTIFICATION_TEMPLATES,
  formatMoney,
  formatStayDate,
  notificationAudience,
  renderBookingEmail,
  type BookingEmailContext,
} from "./notification-templates";

const ctx: BookingEmailContext = {
  propertyName: "Mesa <Retreat>",
  arrival: "2026-11-10",
  departure: "2026-11-13",
  guestName: 'Sam "the guest" & Co',
  statusUrl: "https://example.com/stays/booking/status?request=tok",
  adminUrl: "https://example.com/admin/booking-requests/req-1",
  slaDueAt: "2026-11-01T17:00:00.000Z",
  holdExpiresAt: "2026-11-02T17:00:00.000Z",
  confirmationCode: "LHS-MESA-ABC",
  amountMinor: 62_900,
  currency: "USD",
};

describe("renderBookingEmail", () => {
  it.each([...GUEST_NOTIFICATION_TEMPLATES, ...OPERATOR_NOTIFICATION_TEMPLATES])("renders %s with a subject and html body", (template) => {
    const email = renderBookingEmail(template, ctx);
    expect(email.subject.length).toBeGreaterThan(0);
    expect(email.html).toContain("<h1");
  });

  it("escapes guest- and property-supplied text so it cannot inject markup", () => {
    for (const template of [...GUEST_NOTIFICATION_TEMPLATES, ...OPERATOR_NOTIFICATION_TEMPLATES]) {
      const { html } = renderBookingEmail(template, ctx);
      expect(html).not.toContain("<Retreat>");
      expect(html).not.toContain('"the guest"');
    }
    expect(renderBookingEmail("request_received", ctx).html).toContain("Mesa &lt;Retreat&gt;");
  });

  it("links guests to the status page and operators to the admin page", () => {
    expect(renderBookingEmail("payment_ready", ctx).html).toContain(ctx.statusUrl);
    expect(renderBookingEmail("operator_new_request", ctx).html).toContain(ctx.adminUrl);
  });

  it("states the hold deadline in Arizona time and never claims payment is taken before confirmation", () => {
    const html = renderBookingEmail("payment_ready", ctx).html;
    expect(html).toContain("Arizona time");
    expect(html).toContain("only confirmed once payment is complete");
    expect(renderBookingEmail("request_received", ctx).html).toContain("nothing has been charged");
  });

  it("includes the confirmation code and amount paid on confirmation", () => {
    const html = renderBookingEmail("booking_confirmed", ctx).html;
    expect(html).toContain("LHS-MESA-ABC");
    expect(html).toContain("$629.00");
  });

  it("distinguishes a cancelled-and-refunded booking from a partial refund", () => {
    expect(renderBookingEmail("refund_issued", { ...ctx, bookingCancelled: true }).html).toContain("This booking has been cancelled");
    expect(renderBookingEmail("refund_issued", { ...ctx, bookingCancelled: false }).html).not.toContain("This booking has been cancelled");
  });

  it("does not state a cancellation or refund policy (still an open PRD decision)", () => {
    for (const template of GUEST_NOTIFICATION_TEMPLATES) {
      expect(renderBookingEmail(template, ctx).html.toLowerCase()).not.toMatch(/non-?refundable|refund policy|cancellation policy/);
    }
  });
});

describe("helpers", () => {
  it("routes templates to the right audience", () => {
    expect(notificationAudience("booking_confirmed")).toBe("guest");
    expect(notificationAudience("operator_new_request")).toBe("operator");
  });

  it("formats calendar dates without shifting a day and money in minor units", () => {
    expect(formatStayDate("2026-11-10")).toBe("Nov 10, 2026");
    expect(formatMoney(62_900, "USD")).toBe("$629.00");
  });
});
