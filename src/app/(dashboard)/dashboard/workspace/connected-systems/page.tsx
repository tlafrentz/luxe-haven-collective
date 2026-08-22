import {
  getPropertiesAndSystemsOverview,
  resolveWorkspaceAccessContext,
  SupabasePropertiesSystemsRepository,
  SupabaseTeamAccessRepository,
  WorkspaceConnectedSystemsPage,
} from "@/features/workspace";
import { requireUser } from "@/lib/auth/session";

export default async function ConnectedSystemsPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const { user } = await requireUser();
  const requestedReturn = (await searchParams).returnTo;
  const returnTo = requestedReturn?.startsWith("/dashboard/observe/") ? requestedReturn : undefined;
  const context = await resolveWorkspaceAccessContext(new SupabaseTeamAccessRepository(), user.id);
  const overview = await getPropertiesAndSystemsOverview(new SupabasePropertiesSystemsRepository(), context);
  return <WorkspaceConnectedSystemsPage overview={overview} canManage={context.permissions.has("connections.manage")} returnTo={returnTo} />;
}
