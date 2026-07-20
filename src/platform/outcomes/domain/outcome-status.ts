export const OUTCOME_STATUSES = ["pending", "running", "completed", "failed", "cancelled", "timed-out"] as const;
export type OutcomeStatus = (typeof OUTCOME_STATUSES)[number];
