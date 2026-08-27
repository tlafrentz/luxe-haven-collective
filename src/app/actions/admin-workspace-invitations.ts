"use server";

import { z } from "zod";
import { createWorkspaceInvitationToken } from "@/features/workspace/infrastructure/invitation-token";
import { safeInternalDestination } from "@/lib/auth/post-login-destination";
import { requireRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const inputSchema = z.object({
  workspaceId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email(),
  reason: z.string().trim().min(8).max(500),
  correlationId: z.string().uuid(),
  idempotencyKey: z.string().min(16).max(200),
  confirmation: z.literal("INVITE_CONTROLLED_OWNER"),
});
export type AdminWorkspaceInvitationResult = Readonly<{
  ok: boolean;
  code: string;
  message: string;
  invitationId?: string;
}>;

function wasAuthUserCreatedByInvitation(
  authUser: Readonly<{
    created_at?: string;
    user_metadata?: Record<string, unknown>;
  }>,
  invitationId: string,
  commandStartedAt: number,
): boolean {
  const createdAt = Date.parse(authUser.created_at ?? "");
  return (
    authUser.user_metadata?.workspace_invitation_id === invitationId &&
    Number.isFinite(createdAt) &&
    createdAt >= commandStartedAt - 5_000
  );
}

export async function inviteControlledWorkspaceOwnerAction(
  raw: z.input<typeof inputSchema>,
): Promise<AdminWorkspaceInvitationResult> {
  const commandStartedAt = Date.now();
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success)
    return {
      ok: false,
      code: "INVITATION_INPUT_INVALID",
      message: "Review the controlled invitation details.",
    };
  const { user } = await requireRole(["admin"]),
    input = parsed.data,
    secure = createWorkspaceInvitationToken(),
    expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    authenticated = await createClient();
  const { data, error } = await authenticated.rpc(
    "create_admin_workspace_owner_invitation" as never,
    {
      p_workspace_id: input.workspaceId,
      p_email: input.email,
      p_token_hash: secure.hash,
      p_expires_at: expiresAt,
      p_correlation_id: input.correlationId,
      p_idempotency_key: input.idempotencyKey,
      p_reason: input.reason,
    } as never,
  );
  if (error || !data)
    return {
      ok: false,
      code: "INVITATION_NOT_CREATED",
      message: "The controlled invitation was not created.",
    };
  const invitation = data as Readonly<{
    id: string;
    status: string;
    email: string;
    token_hash: string;
  }>;
  if (invitation.status !== "pending" || invitation.email !== input.email)
    return {
      ok: false,
      code: "INVITATION_RECONCILIATION_REQUIRED",
      message: "The controlled invitation requires reconciliation.",
    };
  if (invitation.token_hash !== secure.hash)
    return {
      ok: true,
      code: "INVITATION_REPLAYED",
      message:
        "The existing controlled owner invitation remains authoritative.",
      invitationId: invitation.id,
    };
  const acceptPath = `/workspace-invitations/accept?workspace=${encodeURIComponent(input.workspaceId)}&token=${encodeURIComponent(secure.token)}`,
    passwordPath = `/update-password?next=${encodeURIComponent(acceptPath)}`,
    safePasswordPath = safeInternalDestination(passwordPath);
  if (!safePasswordPath)
    throw new Error("ADMIN_WORKSPACE_INVITATION_REDIRECT_INVALID");
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    admin = createAdminClient();
  const invited = await admin.auth.admin.inviteUserByEmail(input.email, {
    data: {
      full_name: "Luxe Haven controlled owner",
      role: "owner",
      workspace_invitation_id: invitation.id,
      workspace_id: input.workspaceId,
      verification_contract: "AUTH-EMAIL-001",
    },
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safePasswordPath)}`,
  });
  if (invited.error || !invited.data.user?.id) {
    await admin.rpc(
      "revoke_admin_workspace_invitation_delivery_failure" as never,
      {
        p_invitation_id: invitation.id,
        p_correlation_id: input.correlationId,
      } as never,
    );
    console.error("admin_workspace_invitation_delivery_failed", {
      actorId: user.id,
      invitationId: invitation.id,
      correlationId: input.correlationId,
      errorCode: invited.error?.code ?? "missing-auth-user",
    });
    return {
      ok: false,
      code: "INVITATION_DELIVERY_FAILED",
      message: "The invitation was not delivered and no access was granted.",
    };
  }
  const bound = await admin.rpc(
    "bind_admin_workspace_invitation_auth_user" as never,
    {
      p_invitation_id: invitation.id,
      p_auth_user_id: invited.data.user.id,
      p_correlation_id: input.correlationId,
    } as never,
  );
  if (bound.error) {
    // inviteUserByEmail normally rejects an existing Auth identity. Still, a
    // cleanup delete is permitted only when the returned identity carries the
    // fresh server-authored invitation binding and was created by this command.
    // This prevents a delivery/binding failure from deleting a pre-existing user.
    if (
      wasAuthUserCreatedByInvitation(
        invited.data.user,
        invitation.id,
        commandStartedAt,
      )
    )
      await admin.auth.admin.deleteUser(invited.data.user.id);
    await admin.rpc(
      "revoke_admin_workspace_invitation_delivery_failure" as never,
      {
        p_invitation_id: invitation.id,
        p_correlation_id: input.correlationId,
      } as never,
    );
    return {
      ok: false,
      code: "INVITATION_BIND_FAILED",
      message: "The invitation was revoked before access could be granted.",
    };
  }
  return {
    ok: true,
    code: "INVITATION_SENT",
    message: "The controlled owner invitation was sent.",
    invitationId: invitation.id,
  };
}
