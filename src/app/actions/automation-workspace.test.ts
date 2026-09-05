import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const PROPERTY_ID = "22222222-2222-4222-8222-222222222222";
const ACTOR_ID = "actor-a";
const EXISTING_AUTOMATION_ID = "automation-1";

const state = vi.hoisted(() => ({
  role: "operator" as string,
  privilegeAllowed: false,
  platformRpcCalls: [] as Array<{ name: string; args: Record<string, unknown> }>,
}));

function definitionRow() {
  return {
    id: EXISTING_AUTOMATION_ID,
    workspace_id: WORKSPACE_ID,
    status: "active",
    current_version: 1,
    aggregate_version: 1,
    created_by_profile_id: ACTOR_ID,
    created_at: "2026-01-01T00:00:00.000Z",
  };
}
function versionRow() {
  return {
    id: "version-1",
    automation_id: EXISTING_AUTOMATION_ID,
    workspace_id: WORKSPACE_ID,
    version: 1,
    name: "Test",
    description: "Test automation",
    status: "active",
    scope_type: "property",
    property_ids: [PROPERTY_ID],
    owner_profile_id: ACTOR_ID,
    trigger_specification: {},
    command_specification: {},
    approval_policy: {},
    execution_policy: {},
    retry_policy: {},
    notification_policy: {},
    effective_from: "2026-01-01T00:00:00.000Z",
    compatibility: "unverified",
    created_by_profile_id: ACTOR_ID,
    created_at: "2026-01-01T00:00:00.000Z",
    reason: "seed",
  };
}
// A minimal chainable Supabase stub. automation_definitions only resolves a
// row when queried by the fixed EXISTING_AUTOMATION_ID (as
// executeAutomationWorkspaceCommand does) -- createAutomationDraft looks up
// a freshly generated random id, which never matches, so its "does this
// automation already exist" duplicate check correctly sees nothing.
function chainableSupabase() {
  return {
    from: (table: string) => {
      let idFilter: string | undefined;
      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          if (column === "id") idFilter = String(value);
          return chain;
        },
        order: async () => ({ data: [], error: null }),
        maybeSingle: async () => {
          if (table === "automation_definitions") {
            return idFilter && idFilter !== EXISTING_AUTOMATION_ID
              ? { data: null, error: null }
              : { data: definitionRow(), error: null };
          }
          if (table === "automation_definition_versions")
            return { data: versionRow(), error: null };
          return { data: null, error: null };
        },
      };
      return chain;
    },
    rpc: async () => ({ data: null, error: null }),
  };
}

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock(
  "@/features/automation-workspace/application/automation-workspace-composition",
  () => ({
    automationExperienceFlags: () => ({
      workspace: true,
      readOnly: false,
      authoring: true,
    }),
  }),
);
vi.mock("@/lib/auth/session", () => ({
  requireUser: async () => ({ user: { id: ACTOR_ID } }),
}));
vi.mock("@/features/workspace", () => ({
  SupabaseTeamAccessRepository: class {
    async resolve() {
      return {
        profileId: ACTOR_ID,
        workspaceId: WORKSPACE_ID,
        role: state.role,
        status: "active",
        propertyAccess: { type: "selected" as const, propertyIds: [PROPERTY_ID] },
      };
    }
    async properties() {
      return [{ id: PROPERTY_ID }];
    }
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => chainableSupabase(),
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

import {
  createAutomationDraft,
  executeAutomationWorkspaceCommand,
} from "./automation-workspace";

function draftFormData() {
  const formData = new FormData();
  formData.set("name", "Test automation");
  formData.set("description", "A test automation");
  formData.set("propertyId", PROPERTY_ID);
  return formData;
}
function commandFormData(command: string) {
  const formData = new FormData();
  formData.set("command", command);
  formData.set("targetId", EXISTING_AUTOMATION_ID);
  formData.set("expectedVersion", "1");
  formData.set("idempotencyKey", "au001d:test");
  return formData;
}

describe("PA-006 automation-workspace.ts additive privilege gating", () => {
  beforeEach(() => {
    state.role = "operator";
    state.privilegeAllowed = false;
    state.platformRpcCalls.length = 0;
  });
  afterEach(() => vi.restoreAllMocks());

  it("createAutomationDraft: keeps today's role-list access unchanged and never calls evaluate_privilege", async () => {
    state.role = "operator";
    await createAutomationDraft(draftFormData());
    expect(state.platformRpcCalls).toHaveLength(0);
  });

  it("createAutomationDraft: lets a PA-001 create grant succeed where the role list alone would have failed", async () => {
    state.role = "contributor";
    state.privilegeAllowed = true;
    await createAutomationDraft(draftFormData());
    expect(state.platformRpcCalls).toHaveLength(1);
    expect(state.platformRpcCalls[0]).toMatchObject({
      name: "evaluate_privilege",
      args: expect.objectContaining({
        p_privilege_id: "automations.automation.create",
        p_workspace_id: WORKSPACE_ID,
        p_scope_type: "property",
        p_scope_id: PROPERTY_ID,
      }),
    });
  });

  it("createAutomationDraft: fails closed when both the role list and the PA-001 grant deny", async () => {
    state.role = "contributor";
    state.privilegeAllowed = false;
    await createAutomationDraft(draftFormData());
    expect(state.platformRpcCalls).toHaveLength(1);
  });

  it("executeAutomationWorkspaceCommand: keeps today's role-list access unchanged for activate", async () => {
    state.role = "operator";
    await executeAutomationWorkspaceCommand(commandFormData("activate"));
    expect(state.platformRpcCalls).toHaveLength(0);
  });

  it("executeAutomationWorkspaceCommand: lets a PA-001 enable grant succeed for activate where the role list alone would have failed", async () => {
    state.role = "contributor";
    state.privilegeAllowed = true;
    await executeAutomationWorkspaceCommand(commandFormData("activate"));
    expect(state.platformRpcCalls).toHaveLength(1);
    expect(state.platformRpcCalls[0]).toMatchObject({
      name: "evaluate_privilege",
      args: expect.objectContaining({
        p_privilege_id: "automations.automation.enable",
      }),
    });
  });

  it("executeAutomationWorkspaceCommand: uses the edit privilege for submit-review, not enable", async () => {
    state.role = "contributor";
    state.privilegeAllowed = true;
    await executeAutomationWorkspaceCommand(commandFormData("submit-review"));
    expect(state.platformRpcCalls).toHaveLength(1);
    expect(state.platformRpcCalls[0]).toMatchObject({
      name: "evaluate_privilege",
      args: expect.objectContaining({
        p_privilege_id: "automations.automation.edit",
      }),
    });
  });
});
