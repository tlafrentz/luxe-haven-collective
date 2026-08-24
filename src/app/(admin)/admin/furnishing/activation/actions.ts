"use server";
import { executeFurnishingActivationCommand, type FurnishingAdminCommand } from "@/features/furnishing-studio/admin-activation-commands";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseFurnishingActivationRepository } from "@/features/furnishing-studio/supabase-activation-command-repository";

/** Server-only handoff; components never write activation persistence directly. */
export async function submitFurnishingActivationCommand(command: FurnishingAdminCommand) {
  if (command.actorRole !== "admin") return { ok: false as const, code: "NOT_AUTHORIZED" as const, message: "Authorized Admin is required." };
  try { const client = await createClient(); const result = await executeFurnishingActivationCommand(createSupabaseFurnishingActivationRepository(client), command); return { ok: true as const, result }; } catch (error) { return { ok: false as const, code: error instanceof Error && "code" in error ? String((error as any).code) : "UNAVAILABLE", message: error instanceof Error ? error.message : "Activation command unavailable." }; }
}
