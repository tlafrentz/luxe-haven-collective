import { createAutomationFoundationService, type AutomationAuthorizationPort, type AutomationFoundationTelemetry } from "../application/automation-foundation";
import type { AutomationActor } from "../domain/automation-definition";
import { SupabaseAutomationFoundationRepository, type AutomationSupabaseClient } from "./supabase-automation-foundation-repository";

/**
 * Local-only AU-001A composition. No route, scheduler, worker, trigger source, or
 * command invoker calls this factory. Production activation requires a later,
 * separately approved rollout slice.
 */
export function createProductionAutomationFoundation(input: Readonly<{ client: AutomationSupabaseClient; actor: AutomationActor; clock?: () => string; id?: () => string; telemetry?: AutomationFoundationTelemetry }>) {
  const repository = new SupabaseAutomationFoundationRepository(input.client);
  const authorization: AutomationAuthorizationPort = Object.freeze({ async authorize(request: Parameters<AutomationAuthorizationPort["authorize"]>[0]) { return request.actor.actorId === input.actor.actorId && request.actor.tenantId === input.actor.tenantId && request.actor.active; } });
  return createAutomationFoundationService({ repository, authorization, clock: input.clock ?? (() => new Date().toISOString()), id: input.id ?? (() => crypto.randomUUID()), ...(input.telemetry ? { telemetry: input.telemetry } : {}) });
}
