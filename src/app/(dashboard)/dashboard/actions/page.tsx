import { ActionCenter, ProviderActionCenterReader, type ActionCenterQueue } from "@/features/action-center";
import { createPlatformActionProvider, getActionCenterRequestContext } from "@/app/actions/action-center-runtime";

const emptyQueue: ActionCenterQueue = { summary: { total: 0, ready: 0, inProgress: 0, blocked: 0, completed: 0 }, activeActions: [], completedActions: [], isEmpty: true };

export default async function ActionCenterPage() {
  const context = await getActionCenterRequestContext();
  const view = context.ok
    ? await new ProviderActionCenterReader(createPlatformActionProvider(context.client)).loadQueue({ workspaceId: context.workspaceId, viewer: context.viewer })
    : emptyQueue;
  return <ActionCenter view={view} />;
}
