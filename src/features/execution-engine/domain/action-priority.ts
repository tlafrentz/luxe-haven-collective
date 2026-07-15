export const ACTION_PRIORITIES = [
  "critical",
  "high",
  "medium",
  "low",
] as const;

export type ActionPriority =
  (typeof ACTION_PRIORITIES)[number];
