/** Hospitality vocabulary owned by Execution Engine, not Platform Actions. */
export const HOSPITALITY_ACTION_TYPES = [
  "pricing", "operations", "guest-experience", "distribution", "maintenance", "finance", "marketing", "system",
] as const;

export type HospitalityActionType = (typeof HOSPITALITY_ACTION_TYPES)[number];
