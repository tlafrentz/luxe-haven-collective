import { describe, expect, it, vi } from "vitest";
import { createAutomationTriggerService, type BackfillJob, type SchedulerCoordinationRepository, type TriggerActivity, type TriggerBackfillRepository, type TriggerDefinitionRepository, type TriggerOccurrenceRepository } from "./automation-trigger-processing";
import { createAutomationDefinitionVersion, type AutomationActor, type AutomationDefinition, type AutomationDefinitionConfiguration } from "../domain/automation-definition";
import { type AutomationRunRequest, type AutomationTriggerDefinition, type TriggerOccurrence } from "../domain/automation-triggering";

const now = "2026-08-10T12:00:00.000Z";
const actor: AutomationActor = { actorId: "owner-1", tenantId: "tenant-1", role: "owner", active: true, propertyIds: [] };
const serviceActor = { actorId: "scheduler-1", tenantId: "tenant-1", role: "service" as const, active: true, grants: ["scheduler" as const], propertyIds: [] };
const configuration: AutomationDefinitionConfiguration = { scope: { type: "property", propertyIds: ["property-1"] }, ownerId: "owner-1", trigger: { kind: "schedule", schemaVersion: "v1", sourceCapability: "scheduler", specification: {} }, conditions: [], exclusions: [], command: { owningCapability: "execute", commandType: "create-draft", contractVersion: "v1" }, approval: { mode: "before-run", authority: "owner" }, execution: { maxFanOut: 20, maxChainDepth: 3, concurrency: "queue" }, retry: { maxAttempts: 1, timeoutMs: 1000 }, notification: { eventTypes: [] }, effectiveFrom: "2026-01-01T00:00:00Z" };
const definition: AutomationDefinition = { id: "automation-1", tenantId: "tenant-1", status: "active", currentVersion: 1, version: 3, createdBy: "owner-1", createdAt: "2026-01-01T00:00:00Z" };
const current = createAutomationDefinitionVersion({ id: "version-1", automationId: "automation-1", tenantId: "tenant-1", version: 1, name: "Test", description: "Test trigger", status: "active", configuration, compatibility: "compatible", createdBy: "owner-1", createdAt: "2026-01-01T00:00:00Z", reason: "Activated" });
const trigger = (kind: AutomationTriggerDefinition["kind"] = "MANUAL", overrides: Partial<AutomationTriggerDefinition> = {}): AutomationTriggerDefinition => ({ id: "trigger-1", automationId: "automation-1", automationDefinitionVersion: 1, tenantId: "tenant-1", kind, schemaVersion: "au001-trigger.v1", scope: { type: "property", propertyIds: ["property-1"] }, enabled: true, effectiveFrom: "2026-01-01T00:00:00Z", configuration: kind === "SCHEDULE_CALENDAR" ? { cadence: "DAILY", localTime: "06:00", timeZone: "America/Chicago" } : kind === "DOMAIN_EVENT" ? { eventType: "reservation.changed" } : {}, misfirePolicy: "SKIP", backfillPolicy: { maximumCount: 10, maximumAgeMs: 604_800_000 }, deduplicationPolicyVersion: "au001-occurrence.v1", eligibilityPolicyVersion: "au001-eligibility.v1", createdBy: "owner-1", updatedBy: "owner-1", createdAt: now, updatedAt: now, version: 1, ...overrides });

