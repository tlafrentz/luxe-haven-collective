import { describe, expect, it } from "vitest";
import { ACTION_STATUSES } from "../domain";
import { LEGACY_ACTION_PRIORITIES, mapLegacyActionPriorityToPlatformPriority, mapPlatformActionPriorityToLegacyPriority } from "./legacy-action-priority";
import { LEGACY_ACTION_STATUSES, mapLegacyActionStatusToPlatformStatus, mapPlatformActionStatusToLegacyStatus } from "./legacy-action-status";

describe("legacy Action mappings", () => {
  it("maps every legacy status deliberately", () => {
    expect(LEGACY_ACTION_STATUSES.map(mapLegacyActionStatusToPlatformStatus)).toEqual(["draft", "committed", "ready", "in-progress", "blocked", "completed", "completed", "archived"]);
    expect(mapLegacyActionStatusToPlatformStatus("measured")).toBe("completed");
    expect(mapPlatformActionStatusToLegacyStatus("cancelled")).toBe("archived");
    expect(ACTION_STATUSES).not.toContain("measured");
  });
  it("maps every legacy priority and normalizes medium", () => {
    expect(LEGACY_ACTION_PRIORITIES.map(mapLegacyActionPriorityToPlatformPriority)).toEqual(["critical", "high", "normal", "low"]);
    expect(mapPlatformActionPriorityToLegacyPriority("deferred")).toBe("medium");
  });
});
