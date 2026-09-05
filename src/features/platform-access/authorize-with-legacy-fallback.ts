import { evaluatePrivilege } from "./evaluator";
import type { PlatformAccessClient } from "./client";
import type { PrivilegeId, ScopeType } from "./privileges";

export type AuthorizeWithLegacyFallbackInput = Readonly<{
  client: PlatformAccessClient;
  subjectId: string;
  workspaceId: string;
  privilegeId: PrivilegeId;
  scopeType?: ScopeType;
  scopeId?: string | null;
  /** Result of the module's existing (pre-PA-001) permission check. */
  legacyAllowed: boolean;
}>;

/**
 * Transitional authorization for migrating an existing module onto PA-001
 * privileges without regressing anyone's current access. PA-001's Owner/
 * Administrator backfill never touched Contributor/Operator/Viewer
 * memberships, so requiring a role_assignments row outright would lock out
 * every real Contributor/Operator the moment a module's checks switched
 * over. Instead: the legacy check keeps working exactly as it does today
 * (checked first, no RPC call needed when it already passes), and a PA-001
 * grant can only ever add access on top of it, never take it away. Every
 * PA-004+ module migration should use this same shape.
 */
export async function authorizeWithLegacyFallback(input: AuthorizeWithLegacyFallbackInput): Promise<boolean> {
  if (input.legacyAllowed) return true;
  const decision = await evaluatePrivilege(input.client, {
    subjectId: input.subjectId,
    workspaceId: input.workspaceId,
    privilegeId: input.privilegeId,
    scopeType: input.scopeType,
    scopeId: input.scopeId,
  });
  return decision.allowed;
}
