export const WORKFLOW_STATUSES = [
  "pending",
  "ready",
  "active",
  "waiting",
  "blocked",
  "completed",
  "cancelled",
] as const;

export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];
