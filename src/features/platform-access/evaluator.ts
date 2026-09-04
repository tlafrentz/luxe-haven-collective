import type { PlatformAccessClient } from "./client";
import type { PrivilegeId, ScopeType } from "./privileges";

export type PrivilegeDecision = Readonly<{
  allowed: boolean;
  reasonCode: string;
  matchingAssignmentIds: readonly string[];
}>;

export type EvaluatePrivilegeInput = Readonly<{
  subjectId: string | null;
  workspaceId: string;
  privilegeId: PrivilegeId;
  scopeType?: ScopeType;
  scopeId?: string | null;
}>;

/** Thin wrapper over the public.evaluate_privilege RPC. Not called from anywhere yet. */
export async function evaluatePrivilege(client: PlatformAccessClient, input: EvaluatePrivilegeInput): Promise<PrivilegeDecision> {
  const { data, error } = await client.rpc("evaluate_privilege", {
    p_subject_id: input.subjectId,
    p_workspace_id: input.workspaceId,
    p_privilege_id: input.privilegeId,
    p_scope_type: input.scopeType ?? "workspace",
    p_scope_id: input.scopeId ?? null,
  });
  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as
    | { allowed: boolean; reason_code: string; matching_assignment_ids: string[] }
    | undefined;
  if (!row) throw new Error("PA_EVALUATOR_EMPTY_RESPONSE");
  return { allowed: row.allowed, reasonCode: row.reason_code, matchingAssignmentIds: row.matching_assignment_ids ?? [] };
}
