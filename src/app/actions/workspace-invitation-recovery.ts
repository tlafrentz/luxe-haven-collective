"use server";

import { redirect } from "next/navigation";

import { createWorkspaceInvitationToken } from "@/features/workspace/infrastructure/invitation-token";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function resumeBoundWorkspaceInvitationAction(): Promise<never> {
  await requireUser();
  const secure = createWorkspaceInvitationToken();
  const correlationId = crypto.randomUUID();
  const idempotencyKey = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const client = await createClient();
  const { data, error } = await client.rpc(
    "rotate_bound_workspace_invitation_token" as never,
    {
      p_token_hash: secure.hash,
      p_expires_at: expiresAt,
      p_correlation_id: correlationId,
      p_idempotency_key: idempotencyKey,
    } as never,
  );
  if (error || !data) redirect("/dashboard?invitationRecovery=unavailable");

  const invitation = data as Readonly<{
    workspace_id: string;
    token_hash: string;
  }>;
  if (invitation.token_hash !== secure.hash)
    redirect("/dashboard?invitationRecovery=reconciliation-required");

  const query = new URLSearchParams({
    workspace: invitation.workspace_id,
    token: secure.token,
  });
  redirect(`/workspace-invitations/accept?${query.toString()}`);
}
