export const ACTION_PRIORITIES = ["critical", "high", "medium", "low"] as const;
export type ActionPriority = (typeof ACTION_PRIORITIES)[number];
export const ACTION_PRIORITY_RANK: Readonly<Record<ActionPriority, number>> = Object.freeze({
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
});