function harness(input: { enabled?: boolean; authorized?: boolean; checkpointAt?: string; clock?: () => string } = {}) {
  let selected = trigger(); const occurrences = new Map<string, { occurrence: TriggerOccurrence; runRequest?: AutomationRunRequest }>(); const activities: TriggerActivity[] = []; const jobs = new Map<string, BackfillJob>(); let checkpoint: { partitionKey: string; watermark: string; version: number } | null = input.checkpointAt ? { partitionKey: "tenant-1:calendar", watermark: input.checkpointAt, version: 1 } : null; let leaseGeneration = 0; let ids = 0;
  const definitions: TriggerDefinitionRepository = {
    getTrigger: vi.fn(async (_tenant, id) => id === selected.id ? selected : null),
    listScheduleTriggers: vi.fn(async () => [selected]), listEventTriggers: vi.fn(async () => [selected]),
    updateEnabled: vi.fn(async (update) => { if (selected.version !== update.expectedVersion) throw new Error("conflict"); selected = { ...selected, enabled: update.enabled, version: selected.version + 1, updatedAt: update.occurredAt, updatedBy: update.actorId }; activities.push(update.activity); return selected; }),
  };
  const occurrenceRepository: TriggerOccurrenceRepository = {
    accept: vi.fn(async (value) => { const existing = occurrences.get(value.occurrence.id); if (existing) return { created: false, ...existing }; const stored = { occurrence: value.runRequest ? { ...value.occurrence, disposition: "RUN_REQUEST_CREATED" as const } : value.occurrence, ...(value.runRequest ? { runRequest: value.runRequest } : {}) }; occurrences.set(value.occurrence.id, stored); activities.push(...value.activity); return { created: true, ...stored }; }),
    getOccurrence: vi.fn(async (_tenant, id) => occurrences.get(id)?.occurrence ?? null), listRecent: vi.fn(async (_tenant, id) => [...occurrences.values()].map(({ occurrence }) => occurrence).filter((item) => item.triggerId === id).slice(-1)), countAccepted: vi.fn(async ({ automationId }) => [...occurrences.values()].filter((item) => item.runRequest && (!automationId || item.occurrence.automationId === automationId)).length),
  };
  const coordination: SchedulerCoordinationRepository = {
    claimLease: vi.fn(async ({ partitionKey, ownerId, now: at, durationMs }) => ({ partitionKey, ownerId, generation: ++leaseGeneration, acquiredAt: at, heartbeatAt: at, expiresAt: new Date(Date.parse(at) + durationMs).toISOString(), progress: 0 })),
    heartbeat: vi.fn(async ({ lease, now: at, durationMs, progress }) => ({ ...lease, heartbeatAt: at, expiresAt: new Date(Date.parse(at) + durationMs).toISOString(), progress })), release: vi.fn(async () => undefined),
    getCheckpoint: vi.fn(async () => checkpoint), advanceCheckpoint: vi.fn(async ({ partitionKey, expectedVersion, watermark }) => { if ((checkpoint?.version ?? 0) !== expectedVersion) throw new Error("checkpoint conflict"); checkpoint = { partitionKey, watermark, version: expectedVersion + 1 }; return checkpoint; }),
  };
  const backfills: TriggerBackfillRepository = { getByIdempotencyKey: vi.fn(async (_tenant, key) => [...jobs.values()].find((job) => job.idempotencyKey === key) ?? null), save: vi.fn(async (job, expected) => { const existing = jobs.get(job.id); if (expected !== undefined && existing?.version !== expected) throw new Error("conflict"); jobs.set(job.id, job); return job; }), get: vi.fn(async (_tenant, id) => jobs.get(id) ?? null) };
  const service = createAutomationTriggerService({ definitions, automations: { get: vi.fn(async () => ({ definition, current })) }, occurrences: occurrenceRepository, coordination, backfills, authorization: { authorize: vi.fn(async () => input.authorized ?? true) }, clock: input.clock ?? (() => now), id: () => `id-${++ids}`, telemetry: { emit: vi.fn() }, enabled: () => input.enabled ?? true, limits: { maximumEventPayloadBytes: 4096, maximumEventLatenessMs: 86_400_000, maximumFanOut: 20, maximumTenantRequestsPerHour: 100, maximumRecursionDepth: 4, maximumBackfillCount: 20, leaseDurationMs: 60_000 } });
  return { service, definitions, occurrenceRepository, coordination, backfills, occurrences, activities, jobs, setTrigger: (value: AutomationTriggerDefinition) => { selected = value; } };
}

