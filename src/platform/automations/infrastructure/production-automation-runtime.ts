import { createClient } from "@supabase/supabase-js";
import {
  createAutomationRuntimeProcessor,
  type AutomationRuntimeSummary,
} from "../application/automation-runtime-processor";
import type { SchedulerActor } from "../application/automation-trigger-processing";
import type { AutomationServiceActor } from "../domain/automation-governed-execution";
import { createAutomationCommandAdapterRegistry } from "./automation-command-adapter-registry";
import { createProductionAutomationPolicyEvaluator } from "./production-automation-policy-evaluator";
import { createProductionAutomationTriggers } from "./production-automation-triggers";
import { createProductionExecuteDraftPlanBoundary } from "./production-execute-draft-plan-boundary";
import { createExecuteDraftPlanService } from "./production-execute-draft-plan-service";
import { createProductionGovernedExecution } from "./production-automation-governed-execution";
import { SupabaseAutomationExecutionDefinitionReader } from "./supabase-automation-execution-definition-reader";
import { SupabaseAutomationGovernedExecutionRepository } from "./supabase-automation-governed-execution-repository";
import {
  SupabaseAutomationRunRequestQueue,
  type TriggerSupabaseClient,
} from "./supabase-automation-trigger-repository";
import type { ExecuteSupabaseClient } from "@/platform/actions";

export type ProductionAutomationRuntimeConfig = Readonly<{
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  executeEmail: string;
  executePassword: string;
  executeUserId: string;
  tenantId: string;
  propertyIds: readonly string[];
  definitionIds: readonly string[];
  manualTriggerId: string;
  schedulerActorId: string;
  workerId: string;
  policyVersion: string;
  maximumRequests: number;
  approvalRequired: boolean;
  foundationEnabled: boolean;
  schedulingEnabled: boolean;
  governedExecutionEnabled: boolean;
  dispatchEnabled: boolean;
  globalKillSwitch: boolean;
  workspaceKillSwitch: boolean;
}>;

export function readProductionAutomationRuntimeConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): ProductionAutomationRuntimeConfig {
  const required = (name: string) => {
    const value = env[name]?.trim();
    if (!value) throw new Error(`Automation runtime configuration is incomplete: ${name}.`);
    return value;
  };
  const list = (name: string) => required(name).split(",").map((value) => value.trim()).filter(Boolean);
  const maximumRequests = Number(env.AUTOMATION_PROCESSOR_MAXIMUM_REQUESTS ?? "10");
  if (!Number.isSafeInteger(maximumRequests) || maximumRequests < 1 || maximumRequests > 100)
    throw new Error("Automation runtime request bound is invalid.");
  return Object.freeze({
    supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL"),
    supabaseAnonKey: required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
    executeEmail: required("AUTOMATION_EXECUTE_SERVICE_EMAIL"),
    executePassword: required("AUTOMATION_EXECUTE_SERVICE_PASSWORD"),
    executeUserId: required("AUTOMATION_EXECUTE_SERVICE_USER_ID"),
    tenantId: required("AUTOMATION_COHORT_TENANT_ID"),
    propertyIds: Object.freeze(list("AUTOMATION_COHORT_PROPERTY_IDS")),
    definitionIds: Object.freeze(list("AUTOMATION_COHORT_DEFINITION_IDS")),
    manualTriggerId: required("AUTOMATION_COHORT_MANUAL_TRIGGER_ID"),
    schedulerActorId: required("AUTOMATION_ORCHESTRATOR_ACTOR_ID"),
    workerId: required("AUTOMATION_WORKER_ID"),
    policyVersion: required("AUTOMATION_RUNTIME_POLICY_VERSION"),
    maximumRequests,
    approvalRequired: env.AUTOMATION_RUNTIME_APPROVAL_REQUIRED === "true",
    foundationEnabled: env.AUTOMATION_FOUNDATION_ENABLED === "true",
    schedulingEnabled: env.AUTOMATION_SCHEDULER_EVALUATION_ENABLED === "true",
    governedExecutionEnabled: env.AUTOMATION_GOVERNED_EXECUTION_ENABLED === "true",
    dispatchEnabled: env.AUTOMATION_GOVERNED_DISPATCH_ENABLED === "true",
    globalKillSwitch: env.AUTOMATION_GLOBAL_KILL_SWITCH !== "false",
    workspaceKillSwitch: env.AUTOMATION_WORKSPACE_KILL_SWITCH !== "false",
  });
}

