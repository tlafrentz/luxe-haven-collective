import { randomUUID } from "node:crypto";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { SupabaseTeamAccessRepository } from "@/features/workspace";
import {
  SupabaseAutomationFoundationRepository,
  type AutomationApproval,
  type AutomationRun,
  type AutomationRunStep,
  type AutomationSupabaseClient,
} from "@/platform/automations";
import {
  projectAutomationWorkspace,
  type AutomationWorkspaceProjection,
  type ProjectionNotice,
} from "./automation-workspace-projections";

export type AutomationWorkspaceView =
  | "overview"
  | "definitions"
  | "approvals"
  | "runs"
  | "templates"
  | "operations";
export type AutomationWorkspaceQuery = Readonly<{
  view: AutomationWorkspaceView;
  propertyId?: string;
  status?: string;
  search?: string;
  sort: "attention" | "updated" | "name";
  page: number;
  pageSize: number;
}>;
export type AutomationExperienceFlags = Readonly<{
  workspace: boolean;
  readOnly: boolean;
  authoring: boolean;
  approvals: boolean;
  runControls: boolean;
  templates: boolean;
}>;
export type AutomationWorkspaceResult = Readonly<
  | {
      ok: true;
      value: AutomationWorkspaceProjection;
      flags: AutomationExperienceFlags;
      query: AutomationWorkspaceQuery;
      correlationId: string;
    }
  | { ok: false; code: string; message: string; correlationId: string }
>;

export function automationExperienceFlags(): AutomationExperienceFlags {
  const kill = process.env.AUTOMATION_WORKSPACE_KILL_SWITCH === "true";
  return Object.freeze({
    workspace: !kill && process.env.AUTOMATION_WORKSPACE_ENABLED === "true",
    readOnly: process.env.AUTOMATION_WORKSPACE_READ_ONLY !== "false",
    authoring: !kill && process.env.AUTOMATION_AUTHORING_ENABLED === "true",
    approvals:
      !kill && process.env.AUTOMATION_APPROVAL_INTERACTION_ENABLED === "true",
    runControls:
      !kill && process.env.AUTOMATION_RUN_CONTROLS_ENABLED === "true",
    templates:
      !kill && process.env.AUTOMATION_TEMPLATE_CATALOG_ENABLED === "true",
  });
}
export function isAutomationWorkspaceEnabled() {
  return automationExperienceFlags().workspace;
}
export function automationCohortEligible(
  input: Readonly<{
    enabled: boolean;
    tenantId: string;
    tenantIds: readonly string[];
    internalActor: boolean;
  }>,
) {
  return (
    input.enabled &&
    (input.internalActor || input.tenantIds.includes(input.tenantId))
  );
}
export function parseAutomationWorkspaceQuery(
  value: Record<string, string | string[] | undefined>,
  view: AutomationWorkspaceView,
): AutomationWorkspaceQuery {
  const first = (key: string) => {
    const item = value[key];
    return Array.isArray(item) ? item[0] : item;
  };
  const page = Number(first("page") ?? 1),
    pageSize = Number(first("pageSize") ?? 25),
    sort = first("sort");
  return Object.freeze({
    view,
    ...(first("propertyId") ? { propertyId: first("propertyId") } : {}),
    ...(first("status") ? { status: first("status") } : {}),
    ...(first("search")?.trim()
      ? { search: first("search")!.trim().slice(0, 100) }
      : {}),
    sort: sort === "name" || sort === "updated" ? sort : "attention",
    page: Number.isSafeInteger(page) && page > 0 ? Math.min(page, 1000) : 1,
    pageSize: Number.isSafeInteger(pageSize)
      ? Math.min(Math.max(pageSize, 10), 100)
      : 25,
  });
}

