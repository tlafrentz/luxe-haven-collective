import type { ActionStatus } from "../domain";
export const LEGACY_ACTION_STATUSES = ["proposed", "accepted", "scheduled", "in-progress", "blocked", "completed", "measured", "archived"] as const;
export type LegacyActionStatus = (typeof LEGACY_ACTION_STATUSES)[number];
export function mapLegacyActionStatusToPlatformStatus(status: LegacyActionStatus): ActionStatus {
  switch (status) {
    case "proposed": return "draft";
    case "accepted": return "committed";
    case "scheduled": return "ready";
    case "measured": return "completed";
    default: return status;
  }
}
export function mapPlatformActionStatusToLegacyStatus(status: ActionStatus): LegacyActionStatus {
  switch (status) {
    case "draft": return "proposed";
    case "committed": return "accepted";
    case "ready": return "scheduled";
    case "cancelled": return "archived";
    default: return status;
  }
}
