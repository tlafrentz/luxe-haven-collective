export { PRIVILEGE_IDS, ROLE_NAMES, SCOPE_TYPES, type PrivilegeId, type RoleName, type ScopeType } from "./privileges";
export { evaluatePrivilege, type EvaluatePrivilegeInput, type PrivilegeDecision } from "./evaluator";
export { getEffectiveAccess, type EffectiveAccessRow } from "./effective-access";
export {
  createRoleAssignment,
  revokeRoleAssignment,
  type CreateRoleAssignmentInput,
  type RevokeRoleAssignmentInput,
  type RoleAssignmentResult,
} from "./assignments";
export type { PlatformAccessClient } from "./client";
