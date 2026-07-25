import {
  getPropertiesAndSystemsOverview,
  resolveWorkspaceAccessContext,
  SupabasePropertiesSystemsRepository,
  SupabaseTeamAccessRepository,
  WorkspaceConnectedSystemsPage,
} from "@/features/workspace";
import { requireUser } from "@/lib/auth/session";

export default async function ConnectedSystemsPage() {
  const { user } = await requireUser();
  const context = await resolveWorkspaceAccessContext(new SupabaseTeamAccessRepository(), user.id);
  const overview = await getPropertiesAndSystemsOverview(new SupabasePropertiesSystemsRepository(), context);
  return <WorkspaceConnectedSystemsPage overview={overview} canManage={context.permissions.has("connections.manage")} />;
}