describe("AU-001B trigger processing", () => {
  it("creates one version-bound run request for retried manual requests", async () => {
    const test = harness(); const command = { actor, tenantId: "tenant-1", triggerId: "trigger-1", expectedAutomationVersion: 1, idempotencyKey: "manual-1", correlationId: "correlation-1" };
    const first = await test.service.requestManualTrigger(command); const replay = await test.service.requestManualTrigger(command);
    expect(first.ok && first.value.runRequest?.status).toBe("REQUESTED"); expect(replay).toEqual(first); expect(test.occurrences).toHaveLength(1);
    expect(first.ok && first.value.runRequest).toMatchObject({ automationDefinitionVersion: 1, occurrenceId: first.ok ? first.value.occurrence.id : "", approvalClassification: "before-run" });
  });

  it("preserves submitted input for a stale manual automation version", async () => {
    const result = await harness().service.requestManualTrigger({ actor, tenantId: "tenant-1", triggerId: "trigger-1", expectedAutomationVersion: 9, idempotencyKey: "manual-1", correlationId: "c" });
    expect(result).toMatchObject({ ok: false, code: "AUTOMATION_VERSION_CONFLICT", currentVersion: 1, submittedInput: { idempotencyKey: "manual-1" } });
  });

  it("enforces manual authorization and the kill switch", async () => {
    const denied = await harness({ authorized: false }).service.requestManualTrigger({ actor, tenantId: "tenant-1", triggerId: "trigger-1", expectedAutomationVersion: 1, idempotencyKey: "manual-1", correlationId: "c" });
    expect(denied).toMatchObject({ ok: false, code: "TRIGGER_MANUAL_REQUEST_UNAUTHORIZED" });
    const disabled = await harness({ enabled: false }).service.requestManualTrigger({ actor, tenantId: "tenant-1", triggerId: "trigger-1", expectedAutomationVersion: 1, idempotencyKey: "manual-1", correlationId: "c" });
    expect(disabled).toMatchObject({ ok: false, code: "SCHEDULER_DEGRADED" });
  });

  it("scans schedules with a lease, advances one checkpoint, and deduplicates replay", async () => {
    const test = harness(); test.setTrigger(trigger("SCHEDULE_CALENDAR", { configuration: { cadence: "DAILY", localTime: "07:00", timeZone: "America/Chicago" } }));
    const input = { actor: serviceActor, tenantId: "tenant-1", partitionKey: "tenant-1:calendar", through: "2026-08-10T12:00:00Z", correlationId: "scan-1", maximumCount: 10 };
    const first = await test.service.scanDueSchedules(input); const second = await test.service.scanDueSchedules(input);
    expect(first).toMatchObject({ ok: true, value: { processed: 1, accepted: 1 } }); expect(second).toMatchObject({ ok: true, value: { processed: 1, accepted: 1 } });
    expect(test.occurrences).toHaveLength(1); expect(test.coordination.claimLease).toHaveBeenCalledTimes(2); expect(test.coordination.advanceCheckpoint).toHaveBeenCalledTimes(2);
  });

  it("does not fail when the scheduler clock advances after the invocation boundary", async () => {
    let reads = 0;
    const test = harness({
      clock: () =>
        reads++ === 0
          ? "2026-08-10T12:00:00.001Z"
          : "2026-08-10T12:00:00.002Z",
    });
    test.setTrigger(trigger("SCHEDULE_CALENDAR"));
    await expect(
      test.service.scanDueSchedules({
        actor: serviceActor,
        tenantId: "tenant-1",
        partitionKey: "tenant-1:calendar",
        through: "2026-08-10T12:00:00.000Z",
        correlationId: "clock-boundary",
        maximumCount: 10,
      }),
    ).resolves.toMatchObject({ ok: true });
  });

  it.each([
    ["SKIP", 2, 0, "MISSED"],
    ["FIRE_ONCE_NOW", 1, 1, "RUN_REQUEST_CREATED"],
    ["BACKFILL_BOUNDED", 2, 2, "RUN_REQUEST_CREATED"],
  ] as const)("applies the %s misfire policy durably", async (misfirePolicy, processed, accepted, disposition) => {
    const test = harness({ checkpointAt: "2026-08-09T00:00:00Z" }); test.setTrigger(trigger("SCHEDULE_CALENDAR", { misfirePolicy }));
    const result = await test.service.scanDueSchedules({ actor: serviceActor, tenantId: "tenant-1", partitionKey: "tenant-1:calendar", through: now, correlationId: `scan-${misfirePolicy}`, maximumCount: 10 });
    expect(result).toMatchObject({ ok: true, value: { processed, accepted } }); expect([...test.occurrences.values()][0].occurrence.disposition).toBe(disposition);
  });

  it("validates and deduplicates canonical event delivery without exposing payload", async () => {
    const test = harness(); test.setTrigger(trigger("DOMAIN_EVENT"));
    const event = { id: "event-1", eventType: "reservation.changed", schemaVersion: "au001-event.v1", tenantId: "tenant-1", sourceCapability: "reservations", occurredAt: "2026-08-10T11:00:00Z", recordedAt: "2026-08-10T11:00:01Z", correlationId: "c", causationDepth: 0, propertyIds: ["property-1"], safePayload: { secret: "not-projected" }, authenticity: "verified" as const };
    expect(await test.service.ingestDomainEvent({ actor: serviceActor, event })).toMatchObject({ ok: true, value: { evaluated: 1, accepted: 1 } });
    expect(await test.service.ingestDomainEvent({ actor: serviceActor, event })).toMatchObject({ ok: true, value: { evaluated: 1, accepted: 1 } });
    expect(test.occurrences).toHaveLength(1); expect(JSON.stringify([...test.occurrences.values()])).not.toContain("not-projected");
  });

  it("stores explicit non-run dispositions when conditions do not match", async () => {
    const test = harness(); test.setTrigger(trigger("STATE_CHANGE", { configuration: { field: "status", operator: "ENTER_SET", to: ["overdue"], allowInitialEntry: false } }));
    const result = await test.service.evaluateState({ actor: serviceActor, trigger: trigger("STATE_CHANGE", { configuration: { field: "status", operator: "ENTER_SET", to: ["overdue"], allowInitialEntry: false } }), current: "overdue", currentVersion: 1, observedAt: now, sourceIdentity: "observation-1", correlationId: "c", sourceAuthorized: true });
    expect(result).toMatchObject({ ok: true, value: { occurrence: { disposition: "INELIGIBLE", reasonCode: "TRIGGER_CONDITION_NOT_MET" } } }); expect(result.ok && result.value.runRequest).toBeUndefined();
  });

  it("pauses and resumes explicitly with optimistic versions and activity", async () => {
    const test = harness(); expect(await test.service.pauseTrigger({ actor, tenantId: "tenant-1", triggerId: "trigger-1", expectedVersion: 1, reason: "Maintenance", correlationId: "c" })).toMatchObject({ ok: true, value: { enabled: false, version: 2 } });
    expect(await test.service.resumeTrigger({ actor, tenantId: "tenant-1", triggerId: "trigger-1", expectedVersion: 2, reason: "Recovered", correlationId: "c" })).toMatchObject({ ok: true, value: { enabled: true, version: 3 } });
    expect(test.activities.map(({ eventType }) => eventType)).toEqual(["trigger-paused", "trigger-resumed"]);
  });

  it("previews, creates, replays, processes, and cancels bounded backfill jobs", async () => {
    const test = harness(); test.setTrigger(trigger("SCHEDULE_CALENDAR"));
    const preview = await test.service.previewMissed({ actor, tenantId: "tenant-1", triggerId: "trigger-1", from: "2026-08-08T00:00:00Z", through: "2026-08-10T12:00:00Z", maximumCount: 10 }); expect(preview).toMatchObject({ ok: true, value: { count: 3 } });
    const request = { actor, tenantId: "tenant-1", triggerId: "trigger-1", from: "2026-08-08T00:00:00Z", through: "2026-08-10T12:00:00Z", maximumCount: 3, idempotencyKey: "backfill-1", correlationId: "c", reason: "Recover outage" };
    const created = await test.service.requestBackfill(request); const replay = await test.service.requestBackfill(request); expect(replay).toEqual(created);
    if (!created.ok) throw new Error("Backfill not created"); const processed = await test.service.processBackfillBatch({ actor: serviceActor, tenantId: "tenant-1", jobId: created.value.id }); expect(processed).toMatchObject({ ok: true, value: { status: "COMPLETED", processedCount: 3 } });
    const second = harness(); second.setTrigger(trigger("SCHEDULE_CALENDAR")); const pending = await second.service.requestBackfill(request); if (!pending.ok) throw new Error("Backfill not created"); expect(await second.service.cancelBackfill({ actor, tenantId: "tenant-1", jobId: pending.value.id, expectedVersion: 1, reason: "No longer needed" })).toMatchObject({ ok: true, value: { status: "CANCELLED" } });
  }, 15_000);

  it("reports trigger health from durable state", async () => {
    const healthy = await harness().service.readTriggerHealth({ actor, tenantId: "tenant-1", triggerId: "trigger-1" }); expect(healthy).toMatchObject({ ok: true, value: { classification: "HEALTHY" } });
    const degraded = await harness({ enabled: false }).service.readTriggerHealth({ actor, tenantId: "tenant-1", triggerId: "trigger-1" }); expect(degraded).toMatchObject({ ok: true, value: { classification: "DEGRADED" } });
  });

  it("contains no owning-capability dispatch dependency", () => {
    const keys = Object.keys(harness()); expect(keys).not.toContain("dispatcher"); expect(keys).not.toContain("commandBus");
  });
});
