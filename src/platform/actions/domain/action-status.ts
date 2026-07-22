export const ACTION_STATUSES = [
  "draft",
  "committed",
  "ready",
  "in-progress",
  "blocked",
  "completed",
  "cancelled",
  "archived",
] as const;

export type ActionStatus = (typeof ACTION_STATUSES)[number];

export const ACTION_TRANSITIONS: Readonly<Record<ActionStatus, readonly ActionStatus[]>> = Object.freeze({
  draft: Object.freeze(["committed", "cancelled", "archived"]),
  committed: Object.freeze(["ready", "blocked", "cancelled"]),
  ready: Object.freeze(["in-progress", "blocked", "cancelled"]),
  "in-progress": Object.freeze(["blocked", "completed", "cancelled"]),
  blocked: Object.freeze(["ready", "in-progress", "cancelled"]),
  completed: Object.freeze(["archived"]),
  cancelled: Object.freeze(["archived"]),
  archived: Object.freeze([]),
} satisfies Record<ActionStatus, readonly ActionStatus[]>);
