import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
const { evaluatePrivilege, createRoleAssignment, revokeRoleAssignment } = vi.hoisted(() => ({
  evaluatePrivilege: vi.fn(),
  createRoleAssignment: vi.fn(),
  revokeRoleAssignment: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn().mockResolvedValue({ user: { id: "actor-1" } }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/platform-access", async () => {
  const actual = await vi.importActual<typeof import("@/features/platform-access")>("@/features/platform-access");
  return { ...actual, evaluatePrivilege, createRoleAssignment, revokeRoleAssignment };
});

import {
  addRoleAssignmentAction,
  canManageRoleAssignmentsAction,
  listRoleAssignmentsForMembersAction,
  revokeRoleAssignmentAction,
} from "./platform-access-assignments";

function tableClient(rows: unknown[]) {
  const builder: Record<string, (...args: unknown[]) => unknown> & PromiseLike<{ data: unknown; error: null }> = {
    then(resolve: (value: { data: unknown; error: null }) => unknown) {
      return Promise.resolve({ data: rows, error: null }).then(resolve);
    },
  } as never;
  for (const method of ["select", "eq", "in"]) builder[method] = () => builder;
  return { from: vi.fn(() => builder) };
}

describe("canManageRoleAssignmentsAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("evaluates workspace.roles.roles_manage for the current actor and returns its allowed flag", async () => {
    createClient.mockResolvedValue({});
    evaluatePrivilege.mockResolvedValue({ allowed: true, reasonCode: "PA_ALLOW", matchingAssignmentIds: [] });

    const result = await canManageRoleAssignmentsAction("workspace-1");

    expect(evaluatePrivilege).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ subjectId: "actor-1", workspaceId: "workspace-1", privilegeId: "workspace.roles.roles_manage" }),
    );
    expect(result).toBe(true);
  });

  it("returns false when denied", async () => {
    createClient.mockResolvedValue({});
    evaluatePrivilege.mockResolvedValue({ allowed: false, reasonCode: "PA_DENY_NO_GRANT", matchingAssignmentIds: [] });
    expect(await canManageRoleAssignmentsAction("workspace-1")).toBe(false);
  });
});

describe("listRoleAssignmentsForMembersAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps role_assignments rows into the RoleAssignmentRow shape", async () => {
    createClient.mockResolvedValue(
      tableClient([
        { id: "ra-1", subject_id: "member-1", role_id: "role-1", module: "guidebooks", scope_type: "property", scope_id: "prop-1", reason: "onboarding", version: 1, roles: { canonical_name: "manager", label: "Manager" } },
      ]),
    );

    const result = await listRoleAssignmentsForMembersAction("workspace-1", ["member-1"]);

    expect(result).toEqual([
      { id: "ra-1", subjectId: "member-1", roleId: "role-1", roleName: "manager", roleLabel: "Manager", module: "guidebooks", scopeType: "property", scopeId: "prop-1", reason: "onboarding", version: 1 },
    ]);
  });

  it("returns an empty array without querying when no subject ids are given", async () => {
    const client = tableClient([]);
    createClient.mockResolvedValue(client);
    expect(await listRoleAssignmentsForMembersAction("workspace-1", [])).toEqual([]);
    expect(client.from).not.toHaveBeenCalled();
  });
});

describe("addRoleAssignmentAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns ok on success", async () => {
    createClient.mockResolvedValue({});
    createRoleAssignment.mockResolvedValue({ status: "granted", assignmentId: "ra-1", version: 1 });

    const result = await addRoleAssignmentAction({
      subjectId: "member-1",
      role: "manager",
      workspaceId: "workspace-1",
      module: "guidebooks",
      scopeType: "workspace",
      reason: "onboarding",
    });

    expect(result.ok).toBe(true);
  });

  it("maps a thrown PA_* error to a friendly, coded failure result", async () => {
    createClient.mockResolvedValue({});
    createRoleAssignment.mockRejectedValue(new Error("PA_ASSIGNMENT_SELF_ESCALATION_DENIED"));

    const result = await addRoleAssignmentAction({
      subjectId: "actor-1",
      role: "manager",
      workspaceId: "workspace-1",
      module: "guidebooks",
      scopeType: "workspace",
      reason: "onboarding",
    });

    expect(result).toEqual({ ok: false, code: "PA_ASSIGNMENT_SELF_ESCALATION_DENIED", message: "You cannot grant yourself a new role." });
  });
});

describe("revokeRoleAssignmentAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns ok on success", async () => {
    createClient.mockResolvedValue({});
    revokeRoleAssignment.mockResolvedValue({ status: "revoked", assignmentId: "ra-1", version: 2 });
    const result = await revokeRoleAssignmentAction({ assignmentId: "ra-1", expectedVersion: 1, reason: "offboarding" });
    expect(result.ok).toBe(true);
  });

  it("maps PA_ASSIGNMENT_LAST_OWNER_PROTECTED to a friendly, coded failure result", async () => {
    createClient.mockResolvedValue({});
    revokeRoleAssignment.mockRejectedValue(new Error("PA_ASSIGNMENT_LAST_OWNER_PROTECTED"));
    const result = await revokeRoleAssignmentAction({ assignmentId: "ra-1", expectedVersion: 1, reason: "offboarding" });
    expect(result).toEqual({ ok: false, code: "PA_ASSIGNMENT_LAST_OWNER_PROTECTED", message: "This workspace must always have at least one active Owner." });
  });
});
