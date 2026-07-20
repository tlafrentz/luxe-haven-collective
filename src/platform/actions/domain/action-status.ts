export const ACTION_STATUSES = [
  "proposed",
  "accepted",
  "scheduled",
  "in-progress",
  "blocked",
  "completed",
  "measured",
  "archived",
] as const;

export type ActionStatus = (typeof ACTION_STATUSES)[number];
