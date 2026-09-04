import type { PlatformAccessClient } from "./client";
import type { ScopeType } from "./privileges";

export type EffectiveAccessRow = Readonly<{
  privilegeId: string;
  module: string;
  scopeType: ScopeType;
  scopeId: string | null;
  roleId: string;
  sourceAssignmentId: string;
}>;

/** Thin wrapper over the public.get_effective_access governed projection. Not called from anywhere yet. */
export async function getEffectiveAccess(client: PlatformAccessClient, subjectId: string, workspaceId: string): Promise<EffectiveAccessRow[]> {
  const { data, error } = await client.rpc("get_effective_access", { p_subject_id: subjectId, p_workspace_id: workspaceId });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{
    privilege_id: string;
    module: string;
    scope_type: ScopeType;
    scope_id: string | null;
    role_id: string;
    source_assignment_id: string;
  }>;
  return rows.map((row) => ({
    privilegeId: row.privilege_id,
    module: row.module,
    scopeType: row.scope_type,
    scopeId: row.scope_id,
    roleId: row.role_id,
    sourceAssignmentId: row.source_assignment_id,
  }));
}
