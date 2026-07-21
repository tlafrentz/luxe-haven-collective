import type { ActionPriority } from "../domain";
export const LEGACY_ACTION_PRIORITIES = ["critical", "high", "medium", "low"] as const;
export type LegacyActionPriority = (typeof LEGACY_ACTION_PRIORITIES)[number];
export function mapLegacyActionPriorityToPlatformPriority(priority: LegacyActionPriority): ActionPriority { return priority === "medium" ? "normal" : priority; }
export function mapPlatformActionPriorityToLegacyPriority(priority: ActionPriority): LegacyActionPriority { return priority === "normal" || priority === "deferred" ? "medium" : priority; }
