import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/platform/actions", () => ({ SupabasePlatformActionRepository: class { async add() {} } }));
vi.mock("@/features/booking-requests/infrastructure/notifier", () => ({ sendBookingNotification: vi.fn() }));
const run = vi.fn();
vi.mock("@/features/booking-requests/application/maintenance", () => ({ runBookingRequestMaintenance: (...args: unknown[]) => run(...args) }));

import { GET, POST } from "./route";

const req = (authorization?: string) =>
  new Request("https://luxehavencollective.co/api/internal/booking-requests/maintenance", { method: "POST", headers: authorization ? { authorization } : {} }) as never;

describe("booking request maintenance cron", () => {
  beforeEach(() => {
    run.mockReset().mockResolvedValue({ holdsExpired: 1, proposalsExpired: 0, overdueReminders: 2 });
    vi.stubEnv("CRON_SECRET", "cron-secret-value");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("rejects requests without the cron secret and does no work", async () => {
    expect((await POST(req())).status).toBe(401);
    expect((await POST(req("Bearer wrong-secret-value!"))).status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });

  it("refuses everything when no cron secret is configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await POST(req("Bearer "))).status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });

  it("runs the maintenance and reports counts for an authorized call (Vercel cron uses GET)", async () => {
    const response = await GET(req("Bearer cron-secret-value"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, result: { holdsExpired: 1, proposalsExpired: 0, overdueReminders: 2 } });
  });

  it("returns 500 without leaking details when the run fails", async () => {
    run.mockRejectedValue(new Error("db exploded with secrets"));
    const response = await POST(req("Bearer cron-secret-value"));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("secrets");
  });
});
