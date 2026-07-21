import type { ActionActorType, ActionPriority, ActionStatus } from "@/platform/actions";

export type ActionCenterStatusView = ActionStatus;
export type ActionCenterPriorityView = ActionPriority;
export type ActionCenterActorView = Readonly<{ type: ActionActorType; id?: string; label: string }>;
export type ActionCenterCommand = "commit" | "mark-ready" | "assign" | "claim" | "release" | "schedule" | "start" | "block" | "unblock" | "complete" | "cancel" | "archive" | "change-priority" | "change-owner" | "link-outcome";

/** Immutable presentation projection. It is neither persisted nor a lifecycle authority. */
export type ActionCenterAction = Readonly<{
  id: string;
  version: number;
  title: string;
  description?: string;
  actionType?: string;
  status: ActionCenterStatusView;
  priority: ActionCenterPriorityView;
  owner: ActionCenterActorView;
  assignee?: ActionCenterActorView;
  dueAt?: Date;
  isOverdue: boolean;
  sourceLabel: string;
  availableCommands: readonly ActionCenterCommand[];
  createdAt: Date;
  updatedAt: Date;
}>;

export type ActionCenterSummary = Readonly<{ total: number; ready: number; inProgress: number; blocked: number; completed: number }>;
export type ActionCenterQueue = Readonly<{
  summary: ActionCenterSummary;
  activeActions: readonly ActionCenterAction[];
  completedActions: readonly ActionCenterAction[];
  isEmpty: boolean;
}>;

export type ActionCenterView = ActionCenterQueue;