export async function getAutomationWorkspaceProjection(
  query: AutomationWorkspaceQuery,
): Promise<AutomationWorkspaceResult> {
  const correlationId = randomUUID(),
    flags = automationExperienceFlags();
  if (!flags.workspace)
    return {
      ok: false,
      code: "AUTOMATION_WORKSPACE_DISABLED",
      message: "The Automation workspace is not enabled for this cohort.",
      correlationId,
    };
  try {
    const { user, profile } = await requireUser(),
      accessRepository = new SupabaseTeamAccessRepository(),
      access = await accessRepository.resolve(user.id);
    if (!access || access.status !== "active")
      return {
        ok: false,
        code: "AUTOMATION_ACCESS_DENIED",
        message: "The Automation workspace is unavailable to this account.",
        correlationId,
      };
    if (
      !automationCohortEligible({
        enabled: process.env.AUTOMATION_COHORT_ENABLED === "true",
        tenantId: access.workspaceId,
        tenantIds: (process.env.AUTOMATION_COHORT_TENANT_IDS ?? "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        internalActor:
          process.env.AUTOMATION_INTERNAL_COHORT_ENABLED === "true" &&
          profile?.role === "admin",
      })
    )
      return {
        ok: false,
        code: "AUTOMATION_COHORT_INELIGIBLE",
        message:
          "The Automation workspace is not enabled for this account cohort.",
        correlationId,
      };
    const properties = await accessRepository.properties(access),
      authorizedIds =
        access.propertyAccess.type === "selected"
          ? access.propertyAccess.propertyIds
          : access.propertyAccess.type === "none"
            ? []
            : properties.map(({ id }) => id);
    if (query.propertyId && !authorizedIds.includes(query.propertyId))
      return {
        ok: false,
        code: "AUTOMATION_NOT_FOUND",
        message: "The requested automation scope is unavailable.",
        correlationId,
      };
    const propertyIds = query.propertyId ? [query.propertyId] : authorizedIds,
      client = await createClient(),
      repository = new SupabaseAutomationFoundationRepository(
        client as unknown as AutomationSupabaseClient,
      );
    const definitions = await repository.list(access.workspaceId),
      notices: ProjectionNotice[] = [];
    const [runResult, stepResult, approvalResult] = await Promise.all([
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
        .select("*")
        .eq("workspace_id", access.workspaceId),
    ]);
    if (runResult.error || stepResult.error || approvalResult.error)
      notices.push({
        classification: "partial",
        message:
          "Execution or approval history is temporarily partial. Definition data remains current.",
      });
    const runs = rows(runResult.data).map(mapRun),
      steps = rows(stepResult.data).map(mapStep),
      approvals = rows(approvalResult.data).map(mapApproval);
    const projection = projectAutomationWorkspace({
      tenantId: access.workspaceId,
      propertyIds,
      scopeLabel: query.propertyId
        ? (properties.find(({ id }) => id === query.propertyId)?.name ??
          "Authorized property")
        : `Authorized portfolio · ${propertyIds.length} properties`,
      timeZone: "America/Chicago",
      definitions,
      runs: runs.map((run) => ({
        run,
        steps: steps.filter((step) => step.runId === run.id),
      })),
      approvals: approvals.map((approval) => ({
        approval,
        automationId:
          runs.find(({ id }) => id === approval.runId)
            ?.automationDefinitionId ?? "Unavailable automation",
      })),
      generatedAt: new Date().toISOString(),
      notices,
    });
    return {
      ok: true,
      value: filterProjection(projection, query),
      flags,
      query,
      correlationId,
    };
  } catch {
    return {
      ok: false,
      code: "AUTOMATION_PROJECTION_UNAVAILABLE",
      message: "Automation could not load. No automation records were changed.",
      correlationId,
    };
  }
}

function filterProjection(
  value: AutomationWorkspaceProjection,
  query: AutomationWorkspaceQuery,
): AutomationWorkspaceProjection {
  const term = query.search?.toLocaleLowerCase();
  let definitions = value.automations.filter(
    (item) =>
      (!query.status || item.status === query.status) &&
      (!term ||
        item.name.toLocaleLowerCase().includes(term) ||
        item.id.toLocaleLowerCase().includes(term)),
  );
  definitions = [...definitions].sort((a, b) =>
    query.sort === "name"
      ? a.name.localeCompare(b.name)
      : query.sort === "updated"
        ? b.currentVersion - a.currentVersion
        : attentionOrder(a.attention) - attentionOrder(b.attention) ||
          a.name.localeCompare(b.name),
  );
  const start = (query.page - 1) * query.pageSize;
  return Object.freeze({
    ...value,
    automations: Object.freeze(
      definitions.slice(start, start + query.pageSize),
    ),
  });
}
function attentionOrder(value: "none" | "review" | "paused") {
  return value === "review" ? 0 : value === "paused" ? 1 : 2;
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
    ...(row.policy_decision_id
      ? { policyDecisionId: String(row.policy_decision_id) }
      : {}),
    ...(row.approval_id ? { approvalId: String(row.approval_id) } : {}),
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
    ...(row.concurrency_group
      ? { concurrencyGroup: String(row.concurrency_group) }
      : {}),
    status: row.status as AutomationRunStep["status"],
    deterministicCommandId: String(row.deterministic_command_id),
    idempotencyKey: String(row.idempotency_key),
    ...(row.expected_target_version == null
      ? {}
      : { expectedTargetVersion: Number(row.expected_target_version) }),
    attemptCount: Number(row.attempt_count),
    ...(row.next_attempt_at
      ? { nextAttemptAt: String(row.next_attempt_at) }
      : {}),
    ...(row.lease_owner ? { leaseOwner: String(row.lease_owner) } : {}),
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
function mapApproval(row: Record<string, unknown>): AutomationApproval {
  return Object.freeze({
    id: String(row.id),
    tenantId: String(row.workspace_id),
    runId: String(row.run_id),
    stepIds: Object.freeze(strings(row.step_ids)),
    definitionVersionId: String(row.definition_version_id),
    commandFingerprint: String(row.command_fingerprint),
    targetContextVersion: String(row.target_context_version),
    policyVersion: String(row.policy_version),
    status: row.status as AutomationApproval["status"],
    requestedAt: String(row.requested_at),
    expiresAt: String(row.expires_at),
    ...(row.decided_by
      ? { decidedBy: String(row.decided_by), decidedAt: String(row.decided_at) }
      : {}),
    ...(row.reason ? { reason: String(row.reason) } : {}),
    version: Number(row.version),
  });
}
