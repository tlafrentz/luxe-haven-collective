import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  role: "operator" as string,
  privilegeAllowed: false,
  platformRpcCalls: [] as Array<{ name: string; args: Record<string, unknown> }>,
}));

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const ACTOR_ID = "actor-a";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: ACTOR_ID } }, error: null }),
    },
  }),
}));
vi.mock("@/features/workspace", () => ({
  resolveWorkspaceAccessContext: async () => ({
    profileId: ACTOR_ID,
    workspaceId: WORKSPACE_ID,
    role: state.role,
    propertyAccess: { type: "all" as const },
  }),
  SupabaseTeamAccessRepository: class {
    async members() {
      return [];
    }
  },
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: async (name: string, args: Record<string, unknown>) => {
      state.platformRpcCalls.push({ name, args });
      return {
        data: [
          {
            allowed: state.privilegeAllowed,
            reason_code: state.privilegeAllowed
              ? "PA_ALLOW"
              : "PA_DENY_NO_GRANT",
            matching_assignment_ids: [],
          },
        ],
        error: null,
      };
    },
  }),
}));

import { composeExecuteRuntime } from "./execute-runtime";

async function runtime() {
  const result = await composeExecuteRuntime(WORKSPACE_ID);
  if (!result.ok) throw new Error(`composeExecuteRuntime failed: ${result.code}`);
  return result.runtime;
}

const notAssigneeAction = {
  activeAssignment: null,
  owner: { id: "someone-else" },
} as unknown as Parameters<
  Awaited<ReturnType<typeof runtime>>["controlAuthorization"]["canWork"]
>[0]["action"];

describe("PA-005 execute-runtime.ts additive privilege gating", () => {
  beforeEach(() => {
    state.role = "operator";
    state.privilegeAllowed = false;
    state.platformRpcCalls.length = 0;
  });
  afterEach(() => vi.restoreAllMocks());

  it("keeps today's role-list access to canWork unchanged and never calls evaluate_privilege", async () => {
    state.role = "operator";
    const { controlAuthorization } = await runtime();
    await expect(
      controlAuthorization.canWork({
        workspaceId: WORKSPACE_ID,
        actor: { type: "user", id: ACTOR_ID },
        action: notAssigneeAction,
      }),
    ).resolves.toBe(true);
    expect(state.platformRpcCalls).toHaveLength(0);
  });

  it("lets a PA-001 execute grant succeed for canWork where the role list alone would have failed", async () => {
    state.role = "contributor";
    state.privilegeAllowed = true;
    const { controlAuthorization } = await runtime();
    await expect(
      controlAuthorization.canWork({
        workspaceId: WORKSPACE_ID,
        actor: { type: "user", id: ACTOR_ID },
        action: notAssigneeAction,
      }),
    ).resolves.toBe(true);
    expect(state.platformRpcCalls).toHaveLength(1);
    expect(state.platformRpcCalls[0]).toMatchObject({
      name: "evaluate_privilege",
      args: expect.objectContaining({
        p_privilege_id: "actions.action.execute",
        p_workspace_id: WORKSPACE_ID,
        p_subject_id: ACTOR_ID,
      }),
    });
  });

  it("fails closed (returns false, not a throw) for canWork when both the role list and the PA-001 grant deny", async () => {
    state.role = "contributor";
    state.privilegeAllowed = false;
    const { controlAuthorization } = await runtime();
    await expect(
      controlAuthorization.canWork({
        workspaceId: WORKSPACE_ID,
        actor: { type: "user", id: ACTOR_ID },
        action: notAssigneeAction,
      }),
    ).resolves.toBe(false);
    expect(state.platformRpcCalls).toHaveLength(1);
  });

  it("keeps today's canAssign access to an unowned assignment unchanged and never calls evaluate_privilege", async () => {
    state.role = "contributor";
    const { authorization } = await runtime();
    await expect(
      authorization.canAssign({
        workspaceId: WORKSPACE_ID,
        actor: { type: "user", id: ACTOR_ID },
        owner: undefined,
      }),
    ).resolves.toBe(true);
    expect(state.platformRpcCalls).toHaveLength(0);
  });

  it("lets a PA-001 assign grant succeed for canAssign where the membership check alone would have failed", async () => {
    state.role = "contributor";
    state.privilegeAllowed = true;
    const { authorization } = await runtime();
    await expect(
      authorization.canAssign({
        workspaceId: WORKSPACE_ID,
        actor: { type: "user", id: ACTOR_ID },
        owner: { type: "user", id: "not-a-member" },
      }),
    ).resolves.toBe(true);
    expect(state.platformRpcCalls).toHaveLength(1);
    expect(state.platformRpcCalls[0]).toMatchObject({
      name: "evaluate_privilege",
      args: expect.objectContaining({
        p_privilege_id: "actions.action.assign",
        p_workspace_id: WORKSPACE_ID,
      }),
    });
  });
});
