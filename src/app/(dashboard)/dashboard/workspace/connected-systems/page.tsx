import {
  getPropertiesAndSystemsOverview,
  resolveWorkspaceAccessContext,
  SupabasePropertiesSystemsRepository,
  SupabaseTeamAccessRepository,
  WorkspaceConnectedSystemsPage,
} from "@/features/workspace";
import { requireUser } from "@/lib/auth/session";
import { listPlaidConnectionsAction } from "@/app/actions/plaid-financial-ingestion";

export default async function ConnectedSystemsPage({ searchParams }: { searchParams: Promise<{ returnTo?: string; workspace?: string }> }) {
  const { user } = await requireUser();
  const params = await searchParams;
  const requestedReturn = params.returnTo;
  const returnTo = requestedReturn?.startsWith("/dashboard/observe/") ? requestedReturn : undefined;
  const context = await resolveWorkspaceAccessContext(new SupabaseTeamAccessRepository(), user.id, params.workspace);
  const overview = await getPropertiesAndSystemsOverview(new SupabasePropertiesSystemsRepository(), context);
  const financialConnections = await listPlaidConnectionsAction(context.workspaceId);
  return <WorkspaceConnectedSystemsPage overview={overview} canManage={context.permissions.has("connections.manage")} returnTo={returnTo} financialConnections={financialConnections} />;
}
