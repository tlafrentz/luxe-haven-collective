import { WorkspaceCard, WorkspaceContent, WorkspaceHeader, WorkspacePage } from "@/components/application-layout";
import {
  SupabaseTeamAccessRepository,
  TeamSubNavigation,
  authorizeWorkspaceAction,
  resolveWorkspaceAccessContext,
  summarizeRolePrivileges,
  type RolePrivilegeRow,
} from "@/features/workspace";
import { RoleSummaryCard, type RoleOption } from "@/features/workspace/presentation/platform-access/role-option-card";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ShieldCheck } from "lucide-react";

const ROLE_DISPLAY_ORDER = ["workspace_owner", "administrator", "manager", "contributor", "viewer"] as const;
const MODULE_LABELS: Record<string, string> = {
  guidebooks: "Guidebook Studio",
  investments: "Investment Analysis",
  actions: "Action Center",
  financials: "Financial Intelligence",
  revenue: "Revenue",
  operations: "Operations",
  automations: "Automations",
  furnishing: "Furnishing Studio",
  workspace: "Workspace administration",
};

export default async function TeamRolesPage() {
  const { user } = await requireUser();
  const repository = new SupabaseTeamAccessRepository();
  const context = await resolveWorkspaceAccessContext(repository, user.id);
  let canView = true;
  try {
    authorizeWorkspaceAction(context, "team.view");
  } catch {
    canView = false;
  }
  if (!canView) {
    return (
      <WorkspacePage width="medium">
        <WorkspaceHeader eyebrow="Workspace" title="Team & Access" description="Understand the five fixed roles." />
        <TeamSubNavigation active="roles" />
        <WorkspaceContent>
          <WorkspaceCard level={3} className="p-7">
            <ShieldCheck className="h-6 w-6 text-stone-700" />
            <h2 className="mt-3 font-semibold text-stone-950">Role information is managed by workspace owners and administrators</h2>
          </WorkspaceCard>
        </WorkspaceContent>
      </WorkspacePage>
    );
  }

  const client = await createClient();
  const [{ data: roleRows }, { data: privilegeRows }, { data: assignmentRows }] = await Promise.all([
    client.from("roles").select("id,canonical_name,label,description"),
    client.from("role_privileges").select("role_id,privilege_definitions(module,action,sensitivity)").is("superseded_at", null),
    client.from("role_assignments").select("role_id").eq("workspace_id", context.workspaceId).eq("state", "active"),
  ]);

  const roles = (roleRows ?? []) as { id: string; canonical_name: string; label: string; description: string }[];
  const rolesByCanonicalName = new Map(roles.map((role) => [role.canonical_name, role]));

  const privilegeInput: RolePrivilegeRow[] = (privilegeRows ?? [])
    .map((row) => {
      const definition = row.privilege_definitions as unknown as { module: string; action: string; sensitivity: RolePrivilegeRow["sensitivity"] } | null;
      const role = roles.find((entry) => entry.id === row.role_id);
      return role && definition ? { roleId: role.canonical_name, module: definition.module, action: definition.action, sensitivity: definition.sensitivity } : null;
    })
    .filter((row): row is RolePrivilegeRow => row !== null);
  const summary = summarizeRolePrivileges(privilegeInput);

  const activeCounts = new Map<string, number>();
  for (const row of assignmentRows ?? []) {
    const role = roles.find((entry) => entry.id === row.role_id);
    if (role) activeCounts.set(role.canonical_name, (activeCounts.get(role.canonical_name) ?? 0) + 1);
  }

  return (
    <WorkspacePage width="medium">
      <WorkspaceHeader eyebrow="Workspace · Authorization" title="Team & Access" description="Understand the five fixed roles and how modules and scope specialize them." />
      <TeamSubNavigation active="roles" />
      <WorkspaceContent>
        <div className="grid gap-4 sm:grid-cols-2">
          {ROLE_DISPLAY_ORDER.map((canonicalName) => {
            const role = rolesByCanonicalName.get(canonicalName);
            if (!role) return null;
            const modules = summary.get(canonicalName);
            const bullets = modules
              ? [...modules.entries()].map(([module, actions]) => `${MODULE_LABELS[module] ?? module}: ${actions.join(", ")}`)
              : [];
            const option: RoleOption = {
              id: role.id,
              label: `${role.label} · ${activeCounts.get(canonicalName) ?? 0} ${activeCounts.get(canonicalName) === 1 ? "person" : "people"}`,
              description: role.description,
              bullets,
            };
            return <RoleSummaryCard key={role.id} option={option} />;
          })}
        </div>
      </WorkspaceContent>
    </WorkspacePage>
  );
}
