import { Clock3, ShieldCheck, UserRoundPlus } from "lucide-react";

import { WorkspaceCard, WorkspaceContent, WorkspaceHeader, WorkspaceOverview, WorkspacePage } from "@/components/application-layout";
import {
  SupabaseTeamAccessRepository,
  TeamAccessManager,
  TeamSubNavigation,
  authorizeWorkspaceAction,
  getAccessSummary,
  resolveWorkspaceAccessContext,
} from "@/features/workspace";
import { canManageRoleAssignmentsAction, listRoleAssignmentsForMembersAction, type RoleAssignmentRow } from "@/app/actions/platform-access-assignments";
import { requireUser } from "@/lib/auth/session";

export default async function TeamAccessPage() {
  const { user } = await requireUser();
  const repository = new SupabaseTeamAccessRepository();
  const context = await resolveWorkspaceAccessContext(repository, user.id);
  let canManage = true;
  try { authorizeWorkspaceAction(context, "team.view"); } catch { canManage = false; }
  if (!canManage) {
    const own = (await repository.members(context)).find(({ profileId }) => profileId === user.id);
    return <WorkspacePage width="medium"><WorkspaceHeader eyebrow="Workspace" title="Team & Access" description="Your workspace membership and property access." /><WorkspaceContent><WorkspaceCard level={3} className="p-7"><ShieldCheck className="h-6 w-6 text-stone-700" /><h2 className="mt-3 font-semibold text-stone-950">Team access is managed by workspace owners and administrators</h2><p className="mt-2 text-sm text-stone-600">Your access: <span className="capitalize">{own?.role ?? context.role}</span> · {own?.propertyAccess.type ?? context.propertyAccess.type} properties. You cannot expand your own role or property scope.</p></WorkspaceCard></WorkspaceContent></WorkspacePage>;
  }
  const [members, invitations, properties, activity] = await Promise.all([
    repository.members(context), repository.invitations(context), repository.properties(context), repository.activity(context),
  ]);
  const [roleAssignments, canManageRoleAssignments] = await Promise.all([
    listRoleAssignmentsForMembersAction(context.workspaceId, members.map((member) => member.profileId)),
    canManageRoleAssignmentsAction(context.workspaceId),
  ]);
  const roleAssignmentsByMember = new Map<string, RoleAssignmentRow[]>();
  for (const assignment of roleAssignments) {
    roleAssignmentsByMember.set(assignment.subjectId, [...(roleAssignmentsByMember.get(assignment.subjectId) ?? []), assignment]);
  }
  const summary = getAccessSummary(members, invitations);
  return <WorkspacePage width="medium"><WorkspaceHeader eyebrow="Workspace · Authorization" title="Team & Access" description="Manage who works in this hospitality business, what responsibility they hold, and which properties they can access." /><TeamSubNavigation active="people" /><WorkspaceOverview className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Summary label="Active members" value={summary.activeMembers} /><Summary label="Pending invitations" value={summary.pendingInvitations} /><Summary label="Administrators" value={summary.administrators} /><Summary label="Restricted access" value={summary.restrictedMembers} /></WorkspaceOverview>{members.length===1 && !invitations.some(({status})=>status==="pending") ? <WorkspaceContent><WorkspaceCard level={3} className="border-teal-200 bg-teal-50 p-6"><UserRoundPlus className="h-6 w-6 text-teal-700" /><h2 className="mt-3 font-semibold text-teal-950">Build your team</h2><p className="mt-2 text-sm text-teal-900">Invite operators, collaborators, or viewers and control which properties they can access. A one-owner workspace is healthy.</p></WorkspaceCard></WorkspaceContent> : null}<WorkspaceContent><TeamAccessManager context={context} members={members} invitations={invitations} properties={properties} roleAssignmentsByMember={roleAssignmentsByMember} canManageRoleAssignments={canManageRoleAssignments} /></WorkspaceContent><WorkspaceContent aria-labelledby="access-activity-title"><h2 id="access-activity-title" className="text-xl font-semibold text-stone-950">Recent access activity</h2><WorkspaceCard level={2} className="mt-5 divide-y divide-stone-200 px-6">{activity.length ? activity.map((item)=><div key={item.id} className="flex gap-3 py-4"><Clock3 className="mt-0.5 h-4 w-4 text-stone-500" /><div><p className="text-sm font-semibold capitalize text-stone-900">{item.action.replaceAll("-"," ")} · {item.targetLabel}</p><p className="mt-1 text-xs text-stone-500">{item.actorName} · {new Intl.DateTimeFormat("en-US",{dateStyle:"medium",timeStyle:"short"}).format(new Date(item.occurredAt))}</p></div></div>) : <p className="py-6 text-sm text-stone-500">Access changes will appear here.</p>}</WorkspaceCard></WorkspaceContent></WorkspacePage>;
}
function Summary({label,value}:{label:string;value:number}) { return <WorkspaceCard level={2} className="p-5"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">{label}</p><p className="mt-2 text-2xl font-semibold text-stone-950">{value}</p></WorkspaceCard>; }
