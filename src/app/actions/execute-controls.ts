"use server";

import { revalidatePath } from "next/cache";
import type {
  ActionBlocker,
  ActionEvidence,
  ExecuteActionDetail,
  ExecuteControlResult,
  ExecuteControlState,
} from "@/platform/actions";
import { projectExecuteActionDetail } from "@/platform/actions";
import { createClient } from "@/lib/supabase/server";
import { composeExecuteRuntime } from "./execute-runtime";

type ContextInput = Readonly<{
  actionId: string;
  expectedVersion: number;
  correlationId?: string;
}>;
type Result = ExecuteControlResult<ExecuteControlState>;

export async function attachExecuteEvidenceAction(
  input: ContextInput &
    Readonly<{
      evidence: Omit<
        ActionEvidence,
        "id" | "workspaceId" | "actionId" | "createdBy" | "createdAt" | "status"
      >;
    }>,
): Promise<Result> {
  return command(
    input,
    (runtime, context) =>
      runtime.controls.attachEvidence({ ...context, evidence: input.evidence }),
    input,
  );
}
export async function submitExecuteEvidenceAction(
  input: ContextInput & Readonly<{ evidenceIds: readonly string[] }>,
): Promise<Result> {
  return command(
    input,
    (runtime, context) =>
      runtime.controls.submitEvidence({
        ...context,
        evidenceIds: input.evidenceIds,
      }),
    input,
  );
}
export async function reviewExecuteEvidenceAction(
  input: ContextInput &
    Readonly<{ evidenceId: string; accepted: boolean; reason?: string }>,
): Promise<Result> {
  return command(
    input,
    (runtime, context) =>
      runtime.controls.reviewEvidence({
        ...context,
        evidenceId: input.evidenceId,
        accepted: input.accepted,
        ...(input.reason ? { reason: input.reason } : {}),
      }),
    input,
  );
}
export async function blockExecuteAction(
  input: ContextInput &
    Readonly<{
      blocker: Readonly<{
        category: ActionBlocker["category"];
        description: string;
        severity: ActionBlocker["severity"];
        blockingParty?: string;
        expectedResolutionAt?: Date;
      }>;
    }>,
): Promise<Result> {
  return command(
    input,
    (runtime, context) =>
      runtime.controls.addBlocker({ ...context, blocker: input.blocker }),
    input,
  );
}
export async function resolveExecuteBlockerAction(
  input: ContextInput & Readonly<{ blockerId: string; resolutionNote: string }>,
): Promise<Result> {
  return command(
    input,
    (runtime, context) =>
      runtime.controls.resolveBlocker({
        ...context,
        blockerId: input.blockerId,
        resolutionNote: input.resolutionNote,
      }),
    input,
  );
}
export async function updateExecuteBlockerAction(
  input: ContextInput &
    Readonly<{
      blockerId: string;
      changes: Readonly<{
        category?: ActionBlocker["category"];
        description?: string;
        severity?: ActionBlocker["severity"];
        blockingParty?: string;
        expectedResolutionAt?: Date;
      }>;
    }>,
): Promise<Result> {
  return command(
    input,
    (runtime, context) =>
      runtime.controls.updateBlocker({
        ...context,
        blockerId: input.blockerId,
        changes: input.changes,
      }),
    input,
  );
}
export async function resumeExecuteAction(
  input: ContextInput,
): Promise<Result> {
  return command(
    input,
    (runtime, context) => runtime.controls.resume(context),
    input,
  );
}
export async function addExecuteDependencyAction(
  input: ContextInput & Readonly<{ dependsOnActionId: string }>,
): Promise<Result> {
  return command(
    input,
    (runtime, context) =>
      runtime.controls.addDependency({
        ...context,
        dependsOnActionId: input.dependsOnActionId,
      }),
    input,
  );
}
export async function removeExecuteDependencyAction(
  input: ContextInput & Readonly<{ dependsOnActionId: string }>,
): Promise<Result> {
  return command(
    input,
    (runtime, context) =>
      runtime.controls.removeDependency({
        ...context,
        dependsOnActionId: input.dependsOnActionId,
      }),
    input,
  );
}
export async function overrideExecuteDependencyAction(
  input: ContextInput & Readonly<{ dependsOnActionId: string; reason: string }>,
): Promise<Result> {
  return command(
    input,
    (runtime, context) =>
      runtime.controls.overrideDependency({
        ...context,
        dependsOnActionId: input.dependsOnActionId,
        reason: input.reason,
      }),
    input,
  );
}
export async function transitionExecuteAction(
  input: ContextInput &
    Readonly<{
      operation:
        | "start"
        | "submit-for-review"
        | "return-for-correction"
        | "complete"
        | "fail"
        | "retry"
        | "reopen";
      reason?: string;
    }>,
): Promise<Result> {
  return command(
    input,
    (runtime, context) =>
      runtime.controls.transition({
        ...context,
        operation: input.operation,
        ...(input.reason ? { reason: input.reason } : {}),
      }),
    input,
  );
}

