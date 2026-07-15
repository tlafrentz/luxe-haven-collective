export const ACTION_TYPES = [
  "pricing",
  "operations",
  "guest-experience",
  "distribution",
  "maintenance",
  "finance",
  "marketing",
  "system",
] as const;

export type ActionType =
  (typeof ACTION_TYPES)[number];
