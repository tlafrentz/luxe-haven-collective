"use server";
import { executeFurnishingActivationCommand, type FurnishingAdminCommand } from "@/features/furnishing-studio/admin-activation-commands";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseFurnishingActivationRepository } from "@/features/furnishing-studio/supabase-activation-command-repository";
import { requireRole } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";

/** Server-only handoff; components never write activation persistence directly. */
export async function submitFurnishingActivationCommand(command: FurnishingAdminCommand) {
  const { user } = await requireRole(["admin"]);
  try {
    const client = await createClient();
    const result = await executeFurnishingActivationCommand(createSupabaseFurnishingActivationRepository(client), { ...command, actorId: user.id, actorRole: "admin" });
    revalidatePath("/admin/furnishing/activation");
    return { ok: true as const, result };
  } catch (error) { const code = error instanceof Error && "code" in error ? String((error as { code?: unknown }).code) : "UNAVAILABLE"; return { ok: false as const, code, message: error instanceof Error ? error.message : "Activation command unavailable." }; }
}

export async function verifyFurnishingReleaseCapability(input: Readonly<{ workspaceId: string; capability: string; expectedVersion: number; reason: string; correlationId: string; idempotencyKey: string }>) {
  await requireRole(["admin"]);
  const client = await createClient();
  const { data, error } = await client.rpc("verify_furnishing_release_capability", { p_workspace_id: input.workspaceId, p_capability: input.capability, p_expected_version: input.expectedVersion, p_reason: input.reason, p_correlation_id: input.correlationId, p_idempotency_key: input.idempotencyKey, p_success: true });
  if (error) return { ok: false as const, code: error.message.match(/FURNISHING_RELEASE_[A-Z_]+/)?.[0] ?? "RELEASE_VERIFICATION_UNAVAILABLE", message: "Verification failed safely. Refresh the authoritative state before retrying." };
  revalidatePath(`/admin/furnishing/release-controls/workspaces/${input.workspaceId}`);
  return { ok: true as const, result: data };
}
