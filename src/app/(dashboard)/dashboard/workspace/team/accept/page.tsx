import { WorkspaceCard, WorkspaceContent, WorkspaceHeader, WorkspacePage } from "@/components/application-layout";
import { AcceptWorkspaceInvitation } from "@/features/workspace";

export default async function AcceptInvitationPage({searchParams}:{searchParams:Promise<{workspace?:string;token?:string}>}) {
  const {workspace,token}=await searchParams;
  return <WorkspacePage width="narrow"><WorkspaceHeader eyebrow="Workspace invitation" title="Join this workspace" description="Review and explicitly accept your workspace membership."/><WorkspaceContent><WorkspaceCard level={3} className="p-6"><AcceptWorkspaceInvitation workspaceId={workspace} token={token}/></WorkspaceCard></WorkspaceContent></WorkspacePage>;
}
