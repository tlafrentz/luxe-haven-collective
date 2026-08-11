import { type AutomationActor, type AutomationDefinition, type AutomationDefinitionVersion } from "../domain/automation-definition";
import { AutomationTriggerError, calculateScheduleOccurrences, evaluateStateChange, evaluateThreshold, evaluateTriggerEligibility, occurrenceIdentity, validateDomainEvent, type AutomationRunRequest, type AutomationTriggerDefinition, type CanonicalAutomationTriggerKind, type CanonicalDomainEvent, type ScheduleOccurrenceSlot, type StateChangeSpecification, type ThresholdSpecification, type TriggerFailureCode, type TriggerOccurrence } from "../domain/automation-triggering";

export type TriggerOperation = "view" | "pause" | "resume" | "manual-trigger" | "test" | "preview-missed" | "backfill" | "cancel-backfill" | "scheduler";
export type TriggerActivity = Readonly<{ id: string; tenantId: string; automationId: string; triggerId: string; occurrenceId?: string; eventType: string; actorId: string; occurredAt: string; correlationId: string; causationId?: string; aggregateVersion: number; safeMetadata: Readonly<Record<string, string | number | boolean | null>> }>;
export type TriggerTelemetryEvent = Readonly<{ name: string; tenantId: string; triggerKind?: CanonicalAutomationTriggerKind; correlationId: string; classification: string; count?: number; durationMs?: number }>;
export type TriggerResult<T> = Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; code: TriggerFailureCode; message: string; currentVersion?: number; submittedInput?: Readonly<Record<string, unknown>> }>;
export type TriggerHealth = Readonly<{ triggerId: string; classification: "HEALTHY" | "DUE_SOON" | "PROCESSING" | "DELAYED" | "STALE_SOURCE" | "PAUSED" | "BACKFILLING" | "DEGRADED" | "BLOCKED" | "FAILED" | "UNAVAILABLE"; reasonCode: string; evaluatedAt: string; lastOccurrenceAt?: string; nextOccurrenceAt?: string }>;

export interface TriggerDefinitionRepository {
  getTrigger(tenantId: string, triggerId: string): Promise<AutomationTriggerDefinition | null>;
  listScheduleTriggers(tenantId: string, from: string, through: string): Promise<readonly AutomationTriggerDefinition[]>;
  listEventTriggers(tenantId: string, eventType: string): Promise<readonly AutomationTriggerDefinition[]>;
  updateEnabled(input: Readonly<{ tenantId: string; triggerId: string; expectedVersion: number; enabled: boolean; actorId: string; occurredAt: string; reason: string; activity: TriggerActivity }>): Promise<AutomationTriggerDefinition>;
}
export interface TriggerAutomationReader { get(tenantId: string, automationId: string): Promise<Readonly<{ definition: AutomationDefinition; current: AutomationDefinitionVersion }> | null>; }
export interface TriggerAuthorizationPort { authorize(input: Readonly<{ actor: AutomationActor | SchedulerActor; operation: TriggerOperation; tenantId: string; propertyIds: readonly string[]; sourceCapability?: string }>): Promise<boolean>; }
export type SchedulerActor = Readonly<{ actorId: string; tenantId: string; role: "service"; active: boolean; grants: readonly TriggerOperation[]; propertyIds: readonly string[] }>;
export interface TriggerOccurrenceRepository {
  accept(input: Readonly<{ occurrence: TriggerOccurrence; runRequest?: AutomationRunRequest; activity: readonly TriggerActivity[] }>): Promise<Readonly<{ created: boolean; occurrence: TriggerOccurrence; runRequest?: AutomationRunRequest }>>;
  getOccurrence(tenantId: string, occurrenceId: string): Promise<TriggerOccurrence | null>;
  listRecent(tenantId: string, triggerId: string, limit: number): Promise<readonly TriggerOccurrence[]>;
  countAccepted(input: Readonly<{ tenantId: string; automationId?: string; since: string }>): Promise<number>;
}
export type SchedulerLease = Readonly<{ partitionKey: string; ownerId: string; generation: number; acquiredAt: string; expiresAt: string; heartbeatAt: string; progress: number }>;
export interface SchedulerCoordinationRepository {
  claimLease(input: Readonly<{ tenantId: string; partitionKey: string; ownerId: string; now: string; durationMs: number }>): Promise<SchedulerLease | null>;
  heartbeat(input: Readonly<{ lease: SchedulerLease; now: string; durationMs: number; progress: number }>): Promise<SchedulerLease>;
  release(input: Readonly<{ lease: SchedulerLease; now: string }>): Promise<void>;
  getCheckpoint(partitionKey: string): Promise<Readonly<{ partitionKey: string; watermark: string; version: number }> | null>;
  advanceCheckpoint(input: Readonly<{ partitionKey: string; expectedVersion: number; watermark: string; lease: SchedulerLease }>): Promise<Readonly<{ partitionKey: string; watermark: string; version: number }>>;
}
export type BackfillJob = Readonly<{ id: string; tenantId: string; triggerId: string; automationDefinitionVersion: number; from: string; through: string; maximumCount: number; status: "PENDING" | "PROCESSING" | "COMPLETED" | "CANCELLED" | "FAILED_SAFE"; processedCount: number; idempotencyKey: string; reason: string; requestedBy: string; correlationId: string; createdAt: string; version: number }>;
export interface TriggerBackfillRepository {
  getByIdempotencyKey(tenantId: string, idempotencyKey: string): Promise<BackfillJob | null>;
  save(job: BackfillJob, expectedVersion?: number): Promise<BackfillJob>;
  get(tenantId: string, jobId: string): Promise<BackfillJob | null>;
}
export interface TriggerTelemetry { emit(event: TriggerTelemetryEvent): void; }