export async function requestProductionManualAutomation(
  correlationId: string,
  idempotencyKey: string,
  config = readProductionAutomationRuntimeConfig(),
) {
  if (typeof window !== "undefined")
    throw new Error("Automation runtime composition is server-only.");
  if (
    !config.foundationEnabled ||
    !config.schedulingEnabled ||
    config.globalKillSwitch ||
    config.workspaceKillSwitch
  )
    throw new Error("AUTOMATION_KILL_SWITCHED");
  if (!idempotencyKey.trim() || idempotencyKey.length > 200)
    throw new Error("AUTOMATION_MANUAL_REQUEST_INVALID");
  const orchestrator = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const actor = Object.freeze({
    actorId: config.schedulerActorId,
    tenantId: config.tenantId,
    role: "operator" as const,
    active: true,
    propertyIds: config.propertyIds,
  });
  const triggers = createProductionAutomationTriggers({
    client: orchestrator as unknown as TriggerSupabaseClient,
    actor,
    flags: {
      automationFoundationEnabled: config.foundationEnabled,
      triggerProcessingEnabled: config.schedulingEnabled,
      schedulerKillSwitch: config.globalKillSwitch || config.workspaceKillSwitch,
    },
  });
  const result = await triggers.requestManualTrigger({
    actor,
    tenantId: config.tenantId,
    triggerId: config.manualTriggerId,
    expectedAutomationVersion: 1,
    idempotencyKey: idempotencyKey.trim(),
    correlationId,
  });
  if (!result.ok) throw new Error(result.code);
  return Object.freeze({
    accepted: Boolean(result.value.runRequest),
    occurrenceId: result.value.occurrence.id,
  });
}

export async function processProductionAutomation(
  correlationId: string,
  config = readProductionAutomationRuntimeConfig(),
): Promise<AutomationRuntimeSummary> {
  if (typeof window !== "undefined")
    throw new Error("Automation runtime composition is server-only.");
  const orchestrator = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const executeClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signIn = await executeClient.auth.signInWithPassword({
    email: config.executeEmail,
    password: config.executePassword,
  });
  if (signIn.error || signIn.data.user?.id !== config.executeUserId)
    throw new Error("AUTOMATION_EXECUTE_IDENTITY_AUTH_FAILED");

  const cohort = Object.freeze({
    workspaceId: config.tenantId,
    propertyIds: config.propertyIds,
    serviceActorId: config.executeUserId,
  });
  const executeService = createExecuteDraftPlanService({
    client: executeClient as unknown as ExecuteSupabaseClient,
    cohort,
    authenticatedUserId: config.executeUserId,
  });
  const boundary = createProductionExecuteDraftPlanBoundary({
    service: executeService,
    cohort,
  });
  const ports = createAutomationCommandAdapterRegistry({ execute: boundary });
  const serviceActor: AutomationServiceActor = Object.freeze({
    actorId: config.executeUserId,
    tenantId: config.tenantId,
    policyId: config.policyVersion,
    active: true,
    grants: Object.freeze([
      Object.freeze({
        capability: "execute",
        commandType: "createDraftPlan",
        propertyIds: config.propertyIds,
      }),
    ]),
  });
  const schedulerActor: SchedulerActor = Object.freeze({
    actorId: config.schedulerActorId,
    tenantId: config.tenantId,
    role: "service",
    active: true,
    grants: Object.freeze(["scheduler" as const]),
    propertyIds: config.propertyIds,
  });
  const triggerClient = orchestrator as unknown as TriggerSupabaseClient,
    definitions = new SupabaseAutomationExecutionDefinitionReader(triggerClient),
    repository = new SupabaseAutomationGovernedExecutionRepository(triggerClient),
    triggers = createProductionAutomationTriggers({
      client: triggerClient,
      actor: schedulerActor,
      flags: {
        automationFoundationEnabled: config.foundationEnabled,
        triggerProcessingEnabled: config.schedulingEnabled,
        schedulerKillSwitch: config.globalKillSwitch || config.workspaceKillSwitch,
      },
    }),
    governed = createProductionGovernedExecution({
      repository,
      definitions,
      policy: createProductionAutomationPolicyEvaluator({
        cohort: {
          tenantId: config.tenantId,
          propertyIds: config.propertyIds,
          definitionIds: config.definitionIds,
          commandTypes: Object.freeze(["createDraftPlan"]),
          dispatchEnabled: config.dispatchEnabled,
          approvalRequired: config.approvalRequired,
          categoricalHalt: config.globalKillSwitch || config.workspaceKillSwitch,
          policyVersion: config.policyVersion,
        },
      }),
      approvalAuthority: { canApprove: async () => false },
      ports,
      serviceActor,
      retryPolicy: {
        version: "au001-runtime-retry.v1",
        maximumAttempts: 3,
        maximumElapsedMs: 300_000,
        initialDelayMs: 1_000,
        maximumDelayMs: 30_000,
        jitterRatio: 0.1,
        retryableClassifications: Object.freeze(["retryable_failure", "known_not_accepted_timeout"]),
      },
      flags: {
        automationFoundationEnabled: config.foundationEnabled,
        governedExecutionEnabled: config.governedExecutionEnabled,
        dispatchEnabled: config.dispatchEnabled,
        globalKillSwitch: config.globalKillSwitch || config.workspaceKillSwitch,
      },
    });
  const processor = createAutomationRuntimeProcessor({
    enabled: () =>
      config.foundationEnabled &&
      config.schedulingEnabled &&
      config.governedExecutionEnabled &&
      !config.globalKillSwitch &&
      !config.workspaceKillSwitch,
    scheduler: triggers,
    requests: new SupabaseAutomationRunRequestQueue(triggerClient),
    runs: repository,
    definitions,
    governed,
    actor: schedulerActor,
    workerId: config.workerId,
    serviceActorPolicyId: config.policyVersion,
    policyVersion: config.policyVersion,
    maximumRequests: config.maximumRequests,
  });
  try {
    return await processor.process(correlationId);
  } finally {
    await executeClient.auth.signOut().catch(() => undefined);
  }
}
