import { notFound } from "next/navigation";

import {
  WorkspaceCard,
  WorkspaceContent,
  WorkspaceHeader,
  WorkspacePage,
} from "@/components/application-layout";
import {
  canAdministerWorkspace,
  getWorkspaceNavigation,
} from "@/features/workspace";
import { requireUser } from "@/lib/auth/session";

const copy = {
  organization: ["Organization", "Define your business identity, branding, location, and operating defaults."],
  team: ["Team & Access", "Invite members and control workspace and property access."],
  properties: ["Properties", "Manage the hospitality assets included in this workspace."],
  "connected-systems": ["Connected Systems", "Manage the systems that power live properties, reservations, and intelligence."],
  notifications: ["Notifications", "Choose which alerts, summaries, and digests reach your team."],
  preferences: ["Preferences", "Set workspace display, reporting, measurement, and dashboard defaults."],
} as const;

export function generateStaticParams() {
  return getWorkspaceNavigation()
    .filter(({ id }) => id !== "overview")
    .map(({ id }) => ({ section: id }));
}

export default async function WorkspaceSectionPage({
  params,
}: Readonly<{ params: Promise<{ section: string }> }>) {
  const { profile } = await requireUser();
  const { section } = await params;
  if (!(section in copy)) notFound();
  const [title, description] = copy[section as keyof typeof copy];
  const allowed = canAdministerWorkspace(profile?.role ?? "guest");
  return (
    <WorkspacePage width="medium">
      <WorkspaceHeader eyebrow="Workspace" title={title} description={description} />
      <WorkspaceContent>
        <WorkspaceCard level={3} className={allowed ? "p-8" : "border-amber-200 bg-amber-50 p-8"}>
          <h2 className="text-lg font-semibold text-stone-950">
            {allowed ? `${title} foundation established` : "Permission restricted"}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
            {allowed
              ? "This section is part of the canonical Workspace shell. Its management workflows arrive in a later milestone; the Workspace Overview remains the source of current configuration health."
              : "Workspace administration requires an owner or authorized administrator role."}
          </p>
        </WorkspaceCard>
      </WorkspaceContent>
    </WorkspacePage>
  );
}
