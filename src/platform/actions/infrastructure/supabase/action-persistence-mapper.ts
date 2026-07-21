import { Identifier } from "../../../kernel";
import { ActionVersion, PlatformAction, createActionAssignmentId, createActionHistoryId, createActionId, createWorkspaceId, type ActionActor } from "../../domain";
import type { PlatformActionAssignmentRow, PlatformActionHistoryRow, PlatformActionOutcomeReferenceRow, PlatformActionPersistenceRows, PlatformActionRow, PlatformActionSourceRow } from "./action-persistence-rows";

export function mapPlatformActionToPersistenceRows(action: PlatformAction): PlatformActionPersistenceRows {
  const workspaceId = action.workspaceId.value, actionId = action.id.value;
  const row: PlatformActionRow = {
    workspace_id: workspaceId, id: actionId, title: action.title, description: action.description ?? null, action_type: action.actionType ?? null,
    status: action.status, priority: action.priority, owner_type: action.owner.type, owner_id: action.owner.id ?? null,
    schedule_created: iso(action.scheduleValue.created), schedule_scheduled: optionalIso(action.scheduleValue.scheduled), schedule_start_after: optionalIso(action.scheduleValue.startAfter), schedule_due: optionalIso(action.scheduleValue.due), schedule_completed: optionalIso(action.scheduleValue.completed),
    created_at: iso(action.createdAt), created_by_type: action.createdBy.type, created_by_id: action.createdBy.id ?? null, updated_at: iso(action.updatedAt), version: action.version.value,
  };
  return Object.freeze({
    action: Object.freeze(row),
    assignments: Object.freeze(action.assignments.map((value): PlatformActionAssignmentRow => Object.freeze({ workspace_id: workspaceId, action_id: actionId, id: value.id.value, assignee_type: value.assigneeType, assignee_id: value.assigneeId ?? null, queue: value.queue ?? null, status: value.status, assigned_at: iso(value.assignedAt), assigned_by_type: value.assignedBy.type, assigned_by_id: value.assignedBy.id ?? null, claimed_at: optionalIso(value.claimedAt), released_at: optionalIso(value.releasedAt) }))),
    sources: Object.freeze(action.sources.map((value): PlatformActionSourceRow => Object.freeze({ workspace_id: workspaceId, action_id: actionId, source_type: value.type, source_id: value.sourceId ?? null, capability: value.capability ?? null, external_system: value.externalSystem ?? null, recorded_at: iso(value.recordedAt), recorded_by_type: value.recordedBy.type, recorded_by_id: value.recordedBy.id ?? null }))),
    history: Object.freeze(action.history.map((value): PlatformActionHistoryRow => Object.freeze({ workspace_id: workspaceId, action_id: actionId, id: value.id.value, version: value.version.value, operation: value.operation, previous_status: value.previousStatus ?? null, resulting_status: value.resultingStatus ?? null, occurred_at: iso(value.occurredAt), actor_type: value.actor.type, actor_id: value.actor.id ?? null, reason: value.reason ?? null, command_id: value.commandId ?? null, external_event_id: value.externalEventId ?? null }))),
    outcomeReferences: Object.freeze(action.outcomeReferences.map((value): PlatformActionOutcomeReferenceRow => Object.freeze({ workspace_id: workspaceId, action_id: actionId, outcome_id: value.outcomeId.value, link_type: value.linkType, linked_at: iso(value.linkedAt), linked_by_type: value.linkedBy.type, linked_by_id: value.linkedBy.id ?? null }))),
  });
}

export function mapPersistenceRowsToPlatformAction(rows: PlatformActionPersistenceRows): PlatformAction {
  const row = rows.action;
  assertChildScope(rows);
  return PlatformAction.reconstitute({
    id: createActionId(row.id), workspaceId: createWorkspaceId(row.workspace_id), title: row.title, ...(row.description ? { description: row.description } : {}), ...(row.action_type ? { actionType: row.action_type } : {}),
    status: row.status, priority: row.priority, owner: actor(row.owner_type, row.owner_id),
    assignments: rows.assignments.map((value) => ({ id: createActionAssignmentId(value.id), assigneeType: value.assignee_type, ...(value.assignee_id ? { assigneeId: value.assignee_id } : {}), ...(value.queue ? { queue: value.queue } : {}), status: value.status, assignedAt: date(value.assigned_at), assignedBy: actor(value.assigned_by_type, value.assigned_by_id), ...(value.claimed_at ? { claimedAt: date(value.claimed_at) } : {}), ...(value.released_at ? { releasedAt: date(value.released_at) } : {}) })),
    schedule: { created: date(row.schedule_created), ...(row.schedule_scheduled ? { scheduled: date(row.schedule_scheduled) } : {}), ...(row.schedule_start_after ? { startAfter: date(row.schedule_start_after) } : {}), ...(row.schedule_due ? { due: date(row.schedule_due) } : {}), ...(row.schedule_completed ? { completed: date(row.schedule_completed) } : {}) },
    sources: rows.sources.map((value) => ({ type: value.source_type, ...(value.source_id ? { sourceId: value.source_id } : {}), ...(value.capability ? { capability: value.capability } : {}), ...(value.external_system ? { externalSystem: value.external_system } : {}), recordedAt: date(value.recorded_at), recordedBy: actor(value.recorded_by_type, value.recorded_by_id) })),
    history: rows.history.map((value) => ({ id: createActionHistoryId(value.id), actionId: createActionId(value.action_id), version: ActionVersion.create(value.version), operation: value.operation, ...(value.previous_status ? { previousStatus: value.previous_status } : {}), ...(value.resulting_status ? { resultingStatus: value.resulting_status } : {}), occurredAt: date(value.occurred_at), actor: actor(value.actor_type, value.actor_id), ...(value.reason ? { reason: value.reason } : {}), ...(value.command_id ? { commandId: value.command_id } : {}), ...(value.external_event_id ? { externalEventId: value.external_event_id } : {}) })),
    outcomeReferences: rows.outcomeReferences.map((value) => ({ outcomeId: Identifier.create(value.outcome_id), linkType: value.link_type, linkedAt: date(value.linked_at), linkedBy: actor(value.linked_by_type, value.linked_by_id) })),
    createdAt: date(row.created_at), createdBy: actor(row.created_by_type, row.created_by_id), updatedAt: date(row.updated_at), version: ActionVersion.create(row.version),
  });
}

function assertChildScope(rows: PlatformActionPersistenceRows): void {
  const workspace = rows.action.workspace_id, action = rows.action.id;
  for (const value of [...rows.assignments, ...rows.sources, ...rows.history, ...rows.outcomeReferences]) if (value.workspace_id !== workspace || value.action_id !== action) throw new TypeError("Platform Action persistence rows cross aggregate or workspace scope.");
}
function actor(type: ActionActor["type"], id: string | null): ActionActor { return Object.freeze({ type, ...(id ? { id } : {}) }); }
function date(value: string): Date { const result = new Date(value); if (Number.isNaN(result.getTime())) throw new TypeError("Platform Action persistence timestamp is invalid."); return result; }
function iso(value: Date): string { return value.toISOString(); }
function optionalIso(value?: Date): string | null { return value ? iso(value) : null; }
