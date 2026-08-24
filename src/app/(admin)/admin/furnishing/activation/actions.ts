"use server";
import { executeFurnishingActivationCommand, type FurnishingAdminCommand } from "@/features/furnishing-studio/admin-activation-commands";

/** Server-only handoff; components never write activation persistence directly. */
export async function submitFurnishingActivationCommand(command: FurnishingAdminCommand) {
  if (command.actorRole !== "admin") return { ok: false as const, code: "NOT_AUTHORIZED" as const, message: "Authorized Admin is required." };
  // The production repository adapter is supplied by the Admin server composition root.
  // Keeping this handoff server-only prevents client-supplied persistence mutations.
  return { ok: false as const, code: "UNAVAILABLE" as const, message: "Activation command repository is unavailable." };
}
