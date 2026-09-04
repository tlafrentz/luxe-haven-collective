import type { PlatformAccessClient } from "./client";
import type { RoleName, ScopeType } from "./privileges";

export type CreateRoleAssignmentInput = Readonly<{
  subjectId: string;
  role: RoleName;
  workspaceId: string;
  module?: string | null;
  scopeType?: ScopeType;
  scopeId?: string | null;
  validFrom?: string;
  validUntil?: string | null;
  reason: string;
  idempotencyKey: string;
  correlationId?: string;
}>;

export type RevokeRoleAssignmentInput = Readonly<{
  assignmentId: string;
  expectedVersion: number;
  reason: string;
  idempotencyKey: string;
  correlationId?: string;
}>;

export type RoleAssignmentResult = Readonly<{
  status: "granted" | "modified" | "revoked" | "replayed";
  assignmentId: string;
  version: number;
}>;

function parseResult(data: unknown): RoleAssignmentResult {
  const row = data as { status: string; assignmentId: string; version: number };
  return { status: row.status as RoleAssignmentResult["status"], assignmentId: row.assignmentId, version: row.version };
}

/** Thin wrapper over the public.create_role_assignment governed RPC. Not called from anywhere yet. */
export async function createRoleAssignment(client: PlatformAccessClient, input: CreateRoleAssignmentInput): Promise<RoleAssignmentResult> {
  const { data, error } = await client.rpc("create_role_assignment", {
    p_input: {
      subject_id: input.subjectId,
      role: input.role,
      workspace_id: input.workspaceId,
      module: input.module ?? null,
      scope_type: input.scopeType ?? "workspace",
      scope_id: input.scopeId ?? null,
      valid_from: input.validFrom ?? null,
      valid_until: input.validUntil ?? null,
      reason: input.reason,
      idempotency_key: input.idempotencyKey,
      correlation_id: input.correlationId ?? null,
    },
  });
  if (error) throw new Error(error.message);
  return parseResult(data);
}

/** Thin wrapper over the public.revoke_role_assignment governed RPC. Not called from anywhere yet. */
export async function revokeRoleAssignment(client: PlatformAccessClient, input: RevokeRoleAssignmentInput): Promise<RoleAssignmentResult> {
  const { data, error } = await client.rpc("revoke_role_assignment", {
    p_input: {
      assignment_id: input.assignmentId,
      expected_version: input.expectedVersion,
      reason: input.reason,
      idempotency_key: input.idempotencyKey,
      correlation_id: input.correlationId ?? null,
    },
  });
  if (error) throw new Error(error.message);
  return parseResult(data);
}
