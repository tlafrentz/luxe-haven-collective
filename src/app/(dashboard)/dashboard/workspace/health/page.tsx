import Link from "next/link";
import { AlertTriangle, CheckCircle2, Circle, LockKeyhole } from "lucide-react";
import { WorkspaceCard, WorkspaceContent, WorkspaceGrid, WorkspaceHeader, WorkspacePage } from "@/components/application-layout";
import {
  evaluateWorkspaceReadiness, getAccessSummary, getEffectiveWorkspaceSettings, getOrganizationProfile,
  getPropertiesAndSystemsOverview, resolveWorkspaceAccessContext, SupabaseNotificationsPreferencesRepository,
  SupabaseOrganizationRepository, SupabasePropertiesSystemsRepository, SupabaseTeamAccessRepository,
  type WorkspacePrincipal,
} from "@/features/workspace";
import { requireUser } from "@/lib/auth/session";

export default async function WorkspaceHealthPage() {
  const { user, profile } = await requireUser();
  const team = new SupabaseTeamAccessRepository();
  const context = await resolveWorkspaceAccessContext(team, user.id);
  const principal: WorkspacePrincipal = { profileId:user.id,role:context.role,displayName:profile?.full_name ?? null };
  const identity = { profileId:user.id,ownerId:context.ownerId,workspaceId:context.workspaceId };
  const [organization, members, invitations, propertySystems, settings] = await Promise.all([
    getOrganizationProfile(new SupabaseOrganizationRepository(),principal,identity),
    team.members(context),team.invitations(context),
    getPropertiesAndSystemsOverview(new SupabasePropertiesSystemsRepository(),context),
    getEffectiveWorkspaceSettings(new SupabaseNotificationsPreferencesRepository(),context),
  ]);
  const access = getAccessSummary(members,invitations);
  const system = propertySystems.systems[0];
  const health = evaluateWorkspaceReadiness({
    workspaceId:context.workspaceId,role:context.role,identityValid:Boolean(context.ownerId&&context.membershipId),
    activeOwnerCount:members.filter((m)=>m.role==="owner"&&m.status==="active").length,
    organizationRequiredComplete:organization.completeness.missingRequired.length===0,
    organizationConfirmed:["displayName","timezone","currency","language","country"].every((field)=>organization.confirmedFields.includes(field)),
    includedProperties:propertySystems.health.propertiesConfigured,invalidPropertyOwnership:false,
    propertySetupIssues:propertySystems.properties.filter((p)=>["setup-required","attention-needed"].includes(p.status)).length,
    connectionRequired:true,connectionStatus:system?.status ?? "never-connected",
    firstSyncComplete:Boolean(system?.lastSuccessfulSyncAt),
    operationalQuality:propertySystems.properties.some((p)=>["degraded","unusable"].includes(p.dataQuality.status))?"degraded":"trusted",
    operationalSync:system?.synchronization.status ?? "never-run",
    criticalNotificationsAvailable:settings.notifications.channels.inApp||settings.notifications.channels.email,
    notificationsConfirmed:settings.notifications.confirmed,preferencesValid:Boolean(settings.preferences.locale),
  });
  const statusClass = health.status==="ready"?"bg-emerald-50 text-emerald-800":health.status==="blocked"?"bg-red-50 text-red-800":"bg-amber-50 text-amber-800";
  const completion = health.onboarding.requiredTotal > 0 ? (health.onboarding.requiredCompleted / health.onboarding.requiredTotal) * 100 : 100;
  return <WorkspacePage width="wide"><WorkspaceHeader eyebrow="Operating readiness" title="Workspace Health" description="Configuration readiness and operational availability, composed from the canonical Workspace capabilities." context={<span className={`rounded-full px-3 py-2 text-xs font-semibold capitalize ${statusClass}`}>{health.status.replaceAll("-"," ")}</span>} />
    <WorkspaceContent><WorkspaceCard level={1} className="!bg-stone-950 p-7 !text-white"><div className="grid gap-6 md:grid-cols-[1fr_18rem] md:items-center"><div><h2 className="text-2xl font-semibold">{health.status==="ready"?"Your workspace is ready.":health.status==="blocked"?"Workspace operation is blocked.":"Your workspace needs attention."}</h2><p className="mt-2 text-sm !text-stone-300">Setup and operational health are evaluated separately. Last evaluated {new Date(health.lastEvaluatedAt).toLocaleString()}.</p></div><div><p className="text-sm">{health.onboarding.requiredCompleted} of {health.onboarding.requiredTotal} required tasks complete</p><div role="progressbar" aria-valuemin={0} aria-valuemax={health.onboarding.requiredTotal} aria-valuenow={health.onboarding.requiredCompleted} className="mt-2 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-amber-200" style={{width:`${completion}%`}} /></div></div></div></WorkspaceCard></WorkspaceContent>
    {health.issues.length?<WorkspaceContent><h2 className="text-xl font-semibold">Needs attention</h2><div className="mt-4 space-y-3">{health.issues.map((issue)=><WorkspaceCard key={issue.code} level={2} className="p-5"><div className="flex gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700"/><div><p className="text-xs font-semibold uppercase tracking-wide">{issue.severity.replaceAll("-"," ")}</p><h3 className="mt-1 font-semibold">{issue.title}</h3><p className="mt-1 text-sm text-stone-600">{issue.description} {issue.impact}</p>{issue.action?<Link href={issue.action.href} className="mt-3 inline-block text-sm font-semibold text-amber-800">{issue.action.label} to resolve {issue.title.toLowerCase()}</Link>:<p className="mt-3 inline-flex items-center gap-1 text-sm text-stone-500"><LockKeyhole className="h-4 w-4"/>An administrator must resolve this item.</p>}</div></div></WorkspaceCard>)}</div></WorkspaceContent>:null}
    <WorkspaceContent><h2 className="text-xl font-semibold">Setup checklist</h2><ul className="mt-4 grid gap-3 md:grid-cols-2">{health.onboarding.tasks.map((task)=><li key={task.code} className="flex gap-3 rounded-xl border bg-white p-4">{task.complete?<CheckCircle2 className="h-5 w-5 text-emerald-700"/>:<Circle className="h-5 w-5 text-amber-700"/>}<div><span className="font-medium">{task.label}</span><span className="ml-2 text-xs font-semibold uppercase text-stone-500">{task.requirement}</span>{!task.complete&&task.href?<Link className="block text-sm font-semibold text-amber-800" href={task.href}>Continue setup</Link>:null}</div></li>)}</ul></WorkspaceContent>
    <WorkspaceContent><h2 className="text-xl font-semibold">Capability availability</h2><WorkspaceGrid className="mt-4">{health.capabilities.map((capability)=><WorkspaceCard key={capability.id} level={2} className="col-span-2 p-5 md:col-span-3"><p className="font-semibold">{capability.label}</p><p className="mt-1 text-xs font-semibold uppercase">{capability.availability.replaceAll("-"," ")}</p><p className="mt-2 text-sm text-stone-600">{capability.explanation}</p></WorkspaceCard>)}</WorkspaceGrid><p className="mt-4 text-xs text-stone-500">{access.activeMembers} active members · evaluation {health.evaluationVersion}</p></WorkspaceContent>
  </WorkspacePage>;
}
