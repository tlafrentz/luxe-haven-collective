"use client";

import { useState, useTransition } from "react";

import {
  cancelTeamInvitationAction,
  inviteTeamMemberAction,
  resendTeamInvitationAction,
  updateTeamMemberAction,
  type TeamActionResult,
} from "@/app/actions/workspace-team-access";
import type { RoleAssignmentRow } from "@/app/actions/platform-access-assignments";
import {
  capabilitySummary,
  type WorkspaceAccessContext,
  type WorkspaceInvitation,
  type WorkspaceMembership,
  type WorkspaceRole,
} from "../domain/team-access";
import { RoleAssignmentManager } from "./platform-access/role-assignment-manager";

type PropertyOption = Readonly<{ id: string; name: string }>;

export function TeamAccessManager({
  context,
  members,
  invitations,
  properties,
  roleAssignmentsByMember,
  canManageRoleAssignments,
}: Readonly<{
  context: WorkspaceAccessContext;
  members: readonly WorkspaceMembership[];
  invitations: readonly WorkspaceInvitation[];
  properties: readonly PropertyOption[];
  roleAssignmentsByMember: ReadonlyMap<string, readonly RoleAssignmentRow[]>;
  canManageRoleAssignments: boolean;
}>) {
  const [feedback, setFeedback] = useState<TeamActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const mutate = (work: () => Promise<TeamActionResult>) =>
    startTransition(async () => setFeedback(await work()));
  return (
    <div className="space-y-10">
      <div aria-live="polite" role="status" className="min-h-6 text-sm">
        {feedback ? <span className={feedback.ok ? "text-emerald-700" : "text-red-700"}>{feedback.message}</span> : null}
      </div>
      <InviteMemberForm properties={properties} pending={pending} onResult={setFeedback} />
      <section aria-labelledby="members-title">
        <h2 id="members-title" className="text-xl font-semibold text-stone-950">Members</h2>
        <p className="mt-1 text-sm text-stone-600">Roles describe responsibility; property scope controls which hospitality assets are visible.</p>
        <div className="mt-5 space-y-4">
          {members.map((member) => (
            <MemberCard
              key={member.id}
              context={context}
              member={member}
              properties={properties}
              pending={pending}
              mutate={mutate}
              roleAssignments={roleAssignmentsByMember.get(member.profileId) ?? []}
              canManageRoleAssignments={canManageRoleAssignments}
            />
          ))}
        </div>
      </section>
      <section aria-labelledby="invitations-title">
        <h2 id="invitations-title" className="text-xl font-semibold text-stone-950">Pending invitations</h2>
        <div className="mt-5 space-y-3">
          {invitations.filter(({ status }) => status === "pending" || status === "expired").length ? invitations.filter(({ status }) => status === "pending" || status === "expired").map((invitation) => (
            <article key={invitation.id} className="rounded-2xl border border-stone-200 bg-white p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div><h3 className="font-semibold text-stone-950">{invitation.email}</h3><p className="mt-1 text-sm capitalize text-stone-600">Invitation {invitation.status} · {invitation.role} · {scopeLabel(invitation.propertyAccess)}</p><p className="mt-1 text-xs text-stone-500">{invitation.status==="expired"?"Expired":"Expires"} {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(invitation.expiresAt))}</p></div>
                <div className="flex gap-2">
                  <button disabled={pending} onClick={() => mutate(() => resendTeamInvitationAction({ workspaceId: context.workspaceId, invitationId: invitation.id, email: invitation.email, role: invitation.role, commandId: crypto.randomUUID() }))} className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold">Resend</button>
                  {invitation.status==="pending" ? <button disabled={pending} onClick={() => { if (window.confirm(`Cancel the invitation for ${invitation.email}?`)) mutate(() => cancelTeamInvitationAction({ workspaceId: context.workspaceId, invitationId: invitation.id, commandId: crypto.randomUUID() })); }} className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-700">Cancel</button> : null}
                </div>
              </div>
            </article>
          )) : <p className="rounded-2xl bg-stone-50 p-5 text-sm text-stone-500">No pending invitations.</p>}
        </div>
      </section>
      <section aria-labelledby="role-guidance-title">
        <h2 id="role-guidance-title" className="text-xl font-semibold text-stone-950">Role guidance</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(["owner","administrator","operator","contributor","viewer"] as const).map((role) => <article key={role} className="rounded-2xl border border-stone-200 bg-stone-50 p-5"><h3 className="font-semibold capitalize text-stone-950">{role}</h3><ul className="mt-3 space-y-1 text-sm text-stone-600">{capabilitySummary(role).map((item) => <li key={item}>• {item}</li>)}</ul></article>)}
        </div>
      </section>
    </div>
  );
}