type Candidate = Readonly<{ trigger: AutomationTriggerDefinition; sourceIdentity: string; occurredAt: string; detectedAt: string; correlationId: string; causationId?: string; causationDepth: number; targetKey?: string; safeContext: Readonly<Record<string, string | number | boolean | null>>; sourceAuthorized: boolean; sourceCurrent: boolean; conditionMatched: boolean; backfilled?: boolean; forcedNonRun?: Readonly<{ disposition: "MISSED" | "EXPIRED" | "DEFERRED" | "FAILED_SAFE"; reasonCode: string }>; actorId: string }>;

export function createAutomationTriggerService(dependencies: Readonly<{
  definitions: TriggerDefinitionRepository; automations: TriggerAutomationReader; occurrences: TriggerOccurrenceRepository;
  coordination: SchedulerCoordinationRepository; backfills: TriggerBackfillRepository; authorization: TriggerAuthorizationPort;
  clock: () => string; id: () => string; telemetry?: TriggerTelemetry; enabled: () => boolean;
  limits: Readonly<{ maximumEventPayloadBytes: number; maximumEventLatenessMs: number; maximumFanOut: number; maximumTenantRequestsPerHour: number; maximumRecursionDepth: number; maximumBackfillCount: number; leaseDurationMs: number }>;
}>) {
  async function requireAuthorized(actor: AutomationActor | SchedulerActor, operation: TriggerOperation, trigger: AutomationTriggerDefinition, sourceCapability?: string) {
    if (!actor.active || actor.tenantId !== trigger.tenantId || !await dependencies.authorization.authorize({ actor, operation, tenantId: trigger.tenantId, propertyIds: trigger.scope.propertyIds, ...(sourceCapability ? { sourceCapability } : {}) })) throw new AutomationTriggerError(operation === "manual-trigger" ? "TRIGGER_MANUAL_REQUEST_UNAUTHORIZED" : "TRIGGER_ACCESS_DENIED", "Trigger access is denied.");
  }
  async function processCandidate(candidate: Candidate): Promise<TriggerResult<Readonly<{ occurrence: TriggerOccurrence; runRequest?: AutomationRunRequest }>>> {
    try {
      if (!dependencies.enabled()) throw new AutomationTriggerError("SCHEDULER_DEGRADED", "Automation trigger processing is disabled by the kill switch.");
      const stored = await dependencies.automations.get(candidate.trigger.tenantId, candidate.trigger.automationId);
      if (!stored) throw new AutomationTriggerError("AUTOMATION_NOT_FOUND", "Automation was not found.");
      const since = new Date(Date.parse(candidate.detectedAt) - 3_600_000).toISOString();
      const tenantCount = await dependencies.occurrences.countAccepted({ tenantId: candidate.trigger.tenantId, since });
      const automationCount = await dependencies.occurrences.countAccepted({ tenantId: candidate.trigger.tenantId, automationId: candidate.trigger.automationId, since });
      const eligibility = evaluateTriggerEligibility({ definition: stored.definition, version: stored.current, trigger: candidate.trigger, occurredAt: candidate.occurredAt, sourceAuthorized: candidate.sourceAuthorized, sourceCurrent: candidate.sourceCurrent, conditionMatched: candidate.conditionMatched, recursionDepth: candidate.causationDepth, maximumRecursionDepth: Math.min(dependencies.limits.maximumRecursionDepth, stored.current.configuration.execution.maxChainDepth), cycleDetected: candidate.causationId === candidate.trigger.automationId || candidate.correlationId === candidate.trigger.automationId, fanOutCount: automationCount, maximumFanOut: Math.min(dependencies.limits.maximumFanOut, stored.current.configuration.execution.maxFanOut) });
      const limited = tenantCount >= dependencies.limits.maximumTenantRequestsPerHour;
      const reasonCode = candidate.forcedNonRun?.reasonCode ?? (limited ? "TRIGGER_FANOUT_LIMIT_EXCEEDED" : eligibility.reasonCode);
      const identity = occurrenceIdentity({ tenantId: candidate.trigger.tenantId, automationId: candidate.trigger.automationId, automationDefinitionVersion: candidate.trigger.automationDefinitionVersion, triggerId: candidate.trigger.id, triggerKind: candidate.trigger.kind, sourceIdentity: candidate.sourceIdentity, ...(candidate.targetKey ? { targetKey: candidate.targetKey } : {}), eligibilityPolicyVersion: candidate.trigger.eligibilityPolicyVersion });
      const accepted = eligibility.eligible && !limited && !candidate.forcedNonRun;
      const occurrence: TriggerOccurrence = Object.freeze({ id: identity, occurrenceKey: identity, tenantId: candidate.trigger.tenantId, automationId: candidate.trigger.automationId, automationDefinitionVersion: candidate.trigger.automationDefinitionVersion, triggerId: candidate.trigger.id, triggerKind: candidate.trigger.kind, targetKey: candidate.targetKey ?? "global", occurredAt: candidate.occurredAt, detectedAt: candidate.detectedAt, disposition: candidate.forcedNonRun?.disposition ?? (accepted ? candidate.backfilled ? "BACKFILLED" : "ACCEPTED" : reasonCode === "TRIGGER_SOURCE_STALE" ? "DEFERRED" : "INELIGIBLE"), reasonCode, correlationId: candidate.correlationId, ...(candidate.causationId ? { causationId: candidate.causationId } : {}), sourceIdentity: candidate.sourceIdentity, safeContext: Object.freeze({ ...candidate.safeContext }), eligibilityPolicyVersion: candidate.trigger.eligibilityPolicyVersion, backfilled: candidate.backfilled ?? false, version: 1 });
      const runRequest = accepted ? runRequestFor(dependencies.id(), occurrence, candidate.trigger, stored.current.configuration.approval.mode, candidate.detectedAt) : undefined;
      const activity = [event(dependencies.id(), candidate, occurrence, accepted ? "occurrence-accepted" : "occurrence-suppressed", reasonCode), ...(runRequest ? [event(dependencies.id(), candidate, occurrence, "run-request-created", "REQUESTED")] : [])];
      const persisted = await dependencies.occurrences.accept({ occurrence, ...(runRequest ? { runRequest } : {}), activity });
      dependencies.telemetry?.emit({ name: persisted.created ? runRequest ? "automation_run_request_created" : "automation_occurrence_suppressed" : "automation_occurrence_deduplicated", tenantId: candidate.trigger.tenantId, triggerKind: candidate.trigger.kind, correlationId: candidate.correlationId, classification: persisted.created ? reasonCode : "TRIGGER_OCCURRENCE_DUPLICATE" });
      return { ok: true, value: Object.freeze({ occurrence: persisted.occurrence, ...(persisted.runRequest ? { runRequest: persisted.runRequest } : {}) }) };
    } catch (error) { return failure(error); }
  }
  return Object.freeze({
    async processScheduleSlot(input: Readonly<{ actor: SchedulerActor; trigger: AutomationTriggerDefinition; slot: ScheduleOccurrenceSlot; correlationId: string; backfilled?: boolean }>) {
      try { await requireAuthorized(input.actor, "scheduler", input.trigger); return await processCandidate({ trigger: input.trigger, sourceIdentity: input.slot.slotKey, occurredAt: input.slot.occurredAt, detectedAt: dependencies.clock(), correlationId: input.correlationId, causationDepth: 0, safeContext: { localDateTime: input.slot.localDateTime, timeZone: input.slot.timeZone, utcOffsetMinutes: input.slot.utcOffsetMinutes, adjustment: input.slot.adjustment, timePolicyVersion: input.slot.timePolicyVersion }, sourceAuthorized: true, sourceCurrent: true, conditionMatched: true, backfilled: input.backfilled, actorId: input.actor.actorId }); } catch (error) { return failure(error); }
    },
    async scanDueSchedules(input: Readonly<{ actor: SchedulerActor; tenantId: string; partitionKey: string; through: string; correlationId: string; maximumCount: number }>): Promise<TriggerResult<Readonly<{ processed: number; accepted: number; checkpoint: string }>>> {
      const now = dependencies.clock();
      const through = new Date(
        Math.max(Date.parse(input.through), Date.parse(now)),
      ).toISOString();
      let lease: SchedulerLease | null = null;
      try {
        if (!dependencies.enabled()) throw new AutomationTriggerError("SCHEDULER_DEGRADED", "Scheduling is disabled by the kill switch.");
        lease = await dependencies.coordination.claimLease({ tenantId: input.tenantId, partitionKey: input.partitionKey, ownerId: input.actor.actorId, now, durationMs: dependencies.limits.leaseDurationMs });
        if (!lease) throw new AutomationTriggerError("SCHEDULER_LEASE_UNAVAILABLE", "The scheduler partition is already leased.");
        const checkpoint = await dependencies.coordination.getCheckpoint(input.partitionKey); const from = checkpoint?.watermark ?? now;
        const triggers = await dependencies.definitions.listScheduleTriggers(input.tenantId, from, through); let processed = 0, accepted = 0;
        for (const trigger of triggers) {
          await requireAuthorized(input.actor, "scheduler", trigger);
          const slots = calculateScheduleOccurrences({ trigger, from, through, maximumCount: Math.max(1, input.maximumCount - processed) });
          const missed = slots.filter((slot) => Date.parse(slot.occurredAt) < Date.parse(now));
          const ordinary = slots.filter((slot) => Date.parse(slot.occurredAt) >= Date.parse(now));
          const candidates: Candidate[] = [];
          if (missed.length && trigger.misfirePolicy === "FIRE_ONCE_NOW") candidates.push({ trigger, sourceIdentity: `misfire-once:${missed[0].slotKey}:${missed.at(-1)!.slotKey}`, occurredAt: now, detectedAt: now, correlationId: input.correlationId, causationDepth: 0, safeContext: { misfirePolicy: "FIRE_ONCE_NOW", collapsedSlotCount: missed.length }, sourceAuthorized: true, sourceCurrent: true, conditionMatched: true, actorId: input.actor.actorId });
          else for (const slot of missed) candidates.push({ trigger, sourceIdentity: slot.slotKey, occurredAt: slot.occurredAt, detectedAt: now, correlationId: input.correlationId, causationDepth: 0, safeContext: { localDateTime: slot.localDateTime, timeZone: slot.timeZone, adjustment: slot.adjustment, misfirePolicy: trigger.misfirePolicy }, sourceAuthorized: true, sourceCurrent: true, conditionMatched: true, ...(trigger.misfirePolicy === "BACKFILL_BOUNDED" ? { backfilled: true } : { forcedNonRun: { disposition: "MISSED" as const, reasonCode: "SCHEDULE_MISFIRE_SKIPPED" } }), actorId: input.actor.actorId });
          for (const slot of ordinary) candidates.push({ trigger, sourceIdentity: slot.slotKey, occurredAt: slot.occurredAt, detectedAt: now, correlationId: input.correlationId, causationDepth: 0, safeContext: { localDateTime: slot.localDateTime, timeZone: slot.timeZone, adjustment: slot.adjustment }, sourceAuthorized: true, sourceCurrent: true, conditionMatched: true, actorId: input.actor.actorId });
          for (const candidate of candidates) { const result = await processCandidate(candidate); processed += 1; if (result.ok && result.value.runRequest) accepted += 1; if (processed >= input.maximumCount) break; }
          if (processed >= input.maximumCount) break;
        }
        await dependencies.coordination.advanceCheckpoint({ partitionKey: input.partitionKey, expectedVersion: checkpoint?.version ?? 0, watermark: through, lease });
        await dependencies.coordination.release({ lease, now: dependencies.clock() });
        return { ok: true, value: Object.freeze({ processed, accepted, checkpoint: through }) };
      } catch (error) { if (lease) await dependencies.coordination.release({ lease, now: dependencies.clock() }).catch(() => undefined); return failure(error); }
    },
    async ingestDomainEvent(input: Readonly<{ actor: SchedulerActor; event: CanonicalDomainEvent; correlationId?: string }>): Promise<TriggerResult<Readonly<{ evaluated: number; accepted: number }>>> {
      try {
        const event = validateDomainEvent(input.event, { expectedTenantId: input.actor.tenantId, acceptedSchemaVersions: ["au001-event.v1"], maximumPayloadBytes: dependencies.limits.maximumEventPayloadBytes, maximumLatenessMs: dependencies.limits.maximumEventLatenessMs, now: dependencies.clock() });
        const triggers = await dependencies.definitions.listEventTriggers(event.tenantId, event.eventType);
        if (triggers.length > dependencies.limits.maximumFanOut) throw new AutomationTriggerError("TRIGGER_FANOUT_LIMIT_EXCEEDED", "The event matched too many automations.");
        let accepted = 0;
        for (const trigger of triggers) {
          await requireAuthorized(input.actor, "scheduler", trigger, event.sourceCapability);
          const configured = trigger.configuration as Readonly<Record<string, unknown>>; const conditionMatched = configured.eventType === event.eventType;
          const result = await processCandidate({ trigger, sourceIdentity: `event:${event.id}`, occurredAt: event.occurredAt, detectedAt: dependencies.clock(), correlationId: input.correlationId ?? event.correlationId, ...(event.causationId ? { causationId: event.causationId } : {}), causationDepth: event.causationDepth, safeContext: { eventId: event.id, eventType: event.eventType, sourceCapability: event.sourceCapability }, sourceAuthorized: true, sourceCurrent: true, conditionMatched, actorId: input.actor.actorId });
          if (result.ok && result.value.runRequest) accepted += 1;
        }
        return { ok: true, value: Object.freeze({ evaluated: triggers.length, accepted }) };
      } catch (error) { return failure(error); }
    },
    async evaluateState(input: Readonly<{ actor: SchedulerActor; trigger: AutomationTriggerDefinition; previous?: string; current: string; previousVersion?: number; currentVersion: number; observedAt: string; sourceIdentity: string; correlationId: string; sourceAuthorized: boolean }>) {
      try { await requireAuthorized(input.actor, "scheduler", input.trigger); const evaluated = evaluateStateChange(input.trigger.configuration as StateChangeSpecification, input); return await processCandidate({ trigger: input.trigger, sourceIdentity: input.sourceIdentity, occurredAt: input.observedAt, detectedAt: dependencies.clock(), correlationId: input.correlationId, causationDepth: 0, safeContext: { currentVersion: input.currentVersion, reasonCode: evaluated.reasonCode }, sourceAuthorized: input.sourceAuthorized, sourceCurrent: true, conditionMatched: evaluated.matched, actorId: input.actor.actorId }); } catch (error) { return failure(error); }
    },
    async evaluateThreshold(input: Readonly<{ actor: SchedulerActor; trigger: AutomationTriggerDefinition; previous?: number; current?: number; unit: string; observedAt: string; sourceIdentity: string; correlationId: string; sourceAuthorized: boolean; lastAcceptedAt?: string; armed: boolean }>) {
      try { await requireAuthorized(input.actor, "scheduler", input.trigger); const evaluated = evaluateThreshold(input.trigger.configuration as ThresholdSpecification, { previous: input.previous, current: input.current, unit: input.unit, observedAt: input.observedAt, now: dependencies.clock(), lastAcceptedAt: input.lastAcceptedAt, armed: input.armed }); return await processCandidate({ trigger: input.trigger, sourceIdentity: input.sourceIdentity, occurredAt: input.observedAt, detectedAt: dependencies.clock(), correlationId: input.correlationId, causationDepth: 0, safeContext: { reasonCode: evaluated.reasonCode, armed: evaluated.armed }, sourceAuthorized: input.sourceAuthorized, sourceCurrent: evaluated.reasonCode !== "TRIGGER_SOURCE_STALE", conditionMatched: evaluated.matched, actorId: input.actor.actorId }); } catch (error) { return failure(error); }
    },
    async requestManualTrigger(input: Readonly<{ actor: AutomationActor; tenantId: string; triggerId: string; expectedAutomationVersion: number; idempotencyKey: string; correlationId: string; parameters?: Readonly<Record<string, string | number | boolean | null>> }>) {
      try {
        if (!input.idempotencyKey.trim()) throw new AutomationTriggerError("TRIGGER_IDEMPOTENCY_CONFLICT", "A stable idempotency key is required.");
        if (JSON.stringify(input.parameters ?? {}).length > 4096) throw new AutomationTriggerError("TRIGGER_EVENT_INVALID", "Manual parameters exceed the safe bound.");
        const trigger = await dependencies.definitions.getTrigger(input.tenantId, input.triggerId); if (!trigger) throw new AutomationTriggerError("TRIGGER_NOT_FOUND", "Trigger was not found.");
        if (trigger.kind !== "MANUAL") throw new AutomationTriggerError("TRIGGER_KIND_UNSUPPORTED", "This trigger is not manual."); await requireAuthorized(input.actor, "manual-trigger", trigger);
        if (trigger.automationDefinitionVersion !== input.expectedAutomationVersion) return { ok: false, code: "AUTOMATION_VERSION_CONFLICT", message: "Automation changed after it was loaded.", currentVersion: trigger.automationDefinitionVersion, submittedInput: Object.freeze({ ...input }) } as const;
        return await processCandidate({ trigger, sourceIdentity: `manual:${input.idempotencyKey}`, occurredAt: dependencies.clock(), detectedAt: dependencies.clock(), correlationId: input.correlationId, causationDepth: 0, safeContext: { manualRequestId: input.idempotencyKey }, sourceAuthorized: true, sourceCurrent: true, conditionMatched: true, actorId: input.actor.actorId });
      } catch (error) { return failure(error, input); }
    },
    async pauseTrigger(input: Readonly<{ actor: AutomationActor; tenantId: string; triggerId: string; expectedVersion: number; reason: string; correlationId: string }>) { return changeEnabled(input, false, "trigger-paused"); },
    async resumeTrigger(input: Readonly<{ actor: AutomationActor; tenantId: string; triggerId: string; expectedVersion: number; reason: string; correlationId: string }>) { return changeEnabled(input, true, "trigger-resumed"); },
    async previewMissed(input: Readonly<{ actor: AutomationActor; tenantId: string; triggerId: string; from: string; through: string; maximumCount: number }>) {
      try { const trigger = await dependencies.definitions.getTrigger(input.tenantId, input.triggerId); if (!trigger) throw new AutomationTriggerError("TRIGGER_NOT_FOUND", "Trigger was not found."); await requireAuthorized(input.actor, "preview-missed", trigger); const slots = calculateScheduleOccurrences({ trigger, from: input.from, through: input.through, maximumCount: Math.min(input.maximumCount, trigger.backfillPolicy.maximumCount, dependencies.limits.maximumBackfillCount) }); return { ok: true, value: Object.freeze({ policy: trigger.misfirePolicy, count: slots.length, slots }) } as const; } catch (error) { return failure(error); }
    },
    async requestBackfill(input: Readonly<{ actor: AutomationActor; tenantId: string; triggerId: string; from: string; through: string; maximumCount: number; idempotencyKey: string; correlationId: string; reason: string }>) {
      try {
        const trigger = await dependencies.definitions.getTrigger(input.tenantId, input.triggerId); if (!trigger) throw new AutomationTriggerError("TRIGGER_NOT_FOUND", "Trigger was not found."); await requireAuthorized(input.actor, "backfill", trigger);
        if (!input.reason.trim() || !input.idempotencyKey.trim()) throw new AutomationTriggerError("BACKFILL_NOT_ALLOWED", "Backfill reason and idempotency key are required.");
        const limit = Math.min(trigger.backfillPolicy.maximumCount, dependencies.limits.maximumBackfillCount); if (input.maximumCount < 1 || input.maximumCount > limit || Date.parse(input.through) < Date.parse(input.from) || Date.parse(input.through) - Date.parse(input.from) > trigger.backfillPolicy.maximumAgeMs) throw new AutomationTriggerError("BACKFILL_LIMIT_EXCEEDED", "The requested backfill exceeds its bounded policy.");
        const existing = await dependencies.backfills.getByIdempotencyKey(input.tenantId, input.idempotencyKey); if (existing) return { ok: true, value: existing } as const;
        const job: BackfillJob = Object.freeze({ id: dependencies.id(), tenantId: input.tenantId, triggerId: input.triggerId, automationDefinitionVersion: trigger.automationDefinitionVersion, from: input.from, through: input.through, maximumCount: input.maximumCount, status: "PENDING", processedCount: 0, idempotencyKey: input.idempotencyKey, reason: input.reason.trim(), requestedBy: input.actor.actorId, correlationId: input.correlationId, createdAt: dependencies.clock(), version: 1 });
        return { ok: true, value: await dependencies.backfills.save(job) } as const;
      } catch (error) { return failure(error, input); }
    },
    async processBackfillBatch(input: Readonly<{ actor: SchedulerActor; tenantId: string; jobId: string }>) {
      try {
        const job = await dependencies.backfills.get(input.tenantId, input.jobId); if (!job) throw new AutomationTriggerError("BACKFILL_NOT_ALLOWED", "Backfill job was not found."); if (["CANCELLED", "COMPLETED"].includes(job.status)) return { ok: true, value: job } as const;
        const trigger = await dependencies.definitions.getTrigger(input.tenantId, job.triggerId); if (!trigger || trigger.automationDefinitionVersion !== job.automationDefinitionVersion) throw new AutomationTriggerError("AUTOMATION_VERSION_CONFLICT", "The backfill definition version is no longer available."); await requireAuthorized(input.actor, "scheduler", trigger);
        const slots = calculateScheduleOccurrences({ trigger, from: job.from, through: job.through, maximumCount: job.maximumCount }); let processed = job.processedCount;
        for (const slot of slots.slice(job.processedCount)) { await processCandidate({ trigger, sourceIdentity: slot.slotKey, occurredAt: slot.occurredAt, detectedAt: dependencies.clock(), correlationId: job.correlationId, causationDepth: 0, safeContext: { backfillJobId: job.id, localDateTime: slot.localDateTime, timeZone: slot.timeZone }, sourceAuthorized: true, sourceCurrent: true, conditionMatched: true, backfilled: true, actorId: input.actor.actorId }); processed += 1; }
        const completed = Object.freeze({ ...job, processedCount: processed, status: "COMPLETED" as const, version: job.version + 1 }); return { ok: true, value: await dependencies.backfills.save(completed, job.version) } as const;
      } catch (error) { return failure(error); }
    },
    async cancelBackfill(input: Readonly<{ actor: AutomationActor; tenantId: string; jobId: string; expectedVersion: number; reason: string }>) {
      try { const job = await dependencies.backfills.get(input.tenantId, input.jobId); if (!job) throw new AutomationTriggerError("BACKFILL_NOT_ALLOWED", "Backfill job was not found."); const trigger = await dependencies.definitions.getTrigger(input.tenantId, job.triggerId); if (!trigger) throw new AutomationTriggerError("TRIGGER_NOT_FOUND", "Trigger was not found."); await requireAuthorized(input.actor, "cancel-backfill", trigger); if (!input.reason.trim()) throw new AutomationTriggerError("BACKFILL_NOT_ALLOWED", "Cancellation reason is required."); if (job.version !== input.expectedVersion) return { ok: false, code: "CONCURRENT_MODIFICATION", message: "Backfill changed after it was loaded.", currentVersion: job.version } as const; const cancelled = Object.freeze({ ...job, status: "CANCELLED" as const, version: job.version + 1 }); return { ok: true, value: await dependencies.backfills.save(cancelled, job.version) } as const; } catch (error) { return failure(error); }
    },
    async readTriggerHealth(input: Readonly<{ actor: AutomationActor; tenantId: string; triggerId: string }>): Promise<TriggerResult<TriggerHealth>> {
      try { const trigger = await dependencies.definitions.getTrigger(input.tenantId, input.triggerId); if (!trigger) throw new AutomationTriggerError("TRIGGER_NOT_FOUND", "Trigger was not found."); await requireAuthorized(input.actor, "view", trigger); const recent = await dependencies.occurrences.listRecent(input.tenantId, input.triggerId, 1); const now = dependencies.clock(); const classification = !dependencies.enabled() ? "DEGRADED" : !trigger.enabled ? "PAUSED" : recent[0]?.disposition === "FAILED_SAFE" ? "FAILED" : recent[0]?.disposition === "DEFERRED" ? "STALE_SOURCE" : "HEALTHY"; return { ok: true, value: Object.freeze({ triggerId: trigger.id, classification, reasonCode: classification === "HEALTHY" ? "TRIGGER_HEALTHY" : `TRIGGER_${classification}`, evaluatedAt: now, ...(recent[0] ? { lastOccurrenceAt: recent[0].occurredAt } : {}) }) }; } catch (error) { return failure(error); }
    },
  });

  async function changeEnabled(input: Readonly<{ actor: AutomationActor; tenantId: string; triggerId: string; expectedVersion: number; reason: string; correlationId: string }>, enabled: boolean, eventType: string) {
    try { const trigger = await dependencies.definitions.getTrigger(input.tenantId, input.triggerId); if (!trigger) throw new AutomationTriggerError("TRIGGER_NOT_FOUND", "Trigger was not found."); await requireAuthorized(input.actor, enabled ? "resume" : "pause", trigger); if (!input.reason.trim()) throw new AutomationTriggerError("TRIGGER_CONFIGURATION_INVALID", "A reason is required."); const now = dependencies.clock(); const activity: TriggerActivity = Object.freeze({ id: dependencies.id(), tenantId: input.tenantId, automationId: trigger.automationId, triggerId: trigger.id, eventType, actorId: input.actor.actorId, occurredAt: now, correlationId: input.correlationId, aggregateVersion: trigger.version + 1, safeMetadata: Object.freeze({ enabled }) }); return { ok: true, value: await dependencies.definitions.updateEnabled({ tenantId: input.tenantId, triggerId: input.triggerId, expectedVersion: input.expectedVersion, enabled, actorId: input.actor.actorId, occurredAt: now, reason: input.reason, activity }) } as const; } catch (error) { return failure(error, input); }
  }
}

