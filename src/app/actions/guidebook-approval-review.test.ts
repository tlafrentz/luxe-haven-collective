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
  requireRole: async () => ({ user: { id: "profile-a" } }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              id: "guidebook-1",
              workspace_id: "owner-a",
              property_id: "property-1",
            },
            error: null,
          }),
          order: () => ({
            limit: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
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
vi.mock("@/features/guidebook-studio", () => ({
  SupabaseGuidebookDraftRepository: class {
    async load() {
      return null;
    }
  },
}));

import { getApprovalReviewAction } from "./guidebook-approval-review";

describe("PA-003 guidebook-approval-review.ts additive privilege gating", () => {
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
    const result = await getApprovalReviewAction("guidebook-1");
    expect(result).toMatchObject({ request: null, comments: [] });
    expect(state.rpcCalls).toHaveLength(0);
  });

  it("falls through to a PA-001 grant scoped to the guidebook's property when the legacy check denies", async () => {
    state.legacyAllowed = false;
    state.privilegeAllowed = true;
    const result = await getApprovalReviewAction("guidebook-1");
    expect(result).toMatchObject({ request: null, comments: [] });
    expect(state.rpcCalls).toHaveLength(1);
    expect(state.rpcCalls[0]).toMatchObject({
      name: "evaluate_privilege",
      args: expect.objectContaining({
        p_privilege_id: "guidebooks.guidebook.view",
        p_workspace_id: "owner-a",
        p_scope_type: "property",
        p_scope_id: "property-1",
      }),
    });
  });

  it("fails closed (via property-access denial) when both the legacy check and the PA-001 grant deny", async () => {
    state.legacyAllowed = false;
    state.privilegeAllowed = false;
    await expect(getApprovalReviewAction("guidebook-1")).rejects.toThrow(
      "permission_denied",
    );
  });
});
