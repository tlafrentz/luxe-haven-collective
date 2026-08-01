"use server";

import { revalidatePath } from "next/cache";

import {
  applyPropertySystemCommand,
  authorizeWorkspaceAction,
  resolveWorkspaceAccessContext,
  SupabasePropertiesSystemsRepository,
  SupabaseTeamAccessRepository,
} from "@/features/workspace";
import { runHospitableReservationSync, SYNC_ALREADY_RUNNING_ERROR } from "@/features/integrations/hospitable";
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

export async function workspaceHospitableSyncAction(formData: FormData) {
  const { user } = await requireUser();
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const context = await resolveWorkspaceAccessContext(
    new SupabaseTeamAccessRepository(),
    user.id,
    workspaceId,
  );
  authorizeWorkspaceAction(context, "connections.manage");
  try {
    await runHospitableReservationSync();
  } catch (error) {
    if (!(error instanceof Error) || error.message !== SYNC_ALREADY_RUNNING_ERROR) throw error;
  }
  revalidatePath("/dashboard/workspace");
  revalidatePath("/dashboard/workspace/properties");
  revalidatePath("/dashboard/workspace/connected-systems");
  revalidatePath("/dashboard");
  revalidatePath("/properties");
  revalidatePath("/bookings");
}
