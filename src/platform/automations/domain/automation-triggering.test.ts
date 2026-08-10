import { describe, expect, it } from "vitest";
import { calculateScheduleOccurrences, evaluateStateChange, evaluateThreshold, evaluateTriggerEligibility, occurrenceIdentity, validateDomainEvent, validateTriggerDefinition, type AutomationTriggerDefinition, type CalendarSchedule, type ThresholdSpecification } from "./automation-triggering";
import { createAutomationDefinitionVersion, type AutomationDefinition, type AutomationDefinitionConfiguration } from "./automation-definition";

const calendar = (configuration: Partial<CalendarSchedule> = {}, overrides: Partial<AutomationTriggerDefinition> = {}): AutomationTriggerDefinition => ({
  id: "trigger-1", automationId: "automation-1", automationDefinitionVersion: 1, tenantId: "tenant-1", kind: "SCHEDULE_CALENDAR", schemaVersion: "au001-trigger.v1",
  scope: { type: "property", propertyIds: ["property-1"] }, enabled: true, effectiveFrom: "2026-01-01T00:00:00Z",
  configuration: { cadence: "DAILY", localTime: "09:30", timeZone: "America/Chicago", ...configuration }, misfirePolicy: "SKIP",
  backfillPolicy: { maximumCount: 50, maximumAgeMs: 2_592_000_000 }, deduplicationPolicyVersion: "au001-occurrence.v1", eligibilityPolicyVersion: "au001-eligibility.v1",
  createdBy: "actor-1", updatedBy: "actor-1", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", version: 1, ...overrides,
});

describe("AU-001B schedule calculation", () => {
  it("calculates daily slots independently of the host time zone", () => {
    const slots = calculateScheduleOccurrences({ trigger: calendar(), from: "2026-02-01T00:00:00Z", through: "2026-02-03T23:59:59Z", maximumCount: 10 });
    expect(slots.map(({ occurredAt }) => occurredAt)).toEqual(["2026-02-01T15:30:00.000Z", "2026-02-02T15:30:00.000Z", "2026-02-03T15:30:00.000Z"]);
  });

  it("supports weekdays, month days, invalid month days, leap years, and bounded windows", () => {
    const weekdays = calculateScheduleOccurrences({ trigger: calendar({ cadence: "SELECTED_WEEKDAYS", weekdays: [1, 3], localTime: "08:00" }), from: "2026-02-01T00:00:00Z", through: "2026-02-08T23:59:59Z", maximumCount: 10 });
    expect(weekdays).toHaveLength(2);
    const monthEnd = calculateScheduleOccurrences({ trigger: calendar({ cadence: "DAYS_OF_MONTH", daysOfMonth: [29, 31], invalidDayPolicy: "LAST_DAY" }), from: "2028-02-01T00:00:00Z", through: "2028-02-29T23:59:59Z", maximumCount: 10 });
    expect(monthEnd).toHaveLength(1);
    expect(monthEnd[0].localDateTime).toContain("2028-02-29");
  });

  it("advances nonexistent spring-forward times and chooses one fall-back offset", () => {
    const gap = calculateScheduleOccurrences({ trigger: calendar({ localTime: "02:30", timeZone: "America/New_York" }), from: "2026-03-08T00:00:00Z", through: "2026-03-09T00:00:00Z", maximumCount: 2 });
    expect(gap[0]).toMatchObject({ occurredAt: "2026-03-08T07:00:00.000Z", localDateTime: "2026-03-08T03:00", adjustment: "DST_GAP_ADVANCED" });
    const earlier = calculateScheduleOccurrences({ trigger: calendar({ localTime: "01:30", timeZone: "America/New_York" }), from: "2026-11-01T00:00:00Z", through: "2026-11-02T00:00:00Z", maximumCount: 2 });
    const later = calculateScheduleOccurrences({ trigger: calendar({ localTime: "01:30", timeZone: "America/New_York", ambiguousTimePolicy: "LATER" }), from: "2026-11-01T00:00:00Z", through: "2026-11-02T00:00:00Z", maximumCount: 2 });
    expect(earlier).toHaveLength(1); expect(earlier[0].occurredAt).toBe("2026-11-01T05:30:00.000Z");
    expect(later).toHaveLength(1); expect(later[0].occurredAt).toBe("2026-11-01T06:30:00.000Z");
  });

  it("calculates restart-independent interval slots from a persisted anchor", () => {
    const trigger = calendar({}, { kind: "SCHEDULE_INTERVAL", configuration: { anchor: "2026-01-01T00:00:00Z", intervalUnit: "HOUR", intervalValue: 6 } });
    const first = calculateScheduleOccurrences({ trigger, from: "2026-01-01T05:00:00Z", through: "2026-01-02T00:00:00Z", maximumCount: 10 });
    const replay = calculateScheduleOccurrences({ trigger, from: "2026-01-01T05:00:00Z", through: "2026-01-02T00:00:00Z", maximumCount: 10 });
    expect(first).toEqual(replay); expect(first.map(({ occurredAt }) => occurredAt)).toEqual(["2026-01-01T06:00:00.000Z", "2026-01-01T12:00:00.000Z", "2026-01-01T18:00:00.000Z", "2026-01-02T00:00:00.000Z"]);
  });

  it("rejects invalid zones and schedules", () => {
    expect(() => validateTriggerDefinition(calendar({ timeZone: "UTC-6" }))).toThrow("IANA time zone");
    expect(() => validateTriggerDefinition(calendar({ localTime: "25:00" }))).toThrow("HH:mm");
  });
});

