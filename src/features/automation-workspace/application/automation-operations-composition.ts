import { randomUUID } from "node:crypto";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { SupabaseTeamAccessRepository } from "@/features/workspace";
import {
  projectAutomationOperations,
  validateAutomationIntegrations,
  generateAutomationReport,
  exportAutomationReportCsv,
  type AutomationIntegrationHealth,
  type AutomationOperationsProjection,
  type AutomationReportExport,
  type AutomationReportKey,
  type AutomationReportResult,
  type AutomationRun,
  type AutomationRunStep,
} from "@/platform/automations";

export type AutomationOperationsFlags = Readonly<{
  visibility: boolean;
  health: boolean;
  reports: boolean;
  exports: boolean;
  commands: boolean;
  reconciliationWorker: boolean;
  notificationProcessing: boolean;
  killSwitch: boolean;
}>;
export type AutomationOperationsResult = Readonly<
  | {
      ok: true;
      projection: AutomationOperationsProjection;
      flags: AutomationOperationsFlags;
      correlationId: string;
    }
  | { ok: false; code: string; message: string; correlationId: string }
>;

export function automationOperationsFlags(): AutomationOperationsFlags {
  const killSwitch = process.env.AUTOMATION_GLOBAL_KILL_SWITCH === "true";
  return Object.freeze({
    visibility: process.env.AUTOMATION_OPERATIONS_ENABLED === "true",
    health: process.env.AUTOMATION_HEALTH_ENABLED === "true",
    reports: process.env.AUTOMATION_REPORTING_ENABLED === "true",
    exports: process.env.AUTOMATION_EXPORTS_ENABLED === "true",
    commands:
      !killSwitch &&
      process.env.AUTOMATION_OPERATOR_COMMANDS_ENABLED === "true",
    reconciliationWorker:
      !killSwitch &&
      process.env.AUTOMATION_RECONCILIATION_WORKER_ENABLED === "true",
    notificationProcessing:
      !killSwitch &&
      process.env.AUTOMATION_NOTIFICATION_PROCESSING_ENABLED === "true",
    killSwitch,
  });
}

