import type { ActionActorType, ActionAssignmentStatus, ActionHistoryOperation, ActionOutcomeLinkType, ActionPriority, ActionSourceType, ActionStatus } from "../../domain";

export type PlatformActionRow = Readonly<{
  workspace_id: string; id: string; title: string; description: string | null; action_type: string | null;
  status: ActionStatus; priority: ActionPriority; owner_type: ActionActorType; owner_id: string | null;
  schedule_created: string; schedule_scheduled: string | null; schedule_start_after: string | null; schedule_due: string | null; schedule_completed: string | null;
  created_at: string; created_by_type: ActionActorType; created_by_id: string | null; updated_at: string; version: number;
}>;
export type PlatformActionAssignmentRow = Readonly<{
  workspace_id: string; action_id: string; id: string; assignee_type: ActionActorType; assignee_id: string | null; queue: string | null; status: ActionAssignmentStatus;
  assigned_at: string; assigned_by_type: ActionActorType; assigned_by_id: string | null; claimed_at: string | null; released_at: string | null;
}>;
export type PlatformActionSourceRow = Readonly<{
  workspace_id: string; action_id: string; source_type: ActionSourceType; source_id: string | null; capability: string | null; external_system: string | null;
  recorded_at: string; recorded_by_type: ActionActorType; recorded_by_id: string | null;
}>;
export type PlatformActionHistoryRow = Readonly<{
  workspace_id: string; action_id: string; id: string; version: number; operation: ActionHistoryOperation; previous_status: ActionStatus | null; resulting_status: ActionStatus | null;
  occurred_at: string; actor_type: ActionActorType; actor_id: string | null; reason: string | null; command_id: string | null; external_event_id: string | null;
}>;
export type PlatformActionOutcomeReferenceRow = Readonly<{
  workspace_id: string; action_id: string; outcome_id: string; link_type: ActionOutcomeLinkType; linked_at: string; linked_by_type: ActionActorType; linked_by_id: string | null;
}>;
export type PlatformActionPersistenceRows = Readonly<{
  action: PlatformActionRow;
  assignments: readonly PlatformActionAssignmentRow[];
  sources: readonly PlatformActionSourceRow[];
  history: readonly PlatformActionHistoryRow[];
  outcomeReferences: readonly PlatformActionOutcomeReferenceRow[];
}>;
