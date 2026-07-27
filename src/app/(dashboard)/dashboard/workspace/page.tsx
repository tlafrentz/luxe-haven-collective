import Link from "next/link";
import {
  Building2,
  Check,
  CircleAlert,
  Database,
  House,
  PlugZap,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

import { initializeWorkspaceAction } from "@/app/actions/workspace";
import {
  WorkspaceCard,
  WorkspaceContent,
  WorkspaceGrid,
  WorkspaceHeader,
  WorkspaceOverview,
  WorkspacePage,
} from "@/components/application-layout";
import {
  SupabaseWorkspaceRepository,
  SupabaseOrganizationRepository,
  SupabaseTeamAccessRepository,
  SupabaseNotificationsPreferencesRepository,
  getEffectiveWorkspaceSettings,
  canAdministerWorkspace,
  getOrganizationProfile,
  getAccessSummary,
  resolveWorkspaceAccessContext,
  getWorkspaceOverview,
  resolveWorkspaceIdentity,
  type WorkspaceIdentity,
  type WorkspacePrincipal,
} from "@/features/workspace";
import { requireUser } from "@/lib/auth/session";

export default async function WorkspaceOverviewPage() {
  const { user, profile } = await requireUser();
  const membershipAccess = await new SupabaseTeamAccessRepository().resolve(user.id);
  const principal: WorkspacePrincipal = {
    profileId: user.id,
    role: membershipAccess?.role ?? profile?.role ?? "guest",
    displayName: profile?.full_name ?? null,
  };

  if (!canAdministerWorkspace(principal.role)) {
    return (
      <WorkspacePage width="medium">
        <WorkspaceHeader
          eyebrow="Business configuration"
          title="Workspace"
          description="The business context for properties, connections, team access, and operating preferences."
        />
        <WorkspaceContent>
          <WorkspaceCard level={3} className="border-amber-200 bg-amber-50 p-7">
            <ShieldCheck className="h-7 w-7 text-amber-700" aria-hidden="true" />
            <h2 className="mt-4 text-lg font-semibold text-amber-950">Workspace administration is restricted</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-amber-900">
              You are signed in, but an owner or authorized administrator must manage organization, access, properties, and connected systems.
            </p>
            <Link href="/dashboard" className="mt-5 inline-flex rounded-full bg-amber-950 px-5 py-2.5 text-sm font-semibold text-white">
              Return home
            </Link>
          </WorkspaceCard>
        </WorkspaceContent>
      </WorkspacePage>
    );
  }

  const repository = new SupabaseWorkspaceRepository();
  const resolved = await resolveWorkspaceIdentity(repository, principal);
  if (!resolved.ownerId || !resolved.workspaceId) {
    return <FirstUseState displayName={principal.displayName} />;
  }
  const identity: WorkspaceIdentity = {
    profileId: resolved.profileId,
    ownerId: resolved.ownerId,
    workspaceId: resolved.workspaceId,
  };
  const organization = await getOrganizationProfile(
    new SupabaseOrganizationRepository(),
    principal,
    identity,
  );
  const teamRepository = new SupabaseTeamAccessRepository();
  const accessContext = await resolveWorkspaceAccessContext(
    teamRepository,
    principal.profileId,
    identity.workspaceId,
  );
  const [members, invitations] = await Promise.all([
    teamRepository.members(accessContext),
    teamRepository.invitations(accessContext),
  ]);
  const accessSummary = getAccessSummary(members, invitations);
  const personalSettings = await getEffectiveWorkspaceSettings(
    new SupabaseNotificationsPreferencesRepository(),
    accessContext,
  );
  const summary = await getWorkspaceOverview(
    repository,
    principal,
    identity,
    organization,
    {
      memberCount: accessSummary.activeMembers,
      ownerCount: members.filter(
        ({ role, status }) => role === "owner" && status === "active",
      ).length,
      pendingInvitationCount: accessSummary.pendingInvitations,
      restrictedMemberCount: accessSummary.restrictedMembers,
    },
    {
      notificationsConfirmed: personalSettings.notifications.confirmed,
      preferencesInitialized: personalSettings.preferences.revision > 0,
    },
  );
  return <Overview summary={summary} />;
}

function FirstUseState({ displayName }: Readonly<{ displayName: string | null }>) {
  return (
    <WorkspacePage width="medium">
      <WorkspaceHeader
        eyebrow="First use"
        title="Set up your workspace"
        description="Create your business identity, connect your hospitality platform, and import your first property."
      />
      <WorkspaceOverview>
        <WorkspaceCard level={1} className="overflow-hidden !bg-stone-950 p-7 !text-white sm:p-9">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] !text-amber-200">Ready to begin</p>
          <h2 className="mt-3 text-2xl font-semibold">
            {displayName ? `${displayName}, create your hospitality workspace.` : "Create your hospitality workspace."}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 !text-stone-300">
            This creates one owner record for your authenticated profile. Repeating the request is safe and will always return the same workspace.
          </p>
          <form action={initializeWorkspaceAction} className="mt-6">
            <button type="submit" className="inline-flex min-h-11 items-center rounded-full bg-white px-5 text-sm font-semibold text-stone-950">
              Set up workspace
            </button>
          </form>
        </WorkspaceCard>
      </WorkspaceOverview>
    </WorkspacePage>
  );
}

