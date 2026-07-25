import {
  getPropertiesAndSystemsOverview,
  resolveWorkspaceAccessContext,
  SupabasePropertiesSystemsRepository,
  SupabaseTeamAccessRepository,
  WorkspacePropertiesPage,
} from "@/features/workspace";
import { requireUser } from "@/lib/auth/session";

export default async function PropertiesPage() {
  const { user } = await requireUser();
  const context = await resolveWorkspaceAccessContext(new SupabaseTeamAccessRepository(), user.id);
  const overview = await getPropertiesAndSystemsOverview(new SupabasePropertiesSystemsRepository(), context);
  return <WorkspacePropertiesPage overview={overview} canManage={context.permissions.has("properties.manage")} />;
}
