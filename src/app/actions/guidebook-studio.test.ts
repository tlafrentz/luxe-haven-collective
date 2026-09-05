import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  authenticated: true,
  legacyAllowed: false,
  propertyAllowed: true,
  privilegeAllowed: false,
  rpcCalls: [] as Array<{ name: string; args: Record<string, unknown> }>,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({
  getSessionProfile: async () => ({
    user: state.authenticated ? { id: "profile-a" } : null,
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () =>
            table === "guidebook_publish_jobs"
              ? {
                  data: {
                    id: "job-1",
                    workspace_id: "owner-a",
                    guidebook_id: "guidebook-1",
                  },
                  error: null,
                }
              : { data: { property_id: "property-1" }, error: null },
        }),
      }),
    }),
    rpc: async (name: string, args: Record<string, unknown>) => {
      state.rpcCalls.push({ name, args });
      return {
        data: [
          {
            allowed: state.privilegeAllowed,
            reason_code: state.privilegeAllowed ? "PA_ALLOW" : "PA_DENY_NO_GRANT",
            matching_assignment_ids: [],
          },
        ],
        error: null,
      };
    },
  }),
}));
vi.mock("@/features/workspace", () => ({
  evaluateWorkspacePermission: () => state.legacyAllowed,
  evaluatePropertyAccess: () => state.propertyAllowed,
  resolveWorkspaceAccessContext: async () => ({
    profileId: "profile-a",
    workspaceId: "owner-a",
    ownerId: "owner-a",
    propertyAccess: { type: "all" as const },
  }),
  SupabaseTeamAccessRepository: class {},
}));

import { getGuidebookPublishJobAction } from "./guidebook-studio";

describe("PA-003 guidebook-studio.ts additive privilege gating", () => {
  beforeEach(() => {
    state.authenticated = true;
    state.legacyAllowed = false;
    state.propertyAllowed = true;
    state.privilegeAllowed = false;
    state.rpcCalls.length = 0;
  });
  afterEach(() => vi.restoreAllMocks());

  it("allows access via the legacy check without ever calling evaluate_privilege", async () => {
    state.legacyAllowed = true;
    const result = await getGuidebookPublishJobAction("job-1");
    expect(result).toMatchObject({ ok: true });
    expect(state.rpcCalls).toHaveLength(0);
  });

  it("falls through to a PA-001 grant when the legacy check denies, and allows it", async () => {
    state.legacyAllowed = false;
    state.privilegeAllowed = true;
    const result = await getGuidebookPublishJobAction("job-1");
    expect(result).toMatchObject({ ok: true });
    expect(state.rpcCalls).toHaveLength(1);
    expect(state.rpcCalls[0]).toMatchObject({
      name: "evaluate_privilege",
      args: expect.objectContaining({
        p_privilege_id: "guidebooks.guidebook.view",
        p_workspace_id: "owner-a",
      }),
    });
  });

  it("fails closed when both the legacy check and the PA-001 grant deny", async () => {
    state.legacyAllowed = false;
    state.privilegeAllowed = false;
    await expect(getGuidebookPublishJobAction("job-1")).rejects.toThrow(
      "permission_denied",
    );
  });
});