export async function getAutomationOperationsProjection(
  input: Readonly<{
    propertyId?: string;
    from?: string;
    to?: string;
    timeZone?: string;
  }> = {},
): Promise<AutomationOperationsResult> {
  const correlationId = randomUUID(),
    flags = automationOperationsFlags();
  if (!flags.visibility || !flags.health)
    return Object.freeze({
      ok: false,
      code: "AUTOMATION_OPERATIONS_UNAVAILABLE",
      message: "Automation operations are not enabled for this environment.",
      correlationId,
    });
  try {
    const { user, profile } = await requireUser(),
      accessRepository = new SupabaseTeamAccessRepository(),
      access = await accessRepository.resolve(user.id);
    if (!access || access.status !== "active") return denied(correlationId);
    const properties = await accessRepository.properties(access),
      authorized =
        access.propertyAccess.type === "selected"
          ? access.propertyAccess.propertyIds
          : access.propertyAccess.type === "none"
            ? []
            : properties.map(({ id }) => id);
    if (input.propertyId && !authorized.includes(input.propertyId))
      return denied(correlationId);
    const propertyIds = input.propertyId ? [input.propertyId] : authorized,
      client = await createClient();
    const [
      definitionsResult,
      runsResult,
      stepsResult,
      approvalsResult,
      notificationsResult,
    ] = await Promise.all([
      client
        .from("automation_definitions")
        .select("id,status,property_ids,updated_at")
        .eq("workspace_id", access.workspaceId),
      client
        .from("automation_runs")
        .select("*")
        .eq("workspace_id", access.workspaceId),
      client
        .from("automation_run_steps")
        .select("*")
        .eq("workspace_id", access.workspaceId),
      client
        .from("automation_approval_requests")
        .select("id,run_id,status,requested_at,expires_at,version")
        .eq("workspace_id", access.workspaceId),
      client
        .from("execute_notification_outbox")
        .select("id,delivery_status,created_at,updated_at,attempt_count")
        .eq("workspace_id", access.workspaceId)
        .eq("entity_type", "automation"),
    ]);
    const inaccessible = [
      definitionsResult,
      runsResult,
      stepsResult,
      approvalsResult,
      notificationsResult,
    ].filter((result) => result.error).length;
    const runs = rows(runsResult.data)
        .map(mapRun)
        .filter((run) =>
          run.propertyIds.every((id) => propertyIds.includes(id)),
        ),
      runIds = new Set(runs.map(({ id }) => id)),
      steps = rows(stepsResult.data)
        .map(mapStep)
        .filter((step) => runIds.has(step.runId));
    const definitionRows = rows(definitionsResult.data).filter((row) =>
        strings(row.property_ids).every((id) => propertyIds.includes(id)),
      ),
      integrations = automationIntegrationHealth(flags);
    const now = new Date().toISOString(),
      projection = projectAutomationOperations({
        scope: Object.freeze({
          tenantId: access.workspaceId,
          type: input.propertyId ? "property" : "tenant",
          propertyIds: Object.freeze(propertyIds),
          from:
            validInstant(input.from) ??
            new Date(Date.parse(now) - 30 * 86_400_000).toISOString(),
          to: validInstant(input.to) ?? now,
          timeZone: validTimeZone(input.timeZone) ?? "America/Chicago",
          label: input.propertyId
            ? (properties.find(({ id }) => id === input.propertyId)?.name ??
              "Authorized property")
            : `Authorized portfolio · ${propertyIds.length} properties`,
        }),
        source: Object.freeze({
          runs,
          steps,
          approvals: Object.freeze(
            rows(approvalsResult.data)
              .filter((row) => runIds.has(String(row.run_id)))
              .map((row) =>
                Object.freeze({
                  id: String(row.id),
                  runId: String(row.run_id),
                  status: String(row.status),
                  requestedAt: String(row.requested_at),
                  expiresAt: String(row.expires_at),
                  version: Number(row.version),
                }),
              ),
          ),
          notificationIntents: Object.freeze(
            rows(notificationsResult.data).map((row) =>
              Object.freeze({
                id: String(row.id),
                status: String(row.delivery_status),
                createdAt: String(row.created_at),
                ...(row.updated_at
                  ? { updatedAt: String(row.updated_at) }
                  : {}),
                attemptCount: Number(row.attempt_count),
              }),
            ),
          ),
          definitionCount: definitionRows.length,
          activeDefinitionCount: definitionRows.filter(
            (row) => row.status === "active",
          ).length,
          triggerSourceAvailable: !runsResult.error,
          schedulerEnabled:
            process.env.AUTOMATION_SCHEDULER_LEASES_ENABLED === "true",
          reportingAvailable: flags.reports,
          hpmPublishedRunIds: Object.freeze([]),
          generatedFromAt: now,
          restrictedRecordCount: inaccessible,
        }),
        integrations,
        now,
        operationsEnabled:
          process.env.AUTOMATION_GOVERNED_DISPATCH_ENABLED === "true",
        killSwitch: flags.killSwitch,
        operatorAuthorized:
          flags.commands &&
          ["admin", "owner"].includes(profile?.role ?? access.role),
      });
    return Object.freeze({ ok: true, projection, flags, correlationId });
  } catch {
    return Object.freeze({
      ok: false,
      code: "AUTOMATION_HEALTH_SOURCE_UNAVAILABLE",
      message:
        "Automation operational health could not load. No automation state was changed.",
      correlationId,
    });
  }
}

export async function getAuthorizedAutomationReport(
  key: AutomationReportKey,
  input: Readonly<{
    propertyId?: string;
    from?: string;
    to?: string;
    timeZone?: string;
  }> = {},
): Promise<
  Readonly<
    | { ok: true; report: AutomationReportResult; correlationId: string }
    | { ok: false; code: string; message: string; correlationId: string }
  >
> {
  const result = await getAutomationOperationsProjection(input);
  if (!result.ok) return result;
  if (!result.flags.reports)
    return {
      ok: false,
      code: "AUTOMATION_INTEGRATION_UNAVAILABLE",
      message: "Automation reports are disabled.",
      correlationId: result.correlationId,
    };
  return Object.freeze({
    ok: true,
    report: generateAutomationReport({
      key,
      projection: result.projection,
      generatedAt: result.projection.generatedAt,
    }),
    correlationId: result.correlationId,
  });
}
export async function exportAuthorizedAutomationReport(
  key: AutomationReportKey,
  input: Readonly<{
    propertyId?: string;
    from?: string;
    to?: string;
    timeZone?: string;
  }> = {},
): Promise<
  Readonly<
    | { ok: true; export: AutomationReportExport; correlationId: string }
    | { ok: false; code: string; message: string; correlationId: string }
  >
