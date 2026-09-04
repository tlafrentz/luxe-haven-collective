"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";

import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  PRIVILEGE_IDS,
  createRoleAssignment,
  evaluatePrivilege,
  revokeRoleAssignment,
  type PlatformAccessClient,
  type PrivilegeId,
  type RoleName,
  type ScopeType,
} from "@/features/platform-access";
import type { RolePrivilegeRow } from "@/features/workspace/domain/role-privilege-summary";
import { summarizeRolePrivileges } from "@/features/workspace/domain/role-privilege-summary";

export type AssignmentActionResult = Readonly<{ ok: boolean; message: string; code?: string }>;

export type RoleAssignmentRow = Readonly<{
  id: string;
  subjectId: string;
  roleId: string;
  roleName: string;
  roleLabel: string;
  module: string | null;
  scopeType: ScopeType;
  scopeId: string | null;
  reason: string;
  version: number;
}>;

const CODE_MESSAGES: Record<string, string> = {
  PA_ASSIGNMENT_SELF_ESCALATION_DENIED: "You cannot grant yourself a new role.",
  PA_ASSIGNMENT_SELF_REVOKE_DENIED: "You cannot revoke your own role assignment.",
  PA_ASSIGNMENT_OWNER_GRANT_RESTRICTED: "Only an existing Workspace Owner can grant or revoke the Owner role.",
  PA_ASSIGNMENT_PERMISSION_DENIED: "You don't have permission to manage role assignments in this workspace.",
  PA_ASSIGNMENT_LAST_OWNER_PROTECTED: "This workspace must always have at least one active Owner.",
  PA_ASSIGNMENT_STALE_VERSION: "This assignment changed since you loaded the page. Refresh and try again.",
  PA_ASSIGNMENT_UNKNOWN_ROLE: "Unknown role.",
  PA_ASSIGNMENT_NOT_FOUND: "That assignment no longer exists.",
  PA_ASSIGNMENT_NOT_ACTIVE: "That assignment is no longer active.",
  PA_ASSIGNMENT_COMMAND_INVALID: "Enter all required fields.",
  PA_ASSIGNMENT_IDEMPOTENCY_CONFLICT: "Please try again.",
  PA_ASSIGNMENT_UNAUTHENTICATED: "You must be signed in.",
};

function mapAssignmentError(error: unknown): AssignmentActionResult {
  const code = String((error as { message?: unknown } | null)?.message ?? "").match(/PA_[A-Z0-9_]+/)?.[0];
  return { ok: false, code, message: (code && CODE_MESSAGES[code]) || "The role assignment could not be saved." };
}

const refresh = () => revalidatePath("/dashboard/workspace/team");

/** Gate for rendering the Add/Revoke role-assignment controls at all. */
export async function canManageRoleAssignmentsAction(workspaceId: string): Promise<boolean> {
  const { user } = await requireUser();
  const client = (await createClient()) as unknown as PlatformAccessClient;
  const decision = await evaluatePrivilege(client, {
    subjectId: user.id,
    workspaceId,
    privilegeId: PRIVILEGE_IDS.workspaceRolesRolesManage,
  });
  return decision.allowed;
}

/**
 * Reads every active role_assignment for the given members. Relies on
 * PA-001's own RLS (subject reads their own rows; workspace owner/admin or
 * platform staff read every row for the workspace) rather than an app-level
 * check -- the caller reaching this action has already passed the legacy
 * team.view gate.
 */
export async function listRoleAssignmentsForMembersAction(workspaceId: string, subjectIds: readonly string[]): Promise<RoleAssignmentRow[]> {
  if (!subjectIds.length) return [];
  const client = await createClient();
  const { data, error } = await client
    .from("role_assignments")
    .select("id,subject_id,role_id,module,scope_type,scope_id,reason,version,roles(canonical_name,label)")
    .eq("workspace_id", workspaceId)
    .eq("state", "active")
    .in("subject_id", subjectIds as string[]);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const role = row.roles as unknown as { canonical_name: string; label: string } | null;
    return {
      id: row.id as string,
      subjectId: row.subject_id as string,
      roleId: row.role_id as string,
      roleName: role?.canonical_name ?? "",
      roleLabel: role?.label ?? "",
      module: row.module as string | null,
      scopeType: row.scope_type as ScopeType,
      scopeId: row.scope_id as string | null,
      reason: row.reason as string,
      version: row.version as number,
    };
  });
}

export type AssignmentPreview = Readonly<{
  today: ReadonlyArray<{ privilegeId: string; label: string; allowed: boolean }>;
  afterGrant: ReadonlyArray<{ module: string; actions: readonly string[] }>;
}>;

export type PreviewRoleAssignmentInput = Readonly<{
  subjectId: string;
  workspaceId: string;
  role: RoleName;
  modules: readonly string[];
  scopeType: ScopeType;
  scopeId?: string | null;
}>;

