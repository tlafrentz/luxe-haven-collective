"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SupabaseTeamAccessRepository } from "@/features/workspace";
import {
  authorizeWithLegacyFallback,
  PRIVILEGE_IDS,
  type PlatformAccessClient,
  type PrivilegeId,
} from "@/features/platform-access";
import {
  createAutomationFoundationService,
  createGovernedExecutionService,
  SupabaseAutomationFoundationRepository,
  SupabaseAutomationGovernedExecutionRepository,
  type AutomationAuthorizationPort,
  type AutomationSupabaseClient,
  type AutomationActor,
  type AutomationDefinitionExecutionReader,
  type AutomationDefinitionStatus,
  type AutomationPolicyEvaluator,
  type AutomationRetryPolicy,
  type AutomationServiceActor,
  type GovernedExecutionRepository,
  type TriggerSupabaseClient,
} from "@/platform/automations";
import { automationExperienceFlags } from "@/features/automation-workspace/application/automation-workspace-composition";

// PA-006: transitional, additive-only migration onto PA-001 privileges. The
// AutomationFoundationService's own canManageAutomation check keeps deciding
// access exactly as it does today (see automation-foundation.ts's authorize()
// wrapper) -- this port is only ever consulted when that check denies, and a
// PA-001 grant can only extend it, never replace or narrow it.
function privilegeForOperation(
  operation: Parameters<AutomationAuthorizationPort["authorize"]>[0]["operation"],
): PrivilegeId {
  switch (operation) {
    case "create":
      return PRIVILEGE_IDS.automationsAutomationCreate;
    case "activate":
    case "pause":
    case "resume":
    case "retire":
    case "archive":
      return PRIVILEGE_IDS.automationsAutomationEnable;
    default:
      return PRIVILEGE_IDS.automationsAutomationEdit;
  }
}
function createAutomationAuthorizationPort(
  access: Readonly<{ profileId: string; workspaceId: string }>,
  scope?: { scopeType?: "workspace" | "property"; scopeId?: string | null },
): AutomationAuthorizationPort {
  return {
    authorize: async (input) =>
      input.legacyAllowed ||
      authorizeWithLegacyFallback({
        client: createAdminClient() as unknown as PlatformAccessClient,
        subjectId: access.profileId,
        workspaceId: access.workspaceId,
        privilegeId: privilegeForOperation(input.operation),
        scopeType: scope?.scopeType,
        scopeId: scope?.scopeId,
        legacyAllowed: input.legacyAllowed,
      }),
  };
}

export type AutomationCommandResult = Readonly<
  { ok: true } | { ok: false; message: string }
>;

const APPROVAL_DISPOSITIONS: Readonly<
  Record<string, "approve" | "reject" | "defer" | "request_revision">
> = Object.freeze({
  approve: "approve",
  reject: "reject",
  defer: "defer",
  "request-revision": "request_revision",
});

export async function executeAutomationWorkspaceCommand(
  _state: AutomationCommandResult,
  formData: FormData,
): Promise<AutomationCommandResult> {
  const flags = automationExperienceFlags();
  if (!flags.workspace || flags.readOnly)
    return {
      ok: false,
      message: "Automation commands are disabled for this cohort.",
    };
  const command = text(formData, "command", 40),
    targetId = text(formData, "targetId", 200),
    expectedVersion = integer(formData, "expectedVersion"),
    reason = optionalText(formData, "reason", 500),
    idempotencyKey = text(formData, "idempotencyKey", 200);
  if (!idempotencyKey.startsWith("au001d:"))
    return {
      ok: false,
      message: "This request could not be verified. Please retry.",
    };
  const { user } = await requireUser(),
    accessRepository = new SupabaseTeamAccessRepository(),
    access = await accessRepository.resolve(user.id);
  if (!access || access.status !== "active")
    return {
      ok: false,
      message: "Your workspace access could not be verified.",
    };
  const actor: AutomationActor = Object.freeze({
    actorId: user.id,
    tenantId: access.workspaceId,
    role: access.role,
    active: true,
    propertyIds:
      access.propertyAccess.type === "selected"
        ? access.propertyAccess.propertyIds
        : (await accessRepository.properties(access)).map(({ id }) => id),
  });
  const client = await createClient();

  const disposition = APPROVAL_DISPOSITIONS[command];
  if (disposition) {
    if (!flags.approvals)
      return {
        ok: false,
        message: "Approval interaction is disabled for this cohort.",
      };
    return decideAutomationApprovalCommand({
      client: client as unknown as TriggerSupabaseClient,
      actor,
      tenantId: access.workspaceId,
      approvalId: targetId,
      expectedApprovalVersion: expectedVersion,
      disposition,
      reason,
    });
  }
  if (command === "cancel") {
    if (!flags.runControls)
      return {
        ok: false,
        message: "Run controls are disabled for this cohort.",
      };
    return cancelAutomationRunCommand({
      client: client as unknown as TriggerSupabaseClient,
      actor,
      tenantId: access.workspaceId,
      runId: targetId,
      expectedRunVersion: expectedVersion,
      reason,
    });
  }
  if (!flags.authoring)
    return { ok: false, message: "Authoring is disabled for this cohort." };
  const transition = transitionFor(command);
  if (!transition)
    return { ok: false, message: "This command is not recognized." };
  const service = createAutomationFoundationService({
    repository: new SupabaseAutomationFoundationRepository(
      client as unknown as AutomationSupabaseClient,
    ),
    authorization: createAutomationAuthorizationPort(access),
    clock: () => new Date().toISOString(),
    id: randomUUID,
  });
  const result = await service.transition({
    actor,
    tenantId: access.workspaceId,
    automationId: targetId,
    expectedVersion,
    to: transition,
    reviewerAuthorized: ["owner", "administrator"].includes(actor.role),
    activatorAuthorized: ["owner", "administrator"].includes(actor.role),
    ...(reason ? { reason } : {}),
    correlationId: randomUUID(),
  });
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath("/dashboard/automations");
  revalidatePath(
    `/dashboard/automations/definitions/${encodeURIComponent(targetId)}`,
  );
  return { ok: true };
}

