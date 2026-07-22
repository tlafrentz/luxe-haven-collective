import { notFound } from "next/navigation";
import { ExecutionWorkspacePage, ProviderActionCenterReader } from "@/features/action-center";
import { createPlatformActionProvider, getActionCenterRequestContext } from "@/app/actions/action-center-runtime";

export default async function ActionWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await getActionCenterRequestContext();
  if (!context.ok) notFound();
  const action = await new ProviderActionCenterReader(createPlatformActionProvider(context.client)).loadAction({ workspaceId: context.workspaceId, actionId: id, viewer: context.viewer });
  if (!action) notFound();
  return <ExecutionWorkspacePage action={action} />;
}
