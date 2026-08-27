import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  createPasswordSetupGrant,
  expiredPasswordSetupCookieOptions,
  PASSWORD_SETUP_FLOW_COOKIE,
  PASSWORD_SETUP_GRANT_COOKIE,
  passwordSetupCookieOptions,
  type PasswordSetupFlow,
} from "@/lib/auth/password-setup-grant";
import { safeInternalDestination } from "@/lib/auth/post-login-destination";
import { createClient } from "@/lib/supabase/server";

type InvitationContinuation = Readonly<{
  workspaceId: string;
  invitationToken: string;
}>;

function invitationContinuation(
  value: string | null,
): InvitationContinuation | null {
  const safe = safeInternalDestination(value);
  if (!safe) return null;
  const passwordUrl = new URL(safe, "https://luxe-haven.local");
  if (passwordUrl.pathname !== "/update-password") return null;
  const continuation = safeInternalDestination(
    passwordUrl.searchParams.get("next"),
  );
  if (!continuation) return null;
  const invitationUrl = new URL(continuation, "https://luxe-haven.local");
  if (invitationUrl.pathname !== "/workspace-invitations/accept") return null;
  const workspaceId = invitationUrl.searchParams.get("workspace");
  const invitationToken = invitationUrl.searchParams.get("token");
  return workspaceId && invitationToken
    ? { workspaceId, invitationToken }
    : null;
}

async function clearSetupCookies() {
  const store = await cookies();
  store.set(PASSWORD_SETUP_GRANT_COOKIE, "", expiredPasswordSetupCookieOptions);
  store.set(PASSWORD_SETUP_FLOW_COOKIE, "", expiredPasswordSetupCookieOptions);
}

async function invalidSetupResponse(
  requestUrl: URL,
  supabase: Awaited<ReturnType<typeof createClient>>,
  clearAttemptSession: boolean,
) {
  if (clearAttemptSession) await supabase.auth.signOut({ scope: "local" });
  await clearSetupCookies();
  return NextResponse.redirect(
    new URL("/update-password?setup=invalid", requestUrl.origin),
  );
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const requestedNext = requestUrl.searchParams.get("next");
  const invitation = invitationContinuation(requestedNext);
  const flow: PasswordSetupFlow | null = invitation
    ? "invitation"
    : safeInternalDestination(requestedNext) === "/update-password"
      ? "recovery"
      : null;
  const next = safeInternalDestination(requestedNext) ?? "/dashboard";
  const supabase = await createClient();
  const {
    data: { user: existingUser },
  } = await supabase.auth.getUser();

  // A sensitive callback never overwrites or borrows an unrelated session.
  if (flow && existingUser)
    return invalidSetupResponse(requestUrl, supabase, false);
  if (!code)
    return flow
      ? invalidSetupResponse(requestUrl, supabase, false)
      : NextResponse.redirect(new URL(next, requestUrl.origin));

  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) return invalidSetupResponse(requestUrl, supabase, false);
  if (!flow) return NextResponse.redirect(new URL(next, requestUrl.origin));

  const grant = createPasswordSetupGrant();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const result =
    flow === "invitation" && invitation
      ? await supabase.rpc(
          "issue_invitation_password_setup_grant" as never,
          {
            p_workspace_id: invitation.workspaceId,
            p_invitation_token: invitation.invitationToken,
            p_grant_hash: grant.hash,
            p_expires_at: expiresAt,
          } as never,
        )
      : await supabase.rpc(
          "issue_recovery_password_setup_grant" as never,
          { p_grant_hash: grant.hash, p_expires_at: expiresAt } as never,
        );
  if (result.error) return invalidSetupResponse(requestUrl, supabase, true);

  const store = await cookies();
  store.set(
    PASSWORD_SETUP_GRANT_COOKIE,
    grant.token,
    passwordSetupCookieOptions,
  );
  store.set(PASSWORD_SETUP_FLOW_COOKIE, flow, passwordSetupCookieOptions);
  return NextResponse.redirect(
    new URL(`/update-password?flow=${flow}`, requestUrl.origin),
  );
}