type OverviewProps = Readonly<{
  summary: Awaited<ReturnType<typeof getWorkspaceOverview>>;
}>;

function Overview({ summary }: OverviewProps) {
  const degraded = summary.health.state === "degraded";
  return (
    <WorkspacePage width="medium">
      <WorkspaceHeader
        eyebrow="Business configuration"
        title={summary.organization.name ?? "Your Workspace"}
        description="One reliable view of who owns this hospitality business, what belongs to it, and whether its operating foundation is healthy."
        context={<span className="rounded-full border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-600">Owner workspace</span>}
      />
      {degraded ? (
        <WorkspaceContent>
          <WorkspaceCard level={3} className="border-amber-200 bg-amber-50 p-6">
            <CircleAlert className="h-6 w-6 text-amber-700" aria-hidden="true" />
            <h2 className="mt-3 font-semibold text-amber-950">Your workspace is available, but operational data is degraded</h2>
            <p className="mt-2 text-sm text-amber-900">
              Review the connected hospitality system to restore reliable live updates.
            </p>
          </WorkspaceCard>
        </WorkspaceContent>
      ) : null}
      <WorkspaceOverview>
        <WorkspaceCard level={1} className="overflow-hidden !bg-stone-950 !text-white">
          <div className="grid gap-6 p-7 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] !text-amber-200">Workspace health</p>
              <h2 className="mt-3 text-2xl font-semibold">
                {summary.health.state === "healthy" ? "Your workspace is ready." : "Your foundation is taking shape."}
              </h2>
              <p className="mt-2 text-sm !text-stone-300">
                {summary.health.setupItems.length} setup {summary.health.setupItems.length === 1 ? "item" : "items"} remaining
              </p>
            </div>
            <div className="min-w-52">
              <div className="flex justify-between text-xs font-semibold">
                <span>Configuration</span>
                <span>{summary.health.setupCompleted} of {summary.health.setupTotal}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-amber-200"
                  style={{ width: `${Math.max(0, summary.health.setupCompleted / summary.health.setupTotal) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </WorkspaceCard>
      </WorkspaceOverview>
      <WorkspaceContent aria-labelledby="workspace-summary-title">
        <h2 id="workspace-summary-title" className="text-xl font-semibold text-stone-950">Workspace overview</h2>
        <WorkspaceGrid className="mt-5">
          <HealthCard icon={Building2} label="Organization" value={summary.organization.configured ? "Configured" : "Setup required"} good={summary.organization.configured} />
          <HealthCard icon={UsersRound} label="Team membership" value={`${summary.team.ownerCount} owner`} good />
          <HealthCard icon={House} label="Properties" value={`${summary.properties.total} ${summary.properties.total === 1 ? "property" : "properties"}`} good={summary.properties.total > 0} />
          <HealthCard icon={PlugZap} label="Connected systems" value={summary.connection.connected ? `${summary.connection.provider} connected` : "Connection required"} good={summary.connection.connected} />
          <HealthCard icon={Database} label="Synchronization" value={summary.health.synchronization.replaceAll("-", " ")} good={summary.health.synchronization === "succeeded"} />
          <HealthCard icon={ShieldCheck} label="Operational data" value={summary.health.operationalData.replaceAll("-", " ")} good={["trusted", "usable-with-gaps"].includes(summary.health.operationalData)} />
        </WorkspaceGrid>
      </WorkspaceContent>
      <WorkspaceContent aria-labelledby="setup-checklist-title">
        <WorkspaceCard level={2} className="p-6">
          <h2 id="setup-checklist-title" className="text-xl font-semibold text-stone-950">Setup checklist</h2>
          {summary.health.setupItems.length ? (
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {summary.health.setupItems.map((item) => (
                <li key={item} className="flex items-center gap-3 rounded-xl bg-stone-50 px-4 py-3 text-sm font-medium text-stone-700">
                  <CircleAlert className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 flex items-center gap-2 text-sm font-medium text-emerald-800">
              <Check className="h-4 w-4" aria-hidden="true" /> Core workspace setup is complete.
            </p>
          )}
        </WorkspaceCard>
      </WorkspaceContent>
    </WorkspacePage>
  );
}

function HealthCard({ icon: Icon, label, value, good }: Readonly<{ icon: typeof Building2; label: string; value: string; good: boolean }>) {
  return (
    <WorkspaceCard level={2} className="col-span-1 p-5 md:col-span-3 lg:col-span-4">
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${good ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">{label}</p>
      <p className="mt-1 font-semibold capitalize text-stone-950">{value}</p>
    </WorkspaceCard>
  );
}