> {
  const flags = automationOperationsFlags();
  if (!flags.exports)
    return {
      ok: false,
      code: "AUTOMATION_EXPORT_FAILED",
      message: "Automation exports are disabled.",
      correlationId: randomUUID(),
    };
  const result = await getAuthorizedAutomationReport(key, input);
  return result.ok
    ? Object.freeze({
        ok: true,
        export: exportAutomationReportCsv(result.report),
        correlationId: result.correlationId,
      })
    : result;
}

function automationIntegrationHealth(
  flags: AutomationOperationsFlags,
): readonly AutomationIntegrationHealth[] {
  const configured = (id: string, env: string, fallbackVersion = "v1") => ({
    configured: Boolean(process.env[env]),
    enabled: process.env[`${env}_ENABLED`] === "true",
    version: process.env[env] ?? fallbackVersion,
  });
  return validateAutomationIntegrations({
    "identity-authorization": {
      configured: true,
      enabled: true,
      version: "workspace-access-v1",
    },
    "hpm-lifecycle": configured(
      "hpm-lifecycle",
      "AUTOMATION_HPM_CONTRACT_VERSION",
      "hpm-source-v1",
    ),
    execute: configured("execute", "AUTOMATION_EXECUTE_CONTRACT_VERSION"),
    decide: configured("decide", "AUTOMATION_DECIDE_CONTRACT_VERSION"),
    "outcome-measurement": configured(
      "outcome-measurement",
      "AUTOMATION_OUTCOME_CONTRACT_VERSION",
    ),
    learning: configured("learning", "AUTOMATION_LEARNING_CONTRACT_VERSION"),
    recommendations: configured(
      "recommendations",
      "AUTOMATION_RECOMMENDATION_CONTRACT_VERSION",
    ),
    furnishing: configured(
      "furnishing",
      "AUTOMATION_FURNISHING_CONTRACT_VERSION",
    ),
    notifications: {
      configured: true,
      enabled: flags.notificationProcessing,
      version: "outbox-v1",
    },
  });
}
function denied(correlationId: string) {
  return Object.freeze({
    ok: false as const,
    code: "AUTOMATION_OPERATIONS_UNAUTHORIZED",
    message: "The requested automation scope is unavailable.",
    correlationId,
  });
}
function rows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
    : [];
}
function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}
function mapRun(row: Record<string, unknown>): AutomationRun {
  return Object.freeze({
    id: String(row.id),
    tenantId: String(row.workspace_id),
    propertyIds: Object.freeze(strings(row.property_ids)),
    automationDefinitionId: String(row.automation_id),
    automationDefinitionVersionId: String(row.automation_definition_version_id),
    automationDefinitionVersion: Number(row.automation_definition_version),
    runRequestId: String(row.run_request_id),
    triggerOccurrenceId: String(row.trigger_occurrence_id),
    executionPlanVersion: String(row.execution_plan_version),
    initiatingActorId: String(row.initiating_actor_id),
    serviceActorPolicyId: String(row.service_actor_policy_id),
    correlationId: String(row.correlation_id),
    causationId: String(row.causation_id),
    status: row.status as AutomationRun["status"],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    ...(row.deadline_at ? { deadlineAt: String(row.deadline_at) } : {}),
    version: Number(row.version),
  });
}
function mapStep(row: Record<string, unknown>): AutomationRunStep {
  return Object.freeze({
    id: String(row.id),
    tenantId: String(row.workspace_id),
    runId: String(row.run_id),
    stepKey: String(row.step_key),
    owningCapability: String(row.owning_capability),
    commandType: String(row.command_type),
    commandContractVersion: String(row.command_contract_version),
    dependencies: Object.freeze(strings(row.dependencies)),
    status: row.status as AutomationRunStep["status"],
    deterministicCommandId: String(row.deterministic_command_id),
    idempotencyKey: String(row.idempotency_key),
    attemptCount: Number(row.attempt_count),
    ...(row.lease_acquired_at
      ? { leaseAcquiredAt: String(row.lease_acquired_at) }
      : {}),
    ...(row.lease_expires_at
      ? { leaseExpiresAt: String(row.lease_expires_at) }
      : {}),
    leaseGeneration: Number(row.lease_generation),
    version: Number(row.version),
  });
}
function validInstant(value?: string) {
  return value && Number.isFinite(Date.parse(value))
    ? new Date(value).toISOString()
    : undefined;
}
function validTimeZone(value?: string) {
  if (!value) return undefined;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return value;
  } catch {
    return undefined;
  }
}
