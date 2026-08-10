import type { AutomationActor } from "../domain/automation-definition";
import { calculateScheduleOccurrences, type AutomationRunRequest, type AutomationTriggerDefinition, type TriggerOccurrence } from "../domain/automation-triggering";
import type { BackfillJob, TriggerHealth, TriggerOperation } from "./automation-trigger-processing";

export type TriggerDetailProjection = Readonly<{
  trigger: AutomationTriggerDefinition;
  health: TriggerHealth;
  nextOccurrence?: Readonly<{ occurredAt: string; localDateTime: string; timeZone: string }>;
  recentOccurrences: readonly TriggerOccurrence[];
  recentRunRequests: readonly AutomationRunRequest[];
  activeBackfills: readonly BackfillJob[];
  validCommands: readonly TriggerOperation[];
  generatedAt: string;
}>;

export function projectTriggerDetail(input: Readonly<{ actor: AutomationActor; trigger: AutomationTriggerDefinition; occurrences: readonly TriggerOccurrence[]; runRequests: readonly AutomationRunRequest[]; backfills: readonly BackfillJob[]; health: TriggerHealth; now: string; mayAdministerScheduler: boolean }>): TriggerDetailProjection {
  const visibleOccurrences = input.occurrences.filter((occurrence) => occurrence.tenantId === input.actor.tenantId && occurrence.triggerId === input.trigger.id);
  const visibleIds = new Set(visibleOccurrences.map(({ id }) => id));
  const next = ["SCHEDULE_CALENDAR", "SCHEDULE_INTERVAL"].includes(input.trigger.kind) && input.trigger.enabled ? calculateScheduleOccurrences({ trigger: input.trigger, from: input.now, through: new Date(Date.parse(input.now) + 370 * 86_400_000).toISOString(), maximumCount: 1 })[0] : undefined;
  return Object.freeze({
    trigger: input.trigger, health: input.health,
    ...(next ? { nextOccurrence: Object.freeze({ occurredAt: next.occurredAt, localDateTime: next.localDateTime, timeZone: next.timeZone }) } : {}),
    recentOccurrences: Object.freeze(visibleOccurrences.slice().sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))),
    recentRunRequests: Object.freeze(input.runRequests.filter((request) => visibleIds.has(request.occurrenceId)).slice().sort((a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt))),
    activeBackfills: Object.freeze(input.backfills.filter((job) => job.tenantId === input.actor.tenantId && job.triggerId === input.trigger.id && ["PENDING", "PROCESSING"].includes(job.status))),
    validCommands: validCommands(input.actor, input.trigger, input.mayAdministerScheduler), generatedAt: input.now,
  });
}

export function classifyTriggerHealth(input: Readonly<{ trigger: AutomationTriggerDefinition; now: string; lastOccurrence?: TriggerOccurrence; activeBackfill?: boolean; schedulerEnabled: boolean; sourceAvailable: boolean; delayToleranceMs: number }>): TriggerHealth {
  const classification = !input.schedulerEnabled ? "DEGRADED" : !input.trigger.enabled ? "PAUSED" : input.activeBackfill ? "BACKFILLING" : !input.sourceAvailable ? "UNAVAILABLE" : input.lastOccurrence?.disposition === "FAILED_SAFE" ? "FAILED" : input.lastOccurrence?.disposition === "DEFERRED" ? "STALE_SOURCE" : input.lastOccurrence && Date.parse(input.now) - Date.parse(input.lastOccurrence.detectedAt) > input.delayToleranceMs ? "DELAYED" : "HEALTHY";
  return Object.freeze({ triggerId: input.trigger.id, classification, reasonCode: `TRIGGER_${classification}`, evaluatedAt: input.now, ...(input.lastOccurrence ? { lastOccurrenceAt: input.lastOccurrence.occurredAt } : {}) });
}

function validCommands(actor: AutomationActor, trigger: AutomationTriggerDefinition, scheduler: boolean): readonly TriggerOperation[] {
  if (!actor.active || actor.tenantId !== trigger.tenantId) return Object.freeze([]);
  const commands: TriggerOperation[] = ["view", "test"];
  if (["owner", "administrator", "operator"].includes(actor.role)) {
    commands.push(trigger.enabled ? "pause" : "resume"); if (trigger.kind === "MANUAL" && trigger.enabled) commands.push("manual-trigger");
    if (["SCHEDULE_CALENDAR", "SCHEDULE_INTERVAL"].includes(trigger.kind)) commands.push("preview-missed", "backfill", "cancel-backfill");
  }
  if (scheduler && ["owner", "administrator"].includes(actor.role)) commands.push("scheduler");
  return Object.freeze(commands);
}
