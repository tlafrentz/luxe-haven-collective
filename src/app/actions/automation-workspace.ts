"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { SupabaseTeamAccessRepository } from "@/features/workspace";
import {
  createAutomationFoundationService,
  SupabaseAutomationFoundationRepository,
  type AutomationSupabaseClient,
  type AutomationActor,
  type AutomationDefinitionStatus,
} from "@/platform/automations";
import { automationExperienceFlags } from "@/features/automation-workspace/application/automation-workspace-composition";

export async function executeAutomationWorkspaceCommand(
  formData: FormData,
): Promise<void> {
  const flags = automationExperienceFlags();
  if (!flags.workspace || flags.readOnly || !flags.authoring) return;
  const command = text(formData, "command", 40),
    targetId = text(formData, "targetId", 200),
    expectedVersion = integer(formData, "expectedVersion"),
    reason = optionalText(formData, "reason", 500),
    idempotencyKey = text(formData, "idempotencyKey", 200);
  if (!idempotencyKey.startsWith("au001d:")) return;
  const { user } = await requireUser(),
    accessRepository = new SupabaseTeamAccessRepository(),
    access = await accessRepository.resolve(user.id);
  if (!access || access.status !== "active") return;
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
  const transition = transitionFor(command);
  if (!transition) return;
  const client = await createClient(),
    service = createAutomationFoundationService({
      repository: new SupabaseAutomationFoundationRepository(
        client as unknown as AutomationSupabaseClient,
      ),
      authorization: {
        authorize: async ({ actor: candidate, propertyIds }) =>
          candidate.active &&
          candidate.tenantId === access.workspaceId &&
          ["owner", "administrator", "operator"].includes(candidate.role) &&
          (candidate.role !== "operator" ||
            propertyIds.every((id) => candidate.propertyIds.includes(id))),
      },
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
  if (result.ok) {
    revalidatePath("/dashboard/automations");
    revalidatePath(
      `/dashboard/automations/definitions/${encodeURIComponent(targetId)}`,
    );
  }
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
    authorization: {
      authorize: async ({ actor: candidate, propertyIds }) =>
        candidate.active &&
        candidate.tenantId === access.workspaceId &&
        ["owner", "administrator", "operator"].includes(candidate.role) &&
        propertyIds.every((id) => authorizedIds.includes(id)),
    },
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
