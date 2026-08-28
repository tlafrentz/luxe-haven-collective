import { ActionCenter, ProviderActionCenterReader, parseActionCenterView } from "@/features/action-center";
import { createPlatformActionProvider, getActionCenterRequestContext } from "@/app/actions/action-center-runtime";
import { listExecutePlansAction } from "@/app/actions/execute-plans";

export default async function ActionCenterPage({ searchParams }: { searchParams?: Promise<{ view?: string; workspace?:string }> }) {
  const routeQuery=await searchParams;
  const selectedView = parseActionCenterView(routeQuery?.view);
  const context = await getActionCenterRequestContext(routeQuery?.workspace);
  if (!context.ok) {
    return <main className="mx-auto max-w-3xl px-5 py-16"><p role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950">{context.code === "unauthenticated" ? "Sign in to view Action Center." : "You do not have access to an Action Center workspace."}</p></main>;
  }
  const reader = new ProviderActionCenterReader(createPlatformActionProvider(context.client));
  const query = selectedView === "my-work"
    ? { workspaceId: context.workspaceId, viewer: context.viewer, assignee: context.viewer.actor, activeOnly: true as const }
    : selectedView === "completed"
      ? { workspaceId: context.workspaceId, viewer: context.viewer, statuses: ["completed", "cancelled"] as const }
      : selectedView === "all"
        ? { workspaceId: context.workspaceId, viewer: context.viewer }
        : { workspaceId: context.workspaceId, viewer: context.viewer, activeOnly: true as const };
  const [view, planResult] = await Promise.all([reader.loadQueue(query), selectedView === "plans" ? listExecutePlansAction({workspaceId:String(context.workspaceId)}) : Promise.resolve(null)]);
  return <ActionCenter view={view} selectedView={selectedView} workspaceId={String(context.workspaceId)} plans={planResult?.ok ? planResult.value : []} />;
}
