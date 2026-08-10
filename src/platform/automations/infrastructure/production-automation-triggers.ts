import { createAutomationTriggerService, type SchedulerActor, type TriggerAuthorizationPort, type TriggerTelemetry } from "../application/automation-trigger-processing";
import type { AutomationActor } from "../domain/automation-definition";
import { SupabaseAutomationFoundationRepository } from "./supabase-automation-foundation-repository";
import { SupabaseAutomationTriggerRepository, SupabaseSchedulerCoordinationRepository, type TriggerSupabaseClient } from "./supabase-automation-trigger-repository";

export type AutomationTriggerFeatureFlags = Readonly<{ automationFoundationEnabled: boolean; triggerProcessingEnabled: boolean; schedulerKillSwitch: boolean }>;

/**
 * Inert AU-001B composition. No route, cron, event subscriber, or worker is
 * registered by this factory. A caller must supply an authenticated user client
 * or a least-privilege scheduler client and pass the rollout flags explicitly.
 * There is deliberately no owning-capability command dispatcher dependency.
 */
export function createProductionAutomationTriggers(input: Readonly<{
  client: TriggerSupabaseClient;
  actor: AutomationActor | SchedulerActor;
  flags: AutomationTriggerFeatureFlags;
  clock?: () => string;
  id?: () => string;
  telemetry?: TriggerTelemetry;
}>) {
  if (!input.actor.active) throw new Error("Active automation trigger actor required.");
  const repository = new SupabaseAutomationTriggerRepository(input.client);
  const coordination = new SupabaseSchedulerCoordinationRepository(input.client);
  const automations = new SupabaseAutomationFoundationRepository(input.client);
  const authorization: TriggerAuthorizationPort = Object.freeze({
    async authorize(request: Parameters<TriggerAuthorizationPort["authorize"]>[0]) {
      if (!input.flags.automationFoundationEnabled || request.actor.actorId !== input.actor.actorId || request.actor.tenantId !== input.actor.tenantId || !request.actor.active) return false;
      if (request.actor.role === "service") return "grants" in request.actor && request.actor.grants.includes(request.operation) && request.operation === "scheduler";
      if (request.actor.role === "viewer" || request.actor.role === "contributor") return request.operation === "view";
      if (request.actor.role === "operator" && request.propertyIds.some((propertyId: string) => !request.actor.propertyIds.includes(propertyId))) return false;
      return true;
    },
  });
  return createAutomationTriggerService({
    definitions: repository, automations, occurrences: repository, coordination, backfills: repository, authorization,
    clock: input.clock ?? (() => new Date().toISOString()), id: input.id ?? (() => crypto.randomUUID()),
    ...(input.telemetry ? { telemetry: input.telemetry } : {}),
    enabled: () => input.flags.automationFoundationEnabled && input.flags.triggerProcessingEnabled && !input.flags.schedulerKillSwitch,
    limits: Object.freeze({ maximumEventPayloadBytes: 16_384, maximumEventLatenessMs: 86_400_000, maximumFanOut: 100, maximumTenantRequestsPerHour: 1_000, maximumRecursionDepth: 5, maximumBackfillCount: 100, leaseDurationMs: 60_000 }),
  });
}
