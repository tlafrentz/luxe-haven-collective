import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireRole, rpc, single, revalidatePath } = vi.hoisted(() => ({
  requireRole: vi.fn(),
  rpc: vi.fn(),
  single: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/auth/session", () => ({ requireRole }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    rpc,
    from: () => ({ select: () => ({ eq: () => ({ single }) }) }),
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { setPublicAuthModeAction } from "./auth-email-operations";

const initialPublicAuthModeActionState = { status: "idle" } as const;

function form(overrides: Record<string, string> = {}) {
  const values = {
    targetMode: "invite_only",
    expectedVersion: "2",
    reason: "Controlled certification transition",
    correlationId: "11111111-1111-4111-8111-111111111111",
    idempotencyKey: "beta-email-mode:11111111-1111-4111-8111-111111111111",
    confirmation: "CONFIRM",
    ...overrides,
  };
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe("public Auth mode server action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    single.mockResolvedValue({ data: { mode: "broad_beta", version: 3 } });
  });

  it("translates a stale PostgreSQL rejection into a sanitized conflict with authoritative state", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "AUTH_PUBLIC_CONTROL_VERSION_CONFLICT: internal detail" } });
    const result = await setPublicAuthModeAction(initialPublicAuthModeActionState, form());
    expect(result).toEqual({
      status: "version_conflict",
      code: "VERSION_CONFLICT",
      message: "This setting changed while you were working. We refreshed the current state. Review it before trying again.",
      currentMode: "broad_beta",
      currentVersion: 3,
      preservedReason: "Controlled certification transition",
    });
    expect(rpc).toHaveBeenCalledOnce();
    expect(revalidatePath).toHaveBeenCalledWith("/admin/auth-email");
    expect(JSON.stringify(result)).not.toContain("internal detail");
  });

  it("keeps validation and provider rejection distinct without throwing or retrying", async () => {
    const invalid = await setPublicAuthModeAction(initialPublicAuthModeActionState, form({ reason: "short" }));
    expect(invalid).toMatchObject({ status: "validation_error", code: "VALIDATION_ERROR" });
    expect(rpc).not.toHaveBeenCalled();
    rpc.mockResolvedValue({ data: null, error: { message: "AUTH_PUBLIC_CONTROL_REPLAY_MISMATCH raw" } });
    const rejected = await setPublicAuthModeAction(initialPublicAuthModeActionState, form());
    expect(rejected).toMatchObject({ status: "rejected", code: "COMMAND_REJECTED", currentVersion: 3 });
    expect(rpc).toHaveBeenCalledOnce();
    expect(JSON.stringify(rejected)).not.toContain("raw");
  });
});