function InviteMemberForm({ properties, pending, onResult }: Readonly<{ properties: readonly PropertyOption[]; pending: boolean; onResult: (value: TeamActionResult) => void }>) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Exclude<WorkspaceRole, "owner">>("operator");
  const [mode, setMode] = useState("selected");
  const [selected, setSelected] = useState<string[]>([]);
  const [, startTransition] = useTransition();
  return <section aria-labelledby="invite-title" className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-8"><h2 id="invite-title" className="text-xl font-semibold text-stone-950">Invite Team Member</h2><p className="mt-1 text-sm text-stone-600">Choose a least-privilege role and explicit property scope before sending access.</p><form className="mt-6 grid gap-5 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); startTransition(async () => { const result = await inviteTeamMemberAction({ email, role, propertyAccessMode: mode, propertyIds: selected, commandId: crypto.randomUUID() }); onResult(result); if (result.ok) { setEmail(""); setSelected([]); } }); }}>
    <label className="text-sm font-semibold text-stone-800">Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="organization-input mt-2" /></label>
    <label className="text-sm font-semibold text-stone-800">Role<select value={role} onChange={(event) => setRole(event.target.value as Exclude<WorkspaceRole,"owner">)} className="organization-input mt-2"><option value="administrator">Administrator</option><option value="operator">Operator</option><option value="contributor">Contributor</option><option value="viewer">Viewer</option></select></label>
    <fieldset className="sm:col-span-2"><legend className="text-sm font-semibold text-stone-800">Property access</legend><div className="mt-2 flex flex-wrap gap-3">{["all","selected","none"].map((value) => <label key={value} className="flex items-center gap-2 rounded-full border border-stone-200 px-4 py-2 text-sm capitalize"><input type="radio" name="invite-scope" checked={mode===value} onChange={() => setMode(value)} />{value === "selected" ? "Selected properties" : `${value} properties`}</label>)}</div></fieldset>
    {mode === "selected" ? <fieldset className="sm:col-span-2"><legend className="text-sm font-semibold text-stone-800">Choose at least one property</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{properties.map((property) => <label key={property.id} className="flex items-center gap-2 rounded-xl bg-stone-50 p-3 text-sm"><input type="checkbox" checked={selected.includes(property.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, property.id] : current.filter((id) => id!==property.id))} />{property.name}</label>)}</div></fieldset> : null}
    <div className="sm:col-span-2 flex justify-end"><button disabled={pending || (mode==="selected" && !selected.length)} className="min-h-11 rounded-full bg-stone-950 px-6 text-sm font-semibold text-white disabled:opacity-40">Send invitation</button></div>
  </form></section>;
}

