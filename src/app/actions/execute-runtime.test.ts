import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  role: "operator" as string,
  privilegeAllowed: false,
  inheritedPrivilegeAllowed: false,
  inheritedPrivilegeCheckThrows: false,
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
      if (
        args.p_privilege_id === "portfolio.decision.approve" &&
        state.inheritedPrivilegeCheckThrows
      ) {
        return { data: null, error: { message: "network error" } };
      }
      const allowed =
        args.p_privilege_id === "portfolio.decision.approve"
          ? state.inheritedPrivilegeAllowed
          : state.privilegeAllowed;
      return {
        data: [
          {
            allowed,
            reason_code: allowed ? "PA_ALLOW" : "PA_DENY_NO_GRANT",
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

type ExecuteAction = Parameters<
  Awaited<ReturnType<typeof runtime>>["controlAuthorization"]["canWork"]
>[0]["action"];
const notAssigneeAction = {
  id: { value: "action-1" },
  activeAssignment: null,
  owner: { id: "someone-else" },
  sources: [],
} as unknown as ExecuteAction;
function portfolioSourcedAction(): ExecuteAction {
  return {
    id: { value: "action-portfolio-1" },
    activeAssignment: null,
    owner: { id: "someone-else" },
    sources: [
      {
        type: "decision",
        sourceId: "decision-1",
        capability: "portfolio",
        sourceModule: "portfolio",
        requiredPrivilege: "portfolio.decision.approve",
        recordedAt: new Date(),
        recordedBy: { type: "user", id: "someone-else" },
      },
    ],
  } as unknown as ExecuteAction;
}

describe("PA-005 execute-runtime.ts additive privilege gating", () => {
  const originalEnforcementFlag =
    process.env.AUTH012_INHERITED_PRIVILEGE_ENFORCEMENT_ENABLED;
  beforeEach(() => {
    state.role = "operator";
    state.privilegeAllowed = false;
    state.inheritedPrivilegeAllowed = false;
    state.inheritedPrivilegeCheckThrows = false;
    state.platformRpcCalls.length = 0;
    delete process.env.AUTH012_INHERITED_PRIVILEGE_ENFORCEMENT_ENABLED;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    if (originalEnforcementFlag === undefined)
      delete process.env.AUTH012_INHERITED_PRIVILEGE_ENFORCEMENT_ENABLED;
    else
      process.env.AUTH012_INHERITED_PRIVILEGE_ENFORCEMENT_ENABLED =
        originalEnforcementFlag;
  });

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

  describe("AUTH-012 Phase 3: inherited-privilege check, flag-gated", () => {
    describe("flag off (default): log-only, never enforced", () => {
      it("still allows canWork when the role list grants access but the actor lacks the source's inherited privilege", async () => {
        state.role = "operator";
        state.inheritedPrivilegeAllowed = false;
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const { controlAuthorization } = await runtime();
        await expect(
          controlAuthorization.canWork({
            workspaceId: WORKSPACE_ID,
            actor: { type: "user", id: ACTOR_ID },
            action: portfolioSourcedAction(),
          }),
        ).resolves.toBe(true);
        expect(state.platformRpcCalls).toHaveLength(1);
        expect(state.platformRpcCalls[0]).toMatchObject({
          name: "evaluate_privilege",
          args: expect.objectContaining({
            p_privilege_id: "portfolio.decision.approve",
          }),
        });
        expect(warn).toHaveBeenCalledWith(
          "auth012_inherited_privilege_mismatch",
          expect.objectContaining({
            actionId: "action-portfolio-1",
            operation: "work",
            requiredPrivilege: "portfolio.decision.approve",
            enforced: false,
          }),
        );
      });
      it("checks the inherited privilege and logs nothing when it is satisfied", async () => {
        state.role = "operator";
        state.inheritedPrivilegeAllowed = true;
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const { controlAuthorization } = await runtime();
        await expect(
          controlAuthorization.canReview({
            workspaceId: WORKSPACE_ID,
            actor: { type: "user", id: ACTOR_ID },
            action: portfolioSourcedAction(),
          }),
        ).resolves.toBe(true);
        expect(state.platformRpcCalls).toHaveLength(1);
        expect(warn).not.toHaveBeenCalled();
      });
      it("still allows canManage even when the inherited-privilege check itself errors", async () => {
        state.role = "operator";
        state.inheritedPrivilegeCheckThrows = true;
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const { controlAuthorization } = await runtime();
        await expect(
          controlAuthorization.canManage({
            workspaceId: WORKSPACE_ID,
            actor: { type: "user", id: ACTOR_ID },
            action: portfolioSourcedAction(),
          }),
        ).resolves.toBe(true);
        expect(warn).toHaveBeenCalledWith(
          "auth012_inherited_privilege_check_failed",
          expect.objectContaining({ enforced: false }),
        );
      });
      it("never checks the inherited privilege when the actor is denied outright (nothing to log)", async () => {
        state.role = "viewer";
        const { controlAuthorization } = await runtime();
        await expect(
          controlAuthorization.canManage({
            workspaceId: WORKSPACE_ID,
            actor: { type: "user", id: ACTOR_ID },
            action: portfolioSourcedAction(),
          }),
        ).resolves.toBe(false);
        expect(state.platformRpcCalls).toHaveLength(1);
        expect(state.platformRpcCalls[0]).toMatchObject({
          args: expect.objectContaining({
            p_privilege_id: "actions.action.dismiss",
          }),
        });
      });
      it("adds no extra RPC call for an action with no inherited-privilege source", async () => {
        state.role = "operator";
        const { controlAuthorization } = await runtime();
        await controlAuthorization.canWork({
          workspaceId: WORKSPACE_ID,
          actor: { type: "user", id: ACTOR_ID },
          action: notAssigneeAction,
        });
        expect(state.platformRpcCalls).toHaveLength(0);
      });
    });

    describe("flag on: enforced", () => {
      beforeEach(() => {
        process.env.AUTH012_INHERITED_PRIVILEGE_ENFORCEMENT_ENABLED = "true";
      });

      it("denies canWork when the role list grants access but the actor lacks the source's inherited privilege", async () => {
        state.role = "operator";
        state.inheritedPrivilegeAllowed = false;
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const { controlAuthorization } = await runtime();
        await expect(
          controlAuthorization.canWork({
            workspaceId: WORKSPACE_ID,
            actor: { type: "user", id: ACTOR_ID },
            action: portfolioSourcedAction(),
          }),
        ).resolves.toBe(false);
        expect(warn).toHaveBeenCalledWith(
          "auth012_inherited_privilege_denied",
          expect.objectContaining({
            actionId: "action-portfolio-1",
            operation: "work",
            requiredPrivilege: "portfolio.decision.approve",
            enforced: true,
          }),
        );
      });
      it("still allows canReview when the inherited privilege is satisfied", async () => {
        state.role = "operator";
        state.inheritedPrivilegeAllowed = true;
        const { controlAuthorization } = await runtime();
        await expect(
          controlAuthorization.canReview({
            workspaceId: WORKSPACE_ID,
            actor: { type: "user", id: ACTOR_ID },
            action: portfolioSourcedAction(),
          }),
        ).resolves.toBe(true);
      });
      it("fails closed (denies) when the inherited-privilege check itself errors", async () => {
        state.role = "operator";
        state.inheritedPrivilegeCheckThrows = true;
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const { controlAuthorization } = await runtime();
        await expect(
          controlAuthorization.canManage({
            workspaceId: WORKSPACE_ID,
            actor: { type: "user", id: ACTOR_ID },
            action: portfolioSourcedAction(),
          }),
        ).resolves.toBe(false);
        expect(warn).toHaveBeenCalledWith(
          "auth012_inherited_privilege_check_failed",
          expect.objectContaining({ enforced: true }),
        );
      });
      it("does not affect an action with no inherited-privilege source", async () => {
        state.role = "operator";
        const { controlAuthorization } = await runtime();
        await expect(
          controlAuthorization.canWork({
            workspaceId: WORKSPACE_ID,
            actor: { type: "user", id: ACTOR_ID },
            action: notAssigneeAction,
          }),
        ).resolves.toBe(true);
      });
    });
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
