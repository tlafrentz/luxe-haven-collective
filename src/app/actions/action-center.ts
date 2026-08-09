"use server";

import { revalidatePath } from "next/cache";
import {
  ActionVersion,
  InvalidActionTransition,
  PlatformActionNotFound,
  PlatformActionPersistenceFailure,
  StalePlatformActionVersion,
  createActionId,
  createWorkspaceId,
  type PlatformAction,
  type PlatformActionProvider,
} from "@/platform/actions";
import type { PlatformError } from "@/platform/kernel";
import { projectActionCenterAction } from "@/features/action-center/application/action-center-projection";
import type { ActionCenterAction } from "@/features/action-center";
import {
  createPlatformActionProvider,
  getActionCenterRequestContext,
} from "./action-center-runtime";
import { composeExecuteRuntime } from "./execute-runtime";

export type ActionMutationResult =
  | { ok: true; action: ActionCenterAction }
  | {
      ok: false;
      code:
        | "unauthenticated"
        | "forbidden"
        | "not-found"
        | "version-conflict"
        | "invalid-transition"
        | "validation-failed"
        | "persistence-failed";
      message: string;
    };
export type ActionCenterMutationInput = Readonly<{
  actionId: string;
  expectedVersion: number;
  operation:
    | "commit"
    | "mark-ready"
    | "start"
    | "block"
    | "unblock"
    | "submit-for-review"
    | "return-for-correction"
    | "complete"
    | "fail"
    | "retry"
    | "reopen"
    | "cancel"
    | "archive";
  reason?: string;
}>;

export async function mutateActionCenterAction(
  input: ActionCenterMutationInput,
): Promise<ActionMutationResult> {
  const context = await getActionCenterRequestContext();
  if (!context.ok)
    return context.code === "unauthenticated"
      ? failure("unauthenticated", "Sign in before changing an action.")
      : failure(
          "forbidden",
          "You do not have permission to change actions in this workspace.",
        );
  try {
    const controlled = [
      "start",
      "block",
      "unblock",
      "submit-for-review",
      "return-for-correction",
      "complete",
      "fail",
      "retry",
      "reopen",
    ].includes(input.operation);
    const action = controlled
      ? await executeControlled(input)
      : await execute(createPlatformActionProvider(context.client), {
          ...input,
          workspaceId: context.workspaceId,
          actor: context.viewer.actor,
        });
    if (!action)
      return failure(
        "persistence-failed",
        "The Action could not be changed. No partial changes were applied.",
      );
    revalidatePath("/dashboard/actions");
    revalidatePath(`/dashboard/actions/${input.actionId}`);
    return {
      ok: true,
      action: projectActionCenterAction(action, context.viewer),
    };
  } catch (error) {
    return mapError(error);
  }
}
async function executeControlled(
  input: ActionCenterMutationInput,
): Promise<PlatformAction | null> {
  const composed = await composeExecuteRuntime();
  if (!composed.ok) throw new Error(composed.message);
  if (input.operation === "block" && !input.reason?.trim())
    throw new TypeError("Blocking an Action requires an explanation.");
  const command = {
    workspaceId: composed.runtime.workspaceId,
    actionId: input.actionId,
    expectedVersion: input.expectedVersion,
    actor: composed.runtime.actor,
    occurredAt: new Date(),
    correlationId: crypto.randomUUID(),
  };
  const result =
    input.operation === "block"
      ? await composed.runtime.controls.addBlocker({
          ...command,
          blocker: {
            category: "other",
            description: input.reason!,
            severity: "medium",
          },
        })
      : input.operation === "unblock"
        ? await composed.runtime.controls.resume(command)
        : await composed.runtime.controls.transition({
            ...command,
            operation: input.operation as
              | "start"
              | "submit-for-review"
              | "return-for-correction"
              | "complete"
              | "fail"
              | "retry"
              | "reopen",
            ...(input.reason ? { reason: input.reason } : {}),
          });
  if (result.ok) return result.value.action;
  if (result.code === "ACTION_VERSION_CONFLICT")
    throw new StalePlatformActionVersion(input.actionId, input.expectedVersion);
  if (result.code === "ACTION_NOT_FOUND")
    throw new PlatformActionNotFound(input.actionId, composed.runtime.workspaceId);
  throw new TypeError(result.message);
}
async function execute(
  provider: PlatformActionProvider,
  input: ActionCenterMutationInput & {
    workspaceId: ReturnType<typeof createWorkspaceId>;
    actor: { type: "user"; id: string };
  },
): Promise<PlatformAction> {
  const command = {
    workspaceId: input.workspaceId,
    actionId: createActionId(input.actionId),
    expectedVersion: ActionVersion.create(input.expectedVersion),
    actor: input.actor,
    occurredAt: new Date(),
    ...(input.reason ? { reason: input.reason } : {}),
  };
  switch (input.operation) {
    case "commit":
      return provider.commit(command);
    case "mark-ready":
      return provider.markReady(command);
    case "start":
      return provider.start(command);
    case "block":
      return provider.block(command);
    case "unblock":
      return provider.unblock({ ...command, resumeTo: "in-progress" });
    case "submit-for-review":
      return provider.submitForReview(command);
    case "return-for-correction":
      return provider.returnForCorrection({
        ...command,
        reason: input.reason ?? "",
      });
    case "complete":
      return provider.complete(command);
    case "fail":
      return provider.fail({ ...command, reason: input.reason ?? "" });
    case "retry":
      return provider.retry({ ...command, reason: input.reason ?? "" });
    case "reopen":
      return provider.reopen({ ...command, reason: input.reason ?? "" });
    case "cancel":
      return provider.cancel(command);
    case "archive":
      return provider.archive(command);
  }
}
function mapError(error: unknown): ActionMutationResult {
  if (error instanceof StalePlatformActionVersion)
    return failure(
      "version-conflict",
      "This action changed after you opened it. Refresh the latest version before trying again.",
    );
  if (error instanceof PlatformActionNotFound)
    return failure("not-found", "This action was not found in your workspace.");
  if (error instanceof InvalidActionTransition)
    return failure("invalid-transition", error.message);
  if (error instanceof PlatformActionPersistenceFailure)
    return failure(
      "persistence-failed",
      "The action could not be saved. Try again.",
    );
  if (error instanceof TypeError)
    return failure("validation-failed", error.message);
  return failure(
    "persistence-failed",
    (error as PlatformError)?.message || "The action could not be changed.",
  );
}
function failure(
  code: Extract<ActionMutationResult, { ok: false }>["code"],
  message: string,
): ActionMutationResult {
  return { ok: false, code, message };
}
