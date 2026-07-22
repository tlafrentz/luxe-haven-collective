import type { ActionActor, ActionPriority, ActionSourceType, ActionStatus, PlatformActionProvider, WorkspaceId } from "@/platform/actions";
import { createActionId } from "@/platform/actions";
import type { ActionCenterAction, ActionCenterQueue } from "../domain";
import { projectActionCenterAction, projectActionCenterQueue, type ActionCenterViewer } from "./action-center-projection";

export type LoadActionCenterQueueInput = Readonly<{ workspaceId: WorkspaceId; viewer: ActionCenterViewer; statuses?: readonly ActionStatus[]; owner?: ActionActor; assignee?: ActionActor; sourceType?: ActionSourceType; sourceId?: string; priority?: ActionPriority; dueBefore?: Date; activeOnly?: boolean }>;
export type LoadActionCenterActionInput = Readonly<{ workspaceId: WorkspaceId; actionId: string; viewer: ActionCenterViewer }>;
export interface ActionCenterReader { loadQueue(input: LoadActionCenterQueueInput): Promise<ActionCenterQueue>; loadAction(input: LoadActionCenterActionInput): Promise<ActionCenterAction | null>; }

export class ProviderActionCenterReader implements ActionCenterReader {
  public constructor(private readonly provider: PlatformActionProvider, private readonly now: () => Date = () => new Date()) {}
  public async loadQueue(input: LoadActionCenterQueueInput): Promise<ActionCenterQueue> {
    const statuses = input.activeOnly ? ["draft", "committed", "ready", "in-progress", "blocked"] as const : input.statuses;
    const collection = await this.provider.find({ workspaceId: input.workspaceId, ...(statuses ? { statuses } : {}), ...(input.owner ? { owner: input.owner } : {}), ...(input.assignee ? { assignee: input.assignee } : {}), ...(input.sourceType ? { sourceType: input.sourceType } : {}), ...(input.sourceId ? { sourceId: input.sourceId } : {}), ...(input.dueBefore ? { dueBefore: input.dueBefore } : {}) });
    const values = collection.all().filter((action) => !input.priority || action.priority === input.priority);
    return projectActionCenterQueue(values, input.viewer, this.now());
  }
  public async loadAction(input: LoadActionCenterActionInput): Promise<ActionCenterAction | null> { const action = await this.provider.findById({ workspaceId: input.workspaceId, actionId: createActionId(input.actionId) }); return action ? projectActionCenterAction(action, input.viewer, this.now()) : null; }
}