describe("AU-001B event, state, and threshold policies", () => {
  it("creates stable occurrence identities from immutable inputs", () => {
    const input = { tenantId: "t", automationId: "a", automationDefinitionVersion: 2, triggerId: "g", triggerKind: "DOMAIN_EVENT" as const, sourceIdentity: "event:1", eligibilityPolicyVersion: "v1" };
    expect(occurrenceIdentity(input)).toBe(occurrenceIdentity(input));
    expect(occurrenceIdentity({ ...input, automationDefinitionVersion: 3 })).not.toBe(occurrenceIdentity(input));
  });

  it("validates authenticated canonical event envelopes, tenant, schema, lateness, and size", () => {
    const event = { id: "event-1", eventType: "reservation.changed", schemaVersion: "v1", tenantId: "tenant-1", sourceCapability: "reservations", occurredAt: "2026-08-10T11:00:00Z", recordedAt: "2026-08-10T11:00:01Z", correlationId: "c", causationDepth: 0, propertyIds: ["property-1"], safePayload: { status: "confirmed" }, authenticity: "verified" as const };
    expect(validateDomainEvent(event, { expectedTenantId: "tenant-1", acceptedSchemaVersions: ["v1"], maximumPayloadBytes: 100, maximumLatenessMs: 7_200_000, now: "2026-08-10T12:00:00Z" })).toEqual(event);
    expect(() => validateDomainEvent(event, { expectedTenantId: "other", acceptedSchemaVersions: ["v1"], maximumPayloadBytes: 100, maximumLatenessMs: 7_200_000, now: "2026-08-10T12:00:00Z" })).toThrow("tenant");
    expect(() => validateDomainEvent(event, { expectedTenantId: "tenant-1", acceptedSchemaVersions: ["v2"], maximumPayloadBytes: 100, maximumLatenessMs: 7_200_000, now: "2026-08-10T12:00:00Z" })).toThrow("schema");
  });

  it("evaluates versioned state changes without fabricating initial transitions", () => {
    const spec = { field: "status", operator: "ENTER_SET" as const, to: ["overdue"], allowInitialEntry: false };
    expect(evaluateStateChange(spec, { current: "overdue", currentVersion: 1 }).matched).toBe(false);
    expect(evaluateStateChange(spec, { previous: "open", current: "overdue", previousVersion: 1, currentVersion: 2 })).toEqual({ matched: true, reasonCode: "STATE_TRANSITION_MATCHED" });
    expect(() => evaluateStateChange(spec, { previous: "open", current: "overdue", previousVersion: 2, currentVersion: 2 })).toThrow("monotonic");
  });

  it("handles threshold boundaries, cooldown, unit mismatch, stale data, and re-arm", () => {
    const spec: ThresholdSpecification = { metricId: "occupancy", metricVersion: "v1", unit: "percent", operator: "AT_OR_ABOVE", value: 80, freshnessMs: 3_600_000, repeat: "LEVEL_WITH_COOLDOWN", cooldownMs: 600_000, missingDataPolicy: "DEFER" };
    expect(evaluateThreshold(spec, { previous: 79, current: 80, unit: "percent", observedAt: "2026-08-10T11:59:00Z", now: "2026-08-10T12:00:00Z", armed: true }).matched).toBe(true);
    expect(evaluateThreshold(spec, { previous: 80, current: 81, unit: "percent", observedAt: "2026-08-10T11:59:00Z", now: "2026-08-10T12:00:00Z", lastAcceptedAt: "2026-08-10T11:55:00Z", armed: false }).reasonCode).toBe("TRIGGER_COOLDOWN_ACTIVE");
    expect(evaluateThreshold(spec, { previous: 81, current: 79, unit: "percent", observedAt: "2026-08-10T11:59:00Z", now: "2026-08-10T12:00:00Z", armed: false })).toEqual({ matched: false, armed: true, reasonCode: "THRESHOLD_REARMED" });
    expect(() => evaluateThreshold(spec, { current: 90, unit: "count", observedAt: "2026-08-10T11:59:00Z", now: "2026-08-10T12:00:00Z", armed: true })).toThrow("unit");
  });
});

