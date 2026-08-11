import { createGovernedExecutionService, type AutomationApprovalAuthority, type AutomationCommandPort, type AutomationDefinitionExecutionReader, type AutomationPolicyEvaluator, type GovernedExecutionRepository, type GovernedExecutionTelemetry } from "../application/automation-governed-execution";
import type { AutomationRetryPolicy, AutomationServiceActor } from "../domain/automation-governed-execution";

export type GovernedExecutionFeatureFlags = Readonly<{ automationFoundationEnabled: boolean; governedExecutionEnabled: boolean; dispatchEnabled: boolean; globalKillSwitch: boolean }>;

/**
 * Server-only AU-001C composition. Construction does not register a worker,
 * subscriber, cron, route, or dispatch loop. All dispatch stays fail-closed
 * until every rollout flag is explicitly enabled and the kill switch is off.
 */
export function createProductionGovernedExecution(input: Readonly<{
  repository: GovernedExecutionRepository;
  definitions: AutomationDefinitionExecutionReader;
  policy: AutomationPolicyEvaluator;
  approvalAuthority: AutomationApprovalAuthority;
  ports: readonly AutomationCommandPort[];
  serviceActor: AutomationServiceActor;
  retryPolicy: AutomationRetryPolicy;
  flags: GovernedExecutionFeatureFlags;
  clock?: () => string;
  id?: () => string;
  telemetry?: GovernedExecutionTelemetry;
}>) {
  if (!input.serviceActor.active || input.serviceActor.tenantId.trim() === "" || input.serviceActor.grants.length === 0) throw new Error("A least-privilege active automation service actor is required.");
  if (input.ports.some((port, index) => input.ports.findIndex(({ capability }) => capability === port.capability) !== index)) throw new Error("Owning-capability adapters must be unique.");
  return createGovernedExecutionService({ repository: input.repository, definitions: input.definitions, policy: input.policy, approvalAuthority: input.approvalAuthority, ports: input.ports, serviceActor: input.serviceActor, retryPolicy: input.retryPolicy, clock: input.clock ?? (() => new Date().toISOString()), id: input.id ?? (() => crypto.randomUUID()), ...(input.telemetry ? { telemetry: input.telemetry } : {}), enabled: () => input.flags.automationFoundationEnabled && input.flags.governedExecutionEnabled, dispatchEnabled: () => input.flags.dispatchEnabled, killSwitched: () => input.flags.globalKillSwitch, leaseDurationMs: 60_000 });
}
