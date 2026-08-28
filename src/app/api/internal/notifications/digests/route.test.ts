import { beforeEach, describe, expect, it, vi } from "vitest";

const processDueNotificationDigests = vi.fn();
vi.mock("@/lib/notifications/digest-worker", () => ({ processDueNotificationDigests }));

describe("notification digest scheduler route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NOTIFICATION_DIGEST_SCHEDULER_SECRET = "scheduler-secret";
  });

  it("rejects an absent scheduler credential without running the worker", async () => {
    const { GET } = await import("./route");
    const response = await GET(new Request("https://example.test/api/internal/notifications/digests"));
    expect(response.status).toBe(401);
    expect(processDueNotificationDigests).not.toHaveBeenCalled();
  });

  it("runs one bounded pass for an authorized request", async () => {
    processDueNotificationDigests.mockResolvedValue({ processed: true, claimed: 1, sent: 1, skipped: 0 });
    const { GET } = await import("./route");
    const response = await GET(new Request("https://example.test/api/internal/notifications/digests", { headers: { authorization: "Bearer scheduler-secret" } }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, sent: 1 });
    expect(processDueNotificationDigests).toHaveBeenCalledOnce();
  });

  it("returns a sanitized retryable failure", async () => {
    processDueNotificationDigests.mockRejectedValue(new Error("provider secret detail"));
    const { GET } = await import("./route");
    const response = await GET(new Request("https://example.test/api/internal/notifications/digests", { headers: { authorization: "Bearer scheduler-secret" } }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, code: "DIGEST_PROCESSING_FAILED" });
  });
});