describe("AU-001B eligibility", () => {
  const configuration: AutomationDefinitionConfiguration = { scope: { type: "property", propertyIds: ["property-1"] }, ownerId: "owner", trigger: { kind: "schedule", schemaVersion: "v1", sourceCapability: "scheduler", specification: {} }, conditions: [], exclusions: [], command: { owningCapability: "execute", commandType: "create-draft", contractVersion: "v1" }, approval: { mode: "before-run", authority: "owner" }, execution: { maxFanOut: 10, maxChainDepth: 3, concurrency: "queue" }, retry: { maxAttempts: 1, timeoutMs: 1000 }, notification: { eventTypes: [] }, effectiveFrom: "2026-01-01T00:00:00Z" };
  const definition: AutomationDefinition = { id: "automation-1", tenantId: "tenant-1", status: "active", currentVersion: 1, version: 3, createdBy: "owner", createdAt: "2026-01-01T00:00:00Z" };
  const version = createAutomationDefinitionVersion({ id: "v1", automationId: "automation-1", tenantId: "tenant-1", version: 1, name: "Test", description: "Test automation", status: "active", configuration, compatibility: "compatible", createdBy: "owner", createdAt: "2026-01-01T00:00:00Z", reason: "Activated" });
  const eligible = { definition, version, trigger: calendar(), occurredAt: "2026-08-10T12:00:00Z", sourceAuthorized: true, sourceCurrent: true, conditionMatched: true, recursionDepth: 1, maximumRecursionDepth: 3, cycleDetected: false, fanOutCount: 0, maximumFanOut: 10 };
  it("permits only active, compatible, scoped, safe occurrences", () => {
    expect(evaluateTriggerEligibility(eligible)).toEqual({ eligible: true, reasonCode: "TRIGGER_ELIGIBLE" });
    expect(evaluateTriggerEligibility({ ...eligible, cycleDetected: true }).reasonCode).toBe("TRIGGER_CYCLE_DETECTED");
    expect(evaluateTriggerEligibility({ ...eligible, sourceCurrent: false }).reasonCode).toBe("TRIGGER_SOURCE_STALE");
    expect(evaluateTriggerEligibility({ ...eligible, definition: { ...definition, status: "paused" } }).reasonCode).toBe("AUTOMATION_NOT_ACTIVE");
  });
});