function MemberCard({
  context,
  member,
  properties,
  pending,
  mutate,
  roleAssignments,
  canManageRoleAssignments,
}: Readonly<{
  context: WorkspaceAccessContext;
  member: WorkspaceMembership;
  properties: readonly PropertyOption[];
  pending: boolean;
  mutate: (work: () => Promise<TeamActionResult>) => void;
  roleAssignments: readonly RoleAssignmentRow[];
  canManageRoleAssignments: boolean;
}>) {
  const [role, setRole] = useState(member.role);
  const [mode, setMode] = useState(member.propertyAccess.type);
  const [selected, setSelected] = useState(member.propertyAccess.type === "selected" ? [...member.propertyAccess.propertyIds] : []);
  const self = member.profileId === context.profileId;
  const owner = member.role === "owner";
  return <article className="rounded-2xl border border-stone-200 bg-white p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-start"><div className="flex min-w-0 flex-1 gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-950 text-xs font-semibold text-white">{initials(member.member.displayName)}</span><div className="min-w-0"><h3 className="truncate font-semibold text-stone-950">{member.member.displayName}{self ? " (you)" : ""}</h3><p className="truncate text-sm text-stone-500">{member.member.email}</p><p className="mt-1 text-xs capitalize text-stone-500">{member.status} · {scopeLabel(member.propertyAccess)}</p></div></div><div className="grid gap-3 sm:grid-cols-2 lg:w-[32rem]">
    <label className="text-xs font-semibold text-stone-600">Role<select value={role} disabled={pending || self || owner} onChange={(event) => setRole(event.target.value as WorkspaceRole)} className="organization-input mt-1">{owner?<option value="owner">Owner</option>:null}<option value="administrator">Administrator</option><option value="operator">Operator</option><option value="contributor">Contributor</option><option value="viewer">Viewer</option></select></label>
    <label className="text-xs font-semibold text-stone-600">Property scope<select value={mode} disabled={pending || self || owner || role==="administrator"} onChange={(event) => setMode(event.target.value as typeof mode)} className="organization-input mt-1"><option value="all">All properties</option><option value="selected">Selected properties</option><option value="none">No properties</option></select></label>
    {mode==="selected" && !owner ? <fieldset className="sm:col-span-2"><legend className="text-xs font-semibold text-stone-600">Assigned properties</legend><div className="mt-1 flex flex-wrap gap-2">{properties.map((property) => <label key={property.id} className="flex items-center gap-1.5 rounded-full bg-stone-50 px-3 py-2 text-xs"><input type="checkbox" disabled={self} checked={selected.includes(property.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current,property.id] : current.filter((id)=>id!==property.id))} />{property.name}</label>)}</div></fieldset> : null}
    {!self ? <div className="sm:col-span-2 flex flex-wrap justify-end gap-2"><button disabled={pending || role===member.role} onClick={() => mutate(() => updateTeamMemberAction({ workspaceId:context.workspaceId,membershipId:member.id,action:"role",role,commandId:crypto.randomUUID() }))} className="rounded-full border border-stone-300 px-4 py-2 text-xs font-semibold disabled:opacity-40">Save role</button><button disabled={pending || (mode==="selected"&&!selected.length)} onClick={() => mutate(() => updateTeamMemberAction({ workspaceId:context.workspaceId,membershipId:member.id,action:"access",propertyAccessMode:mode,propertyIds:selected,commandId:crypto.randomUUID() }))} className="rounded-full border border-stone-300 px-4 py-2 text-xs font-semibold">Save access</button>{member.status==="suspended" ? <button onClick={() => mutate(() => updateTeamMemberAction({workspaceId:context.workspaceId,membershipId:member.id,action:"restore",commandId:crypto.randomUUID()}))} className="rounded-full bg-emerald-700 px-4 py-2 text-xs font-semibold text-white">Restore</button> : <button onClick={() => { if(window.confirm(`Suspend access for ${member.member.displayName}?`)) mutate(() => updateTeamMemberAction({workspaceId:context.workspaceId,membershipId:member.id,action:"suspend",commandId:crypto.randomUUID()})); }} className="rounded-full border border-amber-300 px-4 py-2 text-xs font-semibold text-amber-800">Suspend</button>}<button onClick={() => { if(window.confirm(`Remove ${member.member.displayName} from this workspace? This does not delete their account.`)) mutate(() => updateTeamMemberAction({workspaceId:context.workspaceId,membershipId:member.id,action:"remove",commandId:crypto.randomUUID()})); }} className="rounded-full border border-red-200 px-4 py-2 text-xs font-semibold text-red-700">Remove</button></div> : null}
  </div></div>
  <RoleAssignmentManager
    subjectId={member.profileId}
    workspaceId={context.workspaceId}
    canManage={canManageRoleAssignments && !self}
    properties={properties}
    assignments={roleAssignments}
    mutate={mutate}
    pending={pending}
  />
  </article>;
}

function scopeLabel(scope: WorkspaceMembership["propertyAccess"]) { return scope.type === "selected" ? `${scope.propertyIds.length} selected ${scope.propertyIds.length===1?"property":"properties"}` : `${scope.type} properties`; }
function initials(value: string) { return value.split(/\s+/).slice(0,2).map((part)=>part[0]?.toUpperCase()).join("") || "TM"; }
