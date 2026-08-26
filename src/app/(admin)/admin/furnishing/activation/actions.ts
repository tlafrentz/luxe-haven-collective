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
