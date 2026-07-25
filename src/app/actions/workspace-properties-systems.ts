"use server";

import { revalidatePath } from "next/cache";

import {
  applyPropertySystemCommand,
  resolveWorkspaceAccessContext,
  SupabasePropertiesSystemsRepository,
  SupabaseTeamAccessRepository,
} from "@/features/workspace";
import { requireUser } from "@/lib/auth/session";

export async function workspacePropertySystemAction(formData: FormData) {
  const { user } = await requireUser();
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const targetId = String(formData.get("targetId") ?? "");
  const action = String(formData.get("action") ?? "") as Parameters<typeof applyPropertySystemCommand>[1]["action"];
  const context = await resolveWorkspaceAccessContext(
    new SupabaseTeamAccessRepository(),
    user.id,
    workspaceId,
  );
  await applyPropertySystemCommand(new SupabasePropertiesSystemsRepository(), {
    context,
    action,
    targetId,
    commandId: crypto.randomUUID(),
  });
  revalidatePath("/dashboard/workspace");
  revalidatePath("/dashboard/workspace/properties");
  revalidatePath("/dashboard/workspace/connected-systems");
  revalidatePath("/dashboard");
  revalidatePath("/properties");
  revalidatePath("/bookings");
}
