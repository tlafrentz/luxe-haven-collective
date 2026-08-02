import { ActionCenter, ProviderActionCenterReader } from "@/features/action-center";
import { createPlatformActionProvider, getActionCenterRequestContext } from "@/app/actions/action-center-runtime";

export default async function ActionCenterPage() {
  const context = await getActionCenterRequestContext();
  if (!context.ok) {
    return <main className="mx-auto max-w-3xl px-5 py-16"><p role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950">{context.code === "unauthenticated" ? "Sign in to view Action Center." : "You do not have access to an Action Center workspace."}</p></main>;
  }
  const view = await new ProviderActionCenterReader(createPlatformActionProvider(context.client)).loadQueue({
    workspaceId: context.workspaceId,
    viewer: context.viewer,
    activeOnly: true,
  });
  return <ActionCenter view={view} />;
}
