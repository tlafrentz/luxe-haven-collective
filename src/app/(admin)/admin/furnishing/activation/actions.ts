"use server";
import {
  executeFurnishingActivationCommand,
  type FurnishingAdminCommand,
} from "@/features/furnishing-studio/admin-activation-commands";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseFurnishingActivationRepository } from "@/features/furnishing-studio/supabase-activation-command-repository";
import { requireRole } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { requireReleaseControlAccess } from "@/features/furnishing-studio/server-release-control-access";

/** Server-only handoff; components never write activation persistence directly. */
export async function submitFurnishingActivationCommand(
  command: FurnishingAdminCommand,
) {
  const { user } = await requireRole(["admin"]);
  try {
    const client = await createClient();
    const result = await executeFurnishingActivationCommand(
      createSupabaseFurnishingActivationRepository(client),
      { ...command, actorId: user.id, actorRole: "admin" },
    );
    revalidatePath("/admin/furnishing/activation");
    return { ok: true as const, result };
  } catch (error) {
    const code =
      error instanceof Error && "code" in error
        ? String((error as { code?: unknown }).code)
        : "UNAVAILABLE";
    return {
      ok: false as const,
      code,
      message:
        error instanceof Error
          ? error.message
          : "Activation command unavailable.",
    };
  }
}

export async function verifyFurnishingReleaseCapability(
  input: Readonly<{
    workspaceId: string;
    capability: string;
    expectedVersion: number;
    reason: string;
    correlationId: string;
    idempotencyKey: string;
  }>,
) {
  await requireReleaseControlAccess("verify", input.workspaceId);
  const client = await createClient();
  const { data, error } = await client.rpc("fsux8_verify_capability_v2", {
    p_workspace_id: input.workspaceId,
    p_capability: input.capability,
    p_expected_version: input.expectedVersion,
    p_policy_version: "fs008a-v1",
    p_reason: input.reason,
    p_correlation_id: input.correlationId,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error)
    return {
      ok: false as const,
      code:
        error.message.match(/FURNISHING_RELEASE_[A-Z_]+/)?.[0] ??
        "RELEASE_VERIFICATION_UNAVAILABLE",
      message:
        "Verification failed safely. Refresh the authoritative state before retrying.",
    };
  revalidatePath(
    `/admin/furnishing/release-controls/workspaces/${input.workspaceId}`,
  );
  return { ok: true as const, result: data };
}

export async function submitReleaseControlV2(
  input: Readonly<{
    action: string;
    workspaceId?: string;
    capability?: string;
    expectedReleaseVersion: number;
    expectedTargetVersion: number;
    policyVersion: string;
    reason: string;
    correlationId: string;
    idempotencyKey: string;
    riskResolution?: string;
  }>,
) {
  const permission =
    input.action === "recover_global"
      ? "global_recover"
      : input.action === "recover_workspace"
        ? "workspace_recover"
        : input.action === "suspend_global"
          ? "global_suspend"
          : input.action === "suspend_workspace"
            ? "workspace_suspend"
            : input.action.startsWith("cohort_")
              ? "cohort_control"
              : input.action === "release_mode"
                ? "release_mode"
                : "control";
  await requireReleaseControlAccess(permission, input.workspaceId);
  const client = await createClient();
  const { data, error } = await client.rpc("fsux8_apply_control_v2", {
    p_action: input.action,
    p_workspace_id: input.workspaceId ?? null,
    p_capability: input.capability ?? null,
    p_expected_release_version: input.expectedReleaseVersion,
    p_expected_target_version: input.expectedTargetVersion,
    p_policy_version: input.policyVersion,
    p_environment: "production",
    p_reason: input.reason,
    p_correlation_id: input.correlationId,
    p_idempotency_key: input.idempotencyKey,
    p_risk_resolution: input.riskResolution ?? null,
  });
  if (error)
    return {
      ok: false as const,
      code:
        error.message.match(/FURNISHING_RELEASE_[A-Z_]+/)?.[0] ??
        "RELEASE_CONTROL_UNAVAILABLE",
      message:
        "The command failed safely. Refresh the authoritative state and review the blocking condition.",
    };
  revalidatePath("/admin/furnishing/release-controls");
  if (input.workspaceId)
    revalidatePath(
      `/admin/furnishing/release-controls/workspaces/${input.workspaceId}`,
    );
  return { ok: true as const, result: data };
}