export async function getExecuteActionDetailAction(
  input: Readonly<{ actionId: string }>,
): Promise<
  | Readonly<{ ok: true; value: ExecuteActionDetail }>
  | Readonly<{ ok: false; code: string; message: string; retryable: boolean }>
> {
  const composed = await composeExecuteRuntime();
  if (!composed.ok)
    return {
      ...composed,
      retryable: composed.code === "DEPENDENCY_UNAVAILABLE",
    };
  try {
    const state = await composed.runtime.controlRepository.get(
      composed.runtime.workspaceId,
      input.actionId,
    );
    if (!state)
      return {
        ok: false,
        code: "ACTION_NOT_FOUND",
        message: "Action was not found.",
        retryable: false,
      };
    const activity = await composed.runtime.activity.list(
      composed.runtime.workspaceId,
      "action",
      input.actionId,
    );
    return {
      ok: true,
      value: await projectExecuteActionDetail({
        state,
        activity,
        actor: composed.runtime.actor,
        authorization: composed.runtime.controlAuthorization,
      }),
    };
  } catch {
    return {
      ok: false,
      code: "DEPENDENCY_UNAVAILABLE",
      message: "Execute could not load this Action.",
      retryable: true,
    };
  }
}

export async function authorizeExecuteEvidenceUploadAction(
  input: Readonly<{ actionId: string; filename: string }>,
): Promise<
  | Readonly<{ ok: true; bucket: string; path: string; token: string }>
  | Readonly<{ ok: false; code: string; message: string; retryable: boolean }>
> {
  const composed = await composeExecuteRuntime();
  if (!composed.ok)
    return {
      ...composed,
      retryable: composed.code === "DEPENDENCY_UNAVAILABLE",
    };
  const state = await composed.runtime.controlRepository.get(
    composed.runtime.workspaceId,
    input.actionId,
  );
  if (
    !state ||
    !(await composed.runtime.controlAuthorization.canWork({
      workspaceId: composed.runtime.workspaceId,
      action: state.action,
      actor: composed.runtime.actor,
    }))
  )
    return {
      ok: false,
      code: "ACTION_CONTROL_UNAUTHORIZED",
      message: "You are not authorized to attach evidence to this Action.",
      retryable: false,
    };
  const safe =
    input.filename.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120) || "evidence";
  const path = `${composed.runtime.workspaceId}/${input.actionId}/${crypto.randomUUID()}-${safe}`;
  const client = await createClient();
  const result = await client.storage
    .from("execute-evidence")
    .createSignedUploadUrl(path);
  if (result.error)
    return {
      ok: false,
      code: "EVIDENCE_UPLOAD_UNAVAILABLE",
      message: "Evidence upload authorization could not be created.",
      retryable: true,
    };
  return {
    ok: true,
    bucket: "execute-evidence",
    path,
    token: result.data.token,
  };
}

async function command(
  input: ContextInput,
  run: (
    runtime: Extract<
      Awaited<ReturnType<typeof composeExecuteRuntime>>,
      Readonly<{ ok: true }>
    >["runtime"],
    context: Readonly<{
      workspaceId: string;
      actionId: string;
      expectedVersion: number;
      actor: Readonly<{ type: "user"; id: string }>;
      occurredAt: Date;
      correlationId: string;
    }>,
  ) => Promise<Result>,
  submittedInput: unknown,
): Promise<Result> {
  const composed = await composeExecuteRuntime();
  if (!composed.ok)
    return {
      ok: false,
      code: "ACTION_CONTROL_UNAUTHORIZED",
      message: composed.message,
      retryable: composed.code === "DEPENDENCY_UNAVAILABLE",
      submittedInput,
    };
  const context = {
    workspaceId: composed.runtime.workspaceId,
    actionId: input.actionId,
    expectedVersion: input.expectedVersion,
    actor: composed.runtime.actor,
    occurredAt: new Date(),
    correlationId: input.correlationId ?? crypto.randomUUID(),
  };
  const result = await run(composed.runtime, context);
  if (result.ok) {
    revalidatePath("/dashboard/actions");
    revalidatePath(`/dashboard/actions/${input.actionId}`);
  }
  return result;
}