/**
 * decideApproval/requestCancellation never read these; the governed
 * execution service bundles dispatch, policy evaluation, and definition
 * lookups behind the same factory, so approval and cancellation commands
 * still need type-valid stand-ins to construct it.
 */
const UNUSED_DEFINITIONS: AutomationDefinitionExecutionReader = {
  async getExecution() {
    return null;
  },
};
const UNUSED_POLICY: AutomationPolicyEvaluator = {
  async evaluate() {
    throw new Error(
      "Policy evaluation is not reachable from approval or cancellation commands.",
    );
  },
};
const UNUSED_RETRY_POLICY: AutomationRetryPolicy = Object.freeze({
  version: "au001d-unused.v1",
  maximumAttempts: 1,
  maximumElapsedMs: 1,
  initialDelayMs: 1,
  maximumDelayMs: 1,
  jitterRatio: 0,
  retryableClassifications: Object.freeze([]),
});
function unusedServiceActor(tenantId: string): AutomationServiceActor {
  return Object.freeze({
    actorId: "au001d-workspace-command",
    tenantId,
    policyId: "au001d-unused",
    active: true,
    grants: Object.freeze([]),
  });
}
function createWorkspaceGovernedExecution(
  repository: GovernedExecutionRepository,
  tenantId: string,
) {
  return createGovernedExecutionService({
    repository,
    definitions: UNUSED_DEFINITIONS,
    policy: UNUSED_POLICY,
    approvalAuthority: {
      async canApprove(candidate, run) {
        return (
          candidate.active &&
          candidate.tenantId === tenantId &&
          run.tenantId === tenantId &&
          ["owner", "administrator"].includes(candidate.role)
        );
      },
    },
    ports: [],
    serviceActor: unusedServiceActor(tenantId),
    retryPolicy: UNUSED_RETRY_POLICY,
    clock: () => new Date().toISOString(),
    id: randomUUID,
    enabled: () => true,
    killSwitched: () => false,
    leaseDurationMs: 60_000,
  });
}
async function decideAutomationApprovalCommand(
  input: Readonly<{
    client: TriggerSupabaseClient;
    actor: AutomationActor;
    tenantId: string;
    approvalId: string;
    expectedApprovalVersion: number;
    disposition: "approve" | "reject" | "defer" | "request_revision";
    reason?: string;
  }>,
): Promise<AutomationCommandResult> {
  const repository = new SupabaseAutomationGovernedExecutionRepository(
    input.client,
  );
  const approval = await repository.getApproval(
    input.tenantId,
    input.approvalId,
  );
  if (!approval)
    return { ok: false, message: "The approval request was not found." };
  const run = await repository.getRun(input.tenantId, approval.runId);
  if (!run)
    return {
      ok: false,
      message: "The associated automation run was not found.",
    };
  const service = createWorkspaceGovernedExecution(repository, input.tenantId);
  const result = await service.decideApproval({
    tenantId: input.tenantId,
    approvalId: input.approvalId,
    expectedApprovalVersion: input.expectedApprovalVersion,
    expectedRunVersion: run.version,
    actor: input.actor,
    disposition: input.disposition,
    ...(input.reason ? { reason: input.reason } : {}),
  });
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath("/dashboard/automations");
  revalidatePath(
    `/dashboard/automations/approvals/${encodeURIComponent(input.approvalId)}`,
  );
  revalidatePath(
    `/dashboard/automations/runs/${encodeURIComponent(approval.runId)}`,
  );
  return { ok: true };
}
async function cancelAutomationRunCommand(
  input: Readonly<{
    client: TriggerSupabaseClient;
    actor: AutomationActor;
    tenantId: string;
    runId: string;
    expectedRunVersion: number;
    reason?: string;
  }>,
): Promise<AutomationCommandResult> {
  const repository = new SupabaseAutomationGovernedExecutionRepository(
    input.client,
  );
  const service = createWorkspaceGovernedExecution(repository, input.tenantId);
  const result = await service.requestCancellation({
    tenantId: input.tenantId,
    runId: input.runId,
    expectedRunVersion: input.expectedRunVersion,
    actor: input.actor,
    reason: input.reason ?? "",
  });
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath("/dashboard/automations");
  revalidatePath(
    `/dashboard/automations/runs/${encodeURIComponent(input.runId)}`,
  );
  return { ok: true };
}

