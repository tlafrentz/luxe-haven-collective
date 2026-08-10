import { describe, expect, it } from "vitest";
import { classifyTriggerHealth, projectTriggerDetail } from "./automation-trigger-projections";
import type { AutomationTriggerDefinition } from "../domain/automation-triggering";

const at = "2026-08-10T12:00:00Z";
const trigger: AutomationTriggerDefinition = { id: "trigger-1", automationId: "automation-1", automationDefinitionVersion: 1, tenantId: "tenant-1", kind: "SCHEDULE_CALENDAR", schemaVersion: "au001-trigger.v1", scope: { type: "property", propertyIds: ["property-1"] }, enabled: true, effectiveFrom: "2026-01-01T00:00:00Z", configuration: { cadence: "DAILY", localTime: "08:00", timeZone: "America/Chicago" }, misfirePolicy: "SKIP", backfillPolicy: { maximumCount: 10, maximumAgeMs: 604_800_000 }, deduplicationPolicyVersion: "au001-occurrence.v1", eligibilityPolicyVersion: "au001-eligibility.v1", createdBy: "owner-1", updatedBy: "owner-1", createdAt: at, updatedAt: at, version: 1 };

describe("AU-001B trigger projections", () => {
  it("calculates health deterministically from durable state", () => {
    expect(classifyTriggerHealth({ trigger, now: at, schedulerEnabled: false, sourceAvailable: true, delayToleranceMs: 1000 }).classification).toBe("DEGRADED");
    expect(classifyTriggerHealth({ trigger: { ...trigger, enabled: false }, now: at, schedulerEnabled: true, sourceAvailable: true, delayToleranceMs: 1000 }).classification).toBe("PAUSED");
  });
  it("projects the next slot and server-authoritative commands without unrelated records", () => {
    const health = classifyTriggerHealth({ trigger, now: at, schedulerEnabled: true, sourceAvailable: true, delayToleranceMs: 1000 });
    const detail = projectTriggerDetail({ actor: { actorId: "owner-1", tenantId: "tenant-1", role: "owner", active: true, propertyIds: [] }, trigger, occurrences: [], runRequests: [], backfills: [], health, now: at, mayAdministerScheduler: true });
    expect(detail.nextOccurrence).toMatchObject({ occurredAt: "2026-08-10T13:00:00.000Z", timeZone: "America/Chicago" });
    expect(detail.validCommands).toEqual(expect.arrayContaining(["view", "pause", "preview-missed", "backfill", "scheduler"]));
  });
});
