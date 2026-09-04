export type RolePrivilegeRow = Readonly<{
  roleId: string;
  module: string;
  action: string;
  sensitivity: "standard" | "elevated" | "critical";
}>;

const SENSITIVITY_ORDER: Record<RolePrivilegeRow["sensitivity"], number> = { standard: 0, elevated: 1, critical: 2 };

/**
 * Groups a role's active privileges by module, with each module's action
 * list sorted standard -> elevated -> critical, so read-only actions lead
 * and approve/publish-tier actions trail without hand-curating copy.
 */
export function summarizeRolePrivileges(rows: readonly RolePrivilegeRow[]): ReadonlyMap<string, ReadonlyMap<string, readonly string[]>> {
  const byRole = new Map<string, Map<string, Map<string, RolePrivilegeRow["sensitivity"]>>>();
  for (const row of rows) {
    const byModule = byRole.get(row.roleId) ?? new Map<string, Map<string, RolePrivilegeRow["sensitivity"]>>();
    byRole.set(row.roleId, byModule);
    const actions = byModule.get(row.module) ?? new Map<string, RolePrivilegeRow["sensitivity"]>();
    byModule.set(row.module, actions);
    actions.set(row.action, row.sensitivity);
  }

  const result = new Map<string, ReadonlyMap<string, readonly string[]>>();
  for (const [roleId, byModule] of byRole) {
    const modules = new Map<string, readonly string[]>();
    for (const [module, actions] of byModule) {
      const sorted = [...actions.entries()]
        .sort(([, a], [, b]) => SENSITIVITY_ORDER[a] - SENSITIVITY_ORDER[b])
        .map(([action]) => action);
      modules.set(module, sorted);
    }
    result.set(roleId, modules);
  }
  return result;
}