export async function createAutomationDraft(formData: FormData): Promise<void> {
  const flags = automationExperienceFlags();
  if (!flags.workspace || flags.readOnly || !flags.authoring) return;
  const name = text(formData, "name", 120),
    description = text(formData, "description", 1000),
    propertyId = text(formData, "propertyId", 200),
    templateOrigin = optionalText(formData, "templateOrigin", 200);
  const { user } = await requireUser(),
    accessRepository = new SupabaseTeamAccessRepository(),
    access = await accessRepository.resolve(user.id);
  if (!access || access.status !== "active") return;
  const properties = await accessRepository.properties(access),
    authorizedIds =
      access.propertyAccess.type === "selected"
        ? access.propertyAccess.propertyIds
        : access.propertyAccess.type === "none"
          ? []
          : properties.map(({ id }) => id);
  if (!authorizedIds.includes(propertyId)) return;
  const actor: AutomationActor = Object.freeze({
      actorId: user.id,
      tenantId: access.workspaceId,
      role: access.role,
      active: true,
      propertyIds: authorizedIds,
    }),
    client = await createClient();
  const service = createAutomationFoundationService({
    repository: new SupabaseAutomationFoundationRepository(
      client as unknown as AutomationSupabaseClient,
    ),
    authorization: createAutomationAuthorizationPort(access, {
      scopeType: "property",
      scopeId: propertyId,
    }),
    clock: () => new Date().toISOString(),
    id: randomUUID,
  });
  const now = new Date().toISOString(),
    result = await service.createDraft({
      actor,
      tenantId: access.workspaceId,
      name,
      description,
      ...(templateOrigin ? { templateOrigin } : {}),
      configuration: {
        scope: { type: "property", propertyIds: [propertyId] },
        ownerId: user.id,
        trigger: {
          kind: "manual",
          schemaVersion: "au001-trigger.v1",
          sourceCapability: "automation-workspace",
          specification: {},
        },
        conditions: [],
        exclusions: [],
        command: {
          owningCapability: "execute",
          commandType: "createDraftPlan",
          contractVersion: "v1",
        },
        approval: { mode: "before-run", authority: "workspace-owner" },
        execution: { maxFanOut: 1, maxChainDepth: 1, concurrency: "queue" },
        retry: { maxAttempts: 3, timeoutMs: 60000 },
        notification: { eventTypes: ["failed", "approval-required"] },
        effectiveFrom: now,
      },
      correlationId: randomUUID(),
    });
  if (result.ok) {
    revalidatePath("/dashboard/automations");
    revalidatePath("/dashboard/automations/definitions");
    redirect(
      `/dashboard/automations/definitions/${encodeURIComponent(result.value.definition.id)}`,
    );
  }
}

function transitionFor(command: string): AutomationDefinitionStatus | null {
  return (
    (
      {
        "submit-review": "ready-for-review",
        activate: "active",
        pause: "paused",
        resume: "active",
        retire: "retired",
      } as Readonly<Record<string, AutomationDefinitionStatus>>
    )[command] ?? null
  );
}
function text(formData: FormData, field: string, maximum: number) {
  const value = formData.get(field);
  if (typeof value !== "string" || !value.trim() || value.length > maximum)
    throw new Error("Invalid automation command input.");
  return value.trim();
}
function optionalText(formData: FormData, field: string, maximum: number) {
  const value = formData.get(field);
  if (typeof value !== "string" || !value.trim()) return undefined;
  if (value.length > maximum)
    throw new Error("Invalid automation command input.");
  return value.trim();
}
function integer(formData: FormData, field: string) {
  const value = Number(formData.get(field));
  if (!Number.isSafeInteger(value) || value < 1)
    throw new Error("Invalid automation command version.");
  return value;
}
