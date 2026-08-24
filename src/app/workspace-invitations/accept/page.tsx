import { redirect } from "next/navigation";

import { WorkspaceCard, WorkspaceContent, WorkspaceHeader, WorkspacePage } from "@/components/application-layout";
import { AcceptWorkspaceInvitation } from "@/features/workspace";
import { getSessionProfile } from "@/lib/auth/session";

export default async function AcceptInvitationPage({ searchParams }: Readonly<{ searchParams: Promise<{ workspace?: string; token?: string }> }>) {
  const parameters = await searchParams;
  const { user } = await getSessionProfile();
  if (!user) {
    const query = new URLSearchParams();
    if (parameters.workspace) query.set("workspace", parameters.workspace);
    if (parameters.token) query.set("token", parameters.token);
    const next = `/workspace-invitations/accept?${query.toString()}`;
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  return <WorkspacePage width="narrow"><WorkspaceHeader eyebrow="Workspace invitation" title="Join this workspace" description="Review and explicitly accept your workspace membership."/><WorkspaceContent><WorkspaceCard level={3} className="p-6"><AcceptWorkspaceInvitation workspaceId={parameters.workspace} token={parameters.token}/></WorkspaceCard></WorkspaceContent></WorkspacePage>;
}
