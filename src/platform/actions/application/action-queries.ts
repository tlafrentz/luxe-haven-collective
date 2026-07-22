import type { ActionActor, ActionId, ActionSourceType, ActionStatus, WorkspaceId } from "../domain";
export type FindActionByIdQuery = Readonly<{ workspaceId: WorkspaceId; actionId: ActionId }>;
export type PlatformActionQuery = Readonly<{ workspaceId: WorkspaceId; statuses?: readonly ActionStatus[]; owner?: ActionActor; assignee?: ActionActor; sourceType?: ActionSourceType; sourceId?: string; dueBefore?: Date }>;