/**
 * Before-save preview: (a) whether the target person already has one
 * representative privilege from each selected module today, and (b) the
 * full set they'd additionally gain from this role's bundle in each
 * selected module. Does not simulate the hypothetical post-grant evaluator
 * result -- that would require re-implementing its precedence rules
 * client-side. "Today" is bounded to one evaluate_privilege call per
 * selected module (at most 8, the full module list) rather than per
 * sensitivity tier, since AUTH-006 allows granting several modules at once.
 *
 * Re-checks workspace.roles.roles_manage itself: evaluate_privilege has no
 * built-in "is the caller allowed to ask about this subject" gate (unlike
 * the mutation RPCs), and this is a plain RPC call with no RLS backing --
 * relying on the UI not rendering the form for unprivileged users would
 * leave this directly callable by anyone.
 */
export async function previewRoleAssignmentAccessAction(input: PreviewRoleAssignmentInput): Promise<AssignmentPreview> {
  const { user } = await requireUser();
  const client = await createClient();
  const platformClient = client as unknown as PlatformAccessClient;

  const permitted = await evaluatePrivilege(platformClient, {
    subjectId: user.id,
    workspaceId: input.workspaceId,
    privilegeId: PRIVILEGE_IDS.workspaceRolesRolesManage,
  });
  if (!permitted.allowed) throw new Error("PA_ASSIGNMENT_PERMISSION_DENIED");

  if (!input.modules.length) return { today: [], afterGrant: [] };

  const { data: roleRow } = await client.from("roles").select("id").eq("canonical_name", input.role).maybeSingle();
  if (!roleRow) return { today: [], afterGrant: [] };

  const { data: privilegeRows } = await client
    .from("role_privileges")
    .select("privilege_definitions(id,module,action,label,sensitivity)")
    .eq("role_id", roleRow.id)
    .is("superseded_at", null);

  const moduleSet = new Set(input.modules);
  const inModules = (privilegeRows ?? [])
    .map((row) => row.privilege_definitions as unknown as { id: string; module: string; action: string; label: string; sensitivity: RolePrivilegeRow["sensitivity"] } | null)
    .filter((row): row is NonNullable<typeof row> => Boolean(row) && moduleSet.has(row!.module));

  const summary = summarizeRolePrivileges(inModules.map((row) => ({ roleId: input.role, module: row.module, action: row.action, sensitivity: row.sensitivity })));
  const afterGrant = [...(summary.get(input.role)?.entries() ?? [])].map(([module, actions]) => ({ module, actions }));

  // One representative privilege per selected module (prefer the "view"-tier action, so the preview reads naturally), bounded to input.modules.length calls.
  const sample = input.modules
    .map((module) => {
      const rows = inModules.filter((row) => row.module === module);
      return rows.find((row) => row.sensitivity === "standard") ?? rows[0];
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  const today = await Promise.all(
    sample.map(async (privilege) => {
      const decision = await evaluatePrivilege(platformClient, {
        subjectId: input.subjectId,
        workspaceId: input.workspaceId,
        privilegeId: privilege.id as PrivilegeId,
        scopeType: input.scopeType,
        scopeId: input.scopeId ?? null,
      });
      return { privilegeId: privilege.id, label: privilege.label, allowed: decision.allowed };
    }),
  );

  return { today, afterGrant };
}

export type AddRoleAssignmentInput = Readonly<{
  subjectId: string;
  role: RoleName;
  workspaceId: string;
  module: string;
  scopeType: ScopeType;
  scopeId?: string | null;
  reason: string;
}>;

export async function addRoleAssignmentAction(input: AddRoleAssignmentInput): Promise<AssignmentActionResult> {
  try {
    const client = (await createClient()) as unknown as PlatformAccessClient;
    const result = await createRoleAssignment(client, {
      subjectId: input.subjectId,
      role: input.role,
      workspaceId: input.workspaceId,
      module: input.module,
      scopeType: input.scopeType,
      scopeId: input.scopeId ?? null,
      reason: input.reason,
      idempotencyKey: randomUUID(),
    });
    refresh();
    return { ok: true, message: result.status === "replayed" ? "Assignment already existed." : "Assignment saved." };
  } catch (error) {
    return mapAssignmentError(error);
  }
}

export type RevokeRoleAssignmentInput = Readonly<{ assignmentId: string; expectedVersion: number; reason: string }>;

export async function revokeRoleAssignmentAction(input: RevokeRoleAssignmentInput): Promise<AssignmentActionResult> {
  try {
    const client = (await createClient()) as unknown as PlatformAccessClient;
    await revokeRoleAssignment(client, {
      assignmentId: input.assignmentId,
      expectedVersion: input.expectedVersion,
      reason: input.reason,
      idempotencyKey: randomUUID(),
    });
    refresh();
    return { ok: true, message: "Assignment revoked." };
  } catch (error) {
    return mapAssignmentError(error);
  }
}
