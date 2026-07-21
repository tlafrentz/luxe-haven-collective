export const ACTION_PRIORITIES = ["critical", "high", "normal", "low", "deferred"] as const;
export type ActionPriority = (typeof ACTION_PRIORITIES)[number];
export const ACTION_PRIORITY_RANK: Readonly<Record<ActionPriority, number>> = Object.freeze({
  deferred: 0,
  low: 1,
  normal: 2,
  high: 3,
  critical: 4,
});
