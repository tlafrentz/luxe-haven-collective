import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
const sendEmail = vi.fn();
vi.mock("@/lib/email/send", () => ({ sendEmail: (...args: unknown[]) => sendEmail(...args) }));

import { sendBookingNotification } from "./notifier";

type Result = { data: unknown; error: { code?: string; message: string } | null };
const updates: Record<string, unknown>[] = [];

function fakeDb(options: { claim?: Result; request?: unknown; guest?: unknown; suppressed?: boolean } = {}) {
  const claim = options.claim ?? { data: { id: "claim-1" }, error: null };
  function table(name: string) {
    const chain: Record<string, unknown> = {};
    for (const method of ["select", "eq"]) chain[method] = () => chain;
    chain.insert = () => chain;
    chain.update = (payload: Record<string, unknown>) => (updates.push(payload), chain);
    const result = (): Result => {
      if (name === "booking_notifications") return claim;
      if (name === "booking_requests") return { data: options.request === undefined ? { request_token: "tok", arrival: "2026-11-10", departure: "2026-11-13", sla_due_at: "2026-11-01T17:00:00Z", property: { name: "Mesa" } } : options.request, error: null };
      if (name === "booking_request_guests") return { data: options.guest === undefined ? { full_name: "Sam", email: "sam@example.com" } : options.guest, error: null };
      if (name === "auth_email_suppressions") return { data: options.suppressed ? { id: "s" } : null, error: null };
      return { data: null, error: null };
    };
    chain.single = async () => result();
    chain.maybeSingle = async () => result();
    chain.then = (resolve: (value: Result) => unknown) => resolve({ data: null, error: null });
    return chain;
  }
  return { from: table } as never;
}

const input = { template: "request_received", bookingRequestId: "req-1", dedupeKey: "v1" } as const;

describe("sendBookingNotification", () => {
  beforeEach(() => {
    updates.length = 0;
    sendEmail.mockReset().mockResolvedValue({ id: "msg-1" });
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("BOOKING_OPERATOR_EMAIL", "ops@example.com");
    vi.stubEnv("CONTACT_TO_EMAIL", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("sends the guest email and records the provider message id", async () => {
    expect(await sendBookingNotification(fakeDb(), input)).toBe("sent");
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0]).toMatchObject({ to: "sam@example.com", replyTo: "ops@example.com" });
    expect(updates.at(-1)).toMatchObject({ status: "sent", provider_message_id: "msg-1" });
  });

  it("sends operator templates to the operator address, not the guest", async () => {
    await sendBookingNotification(fakeDb(), { ...input, template: "operator_new_request" });
    expect(sendEmail.mock.calls[0][0]).toMatchObject({ to: "ops@example.com" });
    expect(sendEmail.mock.calls[0][0]).not.toHaveProperty("replyTo");
  });

  it("does nothing when the same notification was already claimed (retry / double fire)", async () => {
    const outcome = await sendBookingNotification(fakeDb({ claim: { data: null, error: { code: "23505", message: "duplicate" } } }), input);
    expect(outcome).toBe("duplicate");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("never emails from local dev or preview deployments that share the production database", async () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(await sendBookingNotification(fakeDb(), input)).toBe("skipped");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(await sendBookingNotification(fakeDb(), input)).toBe("skipped");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("skips when email is not configured, the recipient is suppressed, or there is no recipient", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    expect(await sendBookingNotification(fakeDb(), input)).toBe("skipped");
    vi.stubEnv("RESEND_API_KEY", "re_test");
    expect(await sendBookingNotification(fakeDb({ suppressed: true }), input)).toBe("skipped");
    expect(await sendBookingNotification(fakeDb({ guest: { full_name: "Sam", email: " " } }), input)).toBe("skipped");
    vi.stubEnv("BOOKING_OPERATOR_EMAIL", "");
    expect(await sendBookingNotification(fakeDb(), { ...input, template: "operator_new_request" })).toBe("skipped");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("swallows provider failures and marks the row failed so a mail outage cannot break a booking", async () => {
    sendEmail.mockRejectedValue(new Error("Email delivery failed: boom"));
    await expect(sendBookingNotification(fakeDb(), input)).resolves.toBe("failed");
    expect(updates.at(-1)).toMatchObject({ status: "failed", failure_code: "send_failed" });
  });

  it("does not throw even when the ledger itself is unavailable", async () => {
    const outcome = await sendBookingNotification(fakeDb({ claim: { data: null, error: { message: "db down" } } }), input);
    expect(outcome).toBe("failed");
  });
});
