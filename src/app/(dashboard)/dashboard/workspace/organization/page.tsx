import Link from "next/link";
import { Building2, CircleAlert, Clock3 } from "lucide-react";

import {
  WorkspaceCard,
  WorkspaceContent,
  WorkspaceHeader,
  WorkspaceOverview,
  WorkspacePage,
} from "@/components/application-layout";
import {
  OrganizationForm,
  SupabaseOrganizationRepository,
  SupabaseWorkspaceRepository,
  SupabaseTeamAccessRepository,
  canAdministerWorkspace,
  getOrganizationActivity,
  getOrganizationProfile,
  isIanaTimezone,
  resolveWorkspaceIdentity,
  type WorkspaceIdentity,
  type WorkspacePrincipal,
} from "@/features/workspace";
import { requireUser } from "@/lib/auth/session";

export default async function OrganizationPage() {
  const { user, profile } = await requireUser();
  const access = await new SupabaseTeamAccessRepository().resolve(user.id);
  const principal: WorkspacePrincipal = {
    profileId: user.id,
    role: access?.role ?? profile?.role ?? "guest",
    displayName: profile?.full_name ?? profile?.email ?? null,
  };
  if (!canAdministerWorkspace(principal.role)) {
    return <OrganizationPermissionState />;
  }
  const resolved = await resolveWorkspaceIdentity(
    new SupabaseWorkspaceRepository(),
    principal,
  );
  if (!resolved.ownerId || !resolved.workspaceId) {
    return (
      <WorkspacePage width="medium">
        <WorkspaceHeader eyebrow="Workspace" title="Set up your organization" description="Create your workspace owner identity before configuring business details and defaults." />
        <WorkspaceContent>
          <Link href="/dashboard/workspace" className="inline-flex min-h-11 items-center rounded-full bg-stone-950 px-5 text-sm font-semibold text-white">Set up workspace</Link>
        </WorkspaceContent>
      </WorkspacePage>
    );
  }
  const identity: WorkspaceIdentity = {
    profileId: resolved.profileId,
    ownerId: resolved.ownerId,
    workspaceId: resolved.workspaceId,
  };
  const repository = new SupabaseOrganizationRepository();
  const [organization, activity] = await Promise.all([
    getOrganizationProfile(repository, principal, identity),
    getOrganizationActivity(repository, principal, identity),
  ]);
  const timezoneDegraded = !isIanaTimezone(organization.timezone);
  const location = organization.address?.country ?? organization.country;
  return (
    <WorkspacePage width="medium">
      <WorkspaceHeader
        eyebrow="Workspace · Organization"
        title="Organization"
        description="Manage the business identity and workspace defaults used across reports, integrations, guest experiences, and intelligence."
      />
      {timezoneDegraded ? (
        <WorkspaceContent>
          <WorkspaceCard level={3} className="border-amber-200 bg-amber-50 p-6">
            <CircleAlert className="h-6 w-6 text-amber-700" aria-hidden="true" />
            <h2 className="mt-3 font-semibold text-amber-950">Some operational defaults may be unreliable</h2>
            <p className="mt-2 text-sm text-amber-900">The configured timezone is invalid or no longer supported. Choose a valid IANA timezone below; your other values will be preserved.</p>
          </WorkspaceCard>
        </WorkspaceContent>
      ) : null}
      <WorkspaceOverview>
        <WorkspaceCard level={1} className="overflow-hidden">
          <div className="grid gap-6 bg-stone-950 p-7 text-white md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">
                {organization.completeness.status === "complete" ? "Configured" : organization.completeness.status.replace("-", " ")}
              </p>
              <h2 className="mt-3 text-2xl font-semibold">{organization.displayName}</h2>
              <p className="mt-2 text-sm text-stone-300">
                {organization.completeness.missingRequired.length
                  ? `Confirm ${organization.completeness.missingRequired.join(", ")} to finish configuration.`
                  : "Required organization identity and regional defaults are confirmed."}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-3">
              <SummaryItem label="Location" value={location} />
              <SummaryItem label="Timezone" value={organization.timezone} />
              <SummaryItem label="Currency" value={organization.currency} />
              <SummaryItem label="Last updated" value={formatRelativeDate(organization.updatedAt)} />
            </div>
          </div>
        </WorkspaceCard>
      </WorkspaceOverview>
      <WorkspaceContent>
        <WorkspaceCard level={2} className="p-6 sm:p-8">
          {organization.completeness.status === "incomplete" ? (
            <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <h2 className="font-semibold text-amber-950">Set up your organization</h2>
              <p className="mt-1 text-sm text-amber-900">Add your business identity and confirm regional defaults so Luxe Haven can configure reports, integrations, and operational workflows correctly.</p>
            </div>
          ) : null}
          <OrganizationForm profile={organization} />
        </WorkspaceCard>
      </WorkspaceContent>
      <WorkspaceContent aria-labelledby="organization-activity-title">
        <h2 id="organization-activity-title" className="text-xl font-semibold text-stone-950">Recent activity</h2>
        <WorkspaceCard level={2} className="mt-5 divide-y divide-stone-200 px-6">
          {activity.length ? activity.map((item) => (
            <div key={item.id} className="flex gap-3 py-4">
              <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-stone-500" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-stone-900">Organization updated by {item.actorDisplayName}</p>
                <p className="mt-1 text-xs text-stone-500">{formatDateTime(item.updatedAt)} · {item.changedFields.length} {item.changedFields.length === 1 ? "field" : "fields"} changed</p>
              </div>
            </div>
          )) : <p className="py-6 text-sm text-stone-500">Organization updates will appear here after the first save.</p>}
        </WorkspaceCard>
      </WorkspaceContent>
    </WorkspacePage>
  );
}

function OrganizationPermissionState() {
  return (
    <WorkspacePage width="medium">
      <WorkspaceHeader eyebrow="Workspace" title="Organization" description="Business identity and regional defaults." />
      <WorkspaceContent>
        <WorkspaceCard level={3} className="border-amber-200 bg-amber-50 p-7">
          <Building2 className="h-6 w-6 text-amber-700" aria-hidden="true" />
          <h2 className="mt-3 font-semibold text-amber-950">Organization access is restricted</h2>
          <p className="mt-2 text-sm text-amber-900">An owner or authorized workspace administrator must view and update organization configuration.</p>
        </WorkspaceCard>
      </WorkspaceContent>
    </WorkspacePage>
  );
}

function SummaryItem({ label, value }: Readonly<{ label: string; value: string }>) {
  return <div><span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">{label}</span><span className="mt-1 block font-semibold text-white">{value}</span></div>;
}

function formatRelativeDate(value: string) {
  const date = new Date(value);
  const today = new Date();
  return date.toDateString() === today.toDateString()
    ? "Today"
    : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
