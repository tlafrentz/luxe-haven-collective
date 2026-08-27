"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { createWorkspaceInvitationToken } from "@/features/workspace/infrastructure/invitation-token";
import {
  createPasswordSetupGrant,
  PASSWORD_SETUP_FLOW_COOKIE,
  PASSWORD_SETUP_GRANT_COOKIE,
  passwordSetupCookieOptions,
} from "@/lib/auth/password-setup-grant";
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

  const grant = createPasswordSetupGrant();
  const grantResult = await client.rpc(
    "issue_invitation_password_setup_grant" as never,
    {
      p_workspace_id: invitation.workspace_id,
      p_invitation_token: secure.token,
      p_grant_hash: grant.hash,
      p_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    } as never,
  );
  if (grantResult.error)
    redirect("/dashboard?invitationRecovery=reconciliation-required");
  const store = await cookies();
  store.set(
    PASSWORD_SETUP_GRANT_COOKIE,
    grant.token,
    passwordSetupCookieOptions,
  );
  store.set(
    PASSWORD_SETUP_FLOW_COOKIE,
    "invitation",
    passwordSetupCookieOptions,
  );
  redirect("/update-password?flow=invitation");
}
