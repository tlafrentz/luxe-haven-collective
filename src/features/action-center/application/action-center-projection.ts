import type { ActionActor, PlatformAction } from "@/platform/actions";
import type { ActionCenterAction, ActionCenterActorView, ActionCenterCommand, ActionCenterQueue } from "../domain";

export type ActionCenterViewer = Readonly<{ actor: ActionActor; canManage: boolean }>;

export function getAvailableActionCenterCommands(input: Readonly<{ action: PlatformAction; viewer: ActionCenterViewer }>): readonly ActionCenterCommand[] {
  if (!input.viewer.canManage) return [];
  const { action } = input;
  const lifecycle: Partial<Record<PlatformAction["status"], readonly ActionCenterCommand[]>> = {
    draft: ["commit", "cancel", "archive"], committed: ["mark-ready", "assign", "schedule", "cancel"],
    ready: ["assign", "schedule", "start", "cancel"], "in-progress": ["block", "complete", "cancel"],
    blocked: ["unblock", "cancel"], completed: ["link-outcome", "archive"], cancelled: ["archive"], archived: [],
  };
  const assignment: ActionCenterCommand[] = action.activeAssignment
    ? action.activeAssignment.status === "claimed" ? ["release"] : ["claim", "release"]
    : [];
  const commands: ActionCenterCommand[] = [...(lifecycle[action.status] ?? []), ...assignment, "change-priority", "change-owner"];
  return Object.freeze([...new Set(commands)]);
}

export function projectActionCenterAction(action: PlatformAction, viewer: ActionCenterViewer, now = new Date()): ActionCenterAction {
  const dueAt = action.scheduleValue.due;
  return Object.freeze({
    id: action.id.value, version: action.version.value, title: action.title,
    ...(action.description ? { description: action.description } : {}), ...(action.actionType ? { actionType: action.actionType } : {}),
    status: action.status, priority: action.priority, owner: actorView(action.owner),
    ...(action.activeAssignment ? { assignee: actorView({ type: action.activeAssignment.assigneeType, ...(action.activeAssignment.assigneeId ? { id: action.activeAssignment.assigneeId } : {}) }) } : {}),
    ...(dueAt ? { dueAt: new Date(dueAt) } : {}), isOverdue: Boolean(dueAt && dueAt < now && !["completed", "cancelled", "archived"].includes(action.status)),
    sourceLabel: sourceLabel(action), availableCommands: getAvailableActionCenterCommands({ action, viewer }),
    createdAt: action.createdAt, updatedAt: action.updatedAt,
  });
}

export function projectActionCenterQueue(actions: readonly PlatformAction[], viewer: ActionCenterViewer, now = new Date()): ActionCenterQueue {
  const projected = actions.map((action) => projectActionCenterAction(action, viewer, now));
  const activeActions = projected.filter((action) => !["cancelled", "archived", "completed"].includes(action.status)).sort(compareActions);
  const completedActions = projected.filter((action) => action.status === "completed").sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  return Object.freeze({ summary: Object.freeze({ total: projected.filter((a) => a.status !== "archived").length, ready: projected.filter((a) => a.status === "ready").length, inProgress: projected.filter((a) => a.status === "in-progress").length, blocked: projected.filter((a) => a.status === "blocked").length, completed: completedActions.length }), activeActions: Object.freeze(activeActions), completedActions: Object.freeze(completedActions), isEmpty: projected.length === 0 });
}

function actorView(actor: ActionActor): ActionCenterActorView { return Object.freeze({ ...actor, label: actor.id ?? "Unknown" }); }
function sourceLabel(action: PlatformAction): string { const source = action.sources[0]; return source.capability ?? source.externalSystem ?? source.type; }
function compareActions(a: ActionCenterAction, b: ActionCenterAction): number { const rank = { critical: 0, high: 1, normal: 2, low: 3, deferred: 4 }; return rank[a.priority] - rank[b.priority] || Number(a.dueAt ?? Infinity) - Number(b.dueAt ?? Infinity) || b.updatedAt.getTime() - a.updatedAt.getTime(); }
