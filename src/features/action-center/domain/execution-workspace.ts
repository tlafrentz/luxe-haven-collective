import type { ActionCenterAction } from "./action-center-view";

export type ExecutionTimelineEvent = Readonly<{ operation: string; label: string; timestamp: Date; version: number }>;
export type ExecutionWorkspace = Readonly<{ action: ActionCenterAction; timeline: readonly ExecutionTimelineEvent[] }>;
