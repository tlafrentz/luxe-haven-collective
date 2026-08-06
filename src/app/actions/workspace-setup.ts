"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { resolveWorkspaceAccessContext, SupabaseTeamAccessRepository } from "@/features/workspace";
import { sendEmail } from "@/lib/email/send";
import { track } from "@/lib/analytics/track";

async function requireWorkspaceContext() {
  const { user, profile } = await requireUser();
  const context = await resolveWorkspaceAccessContext(new SupabaseTeamAccessRepository(), user.id);
  return { user, profile, context };
}

export async function requestManualProviderSetupAction(provider: string): Promise<{ ok: boolean }> {
  const { user, profile, context } = await requireWorkspaceContext();
  const supabase = await createClient();
  const commandId = crypto.randomUUID();

  const { error } = await supabase.rpc("apply_workspace_setup_command", {
    p_workspace_id: context.workspaceId,
    p_action: "skip-step",
    p_step_code: "connect",
    p_command_id: commandId,
  });
  if (error) throw error;

  try {
    await sendEmail({
      to: "hello@luxehavencollective.com",
      subject: "Manual PMS setup requested",
      html: `<p>${profile?.full_name ?? profile?.email ?? user.email} requested manual setup for provider: <strong>${provider}</strong>.</p><p>Workspace: ${context.workspaceId}</p>`,
    });
  } catch {
    // Best-effort notification; do not block the customer's setup flow if email isn't configured.
  }

  track("pms_connection_selected", { workspaceId: context.workspaceId, provider });
  return { ok: true };
}

export async function skipSetupStepAction(step: string): Promise<void> {
  const { context } = await requireWorkspaceContext();
  const supabase = await createClient();
  const commandId = crypto.randomUUID();

  const { error } = await supabase.rpc("apply_workspace_setup_command", {
    p_workspace_id: context.workspaceId,
    p_action: "skip-step",
    p_step_code: step,
    p_command_id: commandId,
  });
  if (error) throw error;

  track("team_step_skipped", { workspaceId: context.workspaceId, step });
  redirect("/dashboard/setup/ready");
}

export async function createManualPropertyAction(
  _prevState: { ok?: boolean; message?: string },
  formData: FormData,
): Promise<{ ok?: boolean; message?: string }> {
  const { context } = await requireWorkspaceContext();
  const name = String(formData.get("name") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();

  if (!name) {
    return { ok: false, message: "Property name is required." };
  }

  const supabase = await createClient();
  const commandId = crypto.randomUUID();
  const { error } = await supabase.rpc("create_manual_workspace_property", {
    p_workspace_id: context.workspaceId,
    p_name: name,
    p_city: city,
    p_state: state,
    p_command_id: commandId,
  });
  if (error) {
    return { ok: false, message: "We couldn't add that property. Please try again." };
  }

  track("property_import_completed", { workspaceId: context.workspaceId, source: "manual" });
  return { ok: true, message: `${name} was added to your workspace.` };
}

export async function completeWorkspaceSetupAction(): Promise<void> {
  const { context } = await requireWorkspaceContext();
  const supabase = await createClient();
  const commandId = crypto.randomUUID();

  const { error } = await supabase.rpc("apply_workspace_setup_command", {
    p_workspace_id: context.workspaceId,
    p_action: "complete-setup",
    p_step_code: null,
    p_command_id: commandId,
  });
  if (error) throw error;

  track("workspace_setup_completed", { workspaceId: context.workspaceId });
  redirect("/dashboard/observe");
}