function runRequestFor(id: string, occurrence: TriggerOccurrence, trigger: AutomationTriggerDefinition, approvalClassification: string, requestedAt: string): AutomationRunRequest { return Object.freeze({ id, idempotencyKey: `run:${occurrence.occurrenceKey}`, tenantId: occurrence.tenantId, scope: trigger.scope, automationId: occurrence.automationId, automationDefinitionVersion: occurrence.automationDefinitionVersion, triggerId: occurrence.triggerId, triggerKind: occurrence.triggerKind, occurrenceId: occurrence.id, requestedAt, occurredAt: occurrence.occurredAt, eligibilityPolicyVersion: occurrence.eligibilityPolicyVersion, approvalClassification, correlationId: occurrence.correlationId, ...(occurrence.causationId ? { causationId: occurrence.causationId } : {}), safeTriggerContext: occurrence.safeContext, status: "REQUESTED", version: 1 }); }
function event(id: string, candidate: Candidate, occurrence: TriggerOccurrence, eventType: string, reasonCode: string): TriggerActivity { return Object.freeze({ id, tenantId: occurrence.tenantId, automationId: occurrence.automationId, triggerId: occurrence.triggerId, occurrenceId: occurrence.id, eventType, actorId: candidate.actorId, occurredAt: candidate.detectedAt, correlationId: candidate.correlationId, ...(candidate.causationId ? { causationId: candidate.causationId } : {}), aggregateVersion: occurrence.version, safeMetadata: Object.freeze({ reasonCode, triggerKind: occurrence.triggerKind, backfilled: occurrence.backfilled }) }); }
function failure(error: unknown, submittedInput?: object): TriggerResult<never> { if (error instanceof AutomationTriggerError) return Object.freeze({ ok: false, code: error.code as TriggerFailureCode, message: error.message, ...(submittedInput ? { submittedInput: Object.freeze({ ...submittedInput }) } : {}) }); return Object.freeze({ ok: false, code: "RUN_REQUEST_CREATION_FAILED", message: "Trigger processing failed safely.", ...(submittedInput ? { submittedInput: Object.freeze({ ...submittedInput }) } : {}) }); }
