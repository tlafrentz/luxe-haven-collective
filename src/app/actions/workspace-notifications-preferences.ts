"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import {
  resolveWorkspaceAccessContext, SupabaseTeamAccessRepository, SupabaseNotificationsPreferencesRepository,
  updateNotificationPreferences, updateWorkspacePreferences,
  type UserNotificationPreferences, type UserWorkspacePreferences,
} from "@/features/workspace";

export type SettingsActionResult = { ok: boolean; message: string; revision?: number };
async function context(workspaceId: string) {
  const { user } = await requireUser();
  return resolveWorkspaceAccessContext(new SupabaseTeamAccessRepository(), user.id, workspaceId);
}
const refresh = () => { revalidatePath("/dashboard/workspace"); revalidatePath("/dashboard/workspace/notifications"); revalidatePath("/dashboard/workspace/preferences"); revalidatePath("/dashboard"); };
export async function saveNotificationPreferencesAction(input: { value: UserNotificationPreferences; expectedRevision: number; commandId: string }): Promise<SettingsActionResult> {
  try { const revision = await updateNotificationPreferences(new SupabaseNotificationsPreferencesRepository(), await context(input.value.workspaceId), input.value, input.expectedRevision, input.commandId); refresh(); return { ok: true, message: "Notification settings saved.", revision }; }
  catch (error) { return { ok: false, message: error instanceof Error && /another session/i.test(error.message) ? "These settings changed in another session. Reload and review the current values." : "Notification settings could not be saved. No changes were applied." }; }
}
export async function saveWorkspacePreferencesAction(input: { value: UserWorkspacePreferences; expectedRevision: number; commandId: string }): Promise<SettingsActionResult> {
  try { const revision = await updateWorkspacePreferences(new SupabaseNotificationsPreferencesRepository(), await context(input.value.workspaceId), input.value, input.expectedRevision, input.commandId); refresh(); return { ok: true, message: "Preferences saved.", revision }; }
  catch (error) { return { ok: false, message: error instanceof Error && /another session/i.test(error.message) ? "These preferences changed in another session. Reload and review the current values." : "Preferences could not be saved. No changes were applied." }; }
}
export async function updateNotificationStateAction(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId")), notificationId = String(formData.get("notificationId"));
  const status = String(formData.get("status")) as "read" | "dismissed";
  const access = await context(workspaceId); await new SupabaseNotificationsPreferencesRepository().updateNotification(access, notificationId, status); refresh();
}
