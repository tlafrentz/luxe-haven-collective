"use server";

import { randomUUID } from "node:crypto";
import { createClient as createIsolatedClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { decryptEmailActionToken, digestEmailActionValue, inspectEmailActionStateCookie } from "@/lib/auth/email-action-state";
import { evaluateRecoveryPreclaim } from "@/lib/auth/recovery-continuation";
import {
  createPasswordSetupGrant,
  EMAIL_ACTION_COOKIE,
  expiredEmailActionCookieOptions,
  PASSWORD_SETUP_FLOW_COOKIE,
  PASSWORD_SETUP_GRANT_COOKIE,
  passwordSetupCookieOptions,
} from "@/lib/auth/password-setup-grant";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type RejectionCode =
  | "ACTION_COOKIE_MISSING"
  | "ACTION_COOKIE_MALFORMED"
  | "ACTION_COOKIE_SIGNATURE_INVALID"
  | "ACTION_COOKIE_EXPIRED"
  | "ACTION_STATE_NOT_FOUND"
  | "ACTION_STATE_EXPIRED"
  | "ACTION_STATE_FLOW_MISMATCH"
  | "ACTION_STATE_BINDING_MISMATCH"
  | "ACTION_STATE_ALREADY_CLAIMED"
  | "CANONICAL_HOST_MISMATCH"
  | "EXISTING_SESSION_DIFFERENT_IDENTITY"
  | "STATE_CLAIM_REJECTED"
  | "RECOVERY_VERIFICATION_FAILED"
  | "RECOVERY_IDENTITY_MISMATCH"
  | "RECOVERY_GRANT_REJECTED"
  | "RECOVERY_SESSION_PERSIST_FAILED";

function recordRejection(code: RejectionCode, correlationId: string) {
  console.info("auth_recovery_continuation_rejected", {
    code,
    correlationId,
  });
}

export async function continueAuthenticationEmailAction(): Promise<never> {
  const correlationId = randomUUID();
  const store = await cookies();
  const encoded = store.get(EMAIL_ACTION_COOKIE)?.value;
  store.set(EMAIL_ACTION_COOKIE, "", expiredEmailActionCookieOptions);
  if (!encoded) {
    recordRejection("ACTION_COOKIE_MISSING", correlationId);
    redirect("/update-password?setup=invalid");
  }
  const cookieResult = inspectEmailActionStateCookie(encoded);
  if (!cookieResult.ok) {
    recordRejection(cookieResult.code, correlationId);
    redirect("/update-password?setup=invalid");
  }

  const canonical = new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  );
  const requestHeaders = await headers();
  const requestOrigin = requestHeaders.get("origin");
  if (!requestOrigin || new URL(requestOrigin).origin !== canonical.origin) {
    recordRejection("CANONICAL_HOST_MISMATCH", correlationId);
    redirect("/update-password?setup=invalid");
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: pendingState, error: stateError } = await admin
    .from("auth_email_action_states")
    .select(
      "id,flow,status,expires_at,version,browser_nonce_digest,auth_user_id,token_ciphertext,token_iv,token_tag,token_digest,redirect_to",
    )
    .eq("id", cookieResult.value.stateId)
    .maybeSingle();
  if (stateError || !pendingState) {
    recordRejection("ACTION_STATE_NOT_FOUND", correlationId);
    redirect("/update-password?setup=invalid");
  }
  if (pendingState.flow !== "recovery" && pendingState.flow !== "invite") {
    recordRejection("ACTION_STATE_FLOW_MISMATCH", correlationId);
    redirect("/update-password?setup=invalid");
  }
  const nonceDigest = digestEmailActionValue(cookieResult.value.browserNonce);

  if (pendingState.flow === "invite") {
    if (pendingState.expires_at <= now) {
      recordRejection("ACTION_STATE_EXPIRED", correlationId);
      redirect("/update-password?setup=invalid");
    }
    if (pendingState.status !== "pending") {
      recordRejection("ACTION_STATE_ALREADY_CLAIMED", correlationId);
      redirect("/update-password?setup=invalid");
    }
    if (pendingState.browser_nonce_digest !== nonceDigest) {
      recordRejection("ACTION_STATE_BINDING_MISMATCH", correlationId);
      redirect("/update-password?setup=invalid");
    }
    let invitationToken: string;
    try {
      invitationToken = decryptEmailActionToken({
        ciphertext: pendingState.token_ciphertext,
        iv: pendingState.token_iv,
        tag: pendingState.token_tag,
      });
      const invitationRedirect = new URL(pendingState.redirect_to);
      if (
        digestEmailActionValue(invitationToken) !== pendingState.token_digest ||
        invitationRedirect.origin !== canonical.origin ||
        invitationRedirect.pathname !== "/auth/callback"
      )
        throw new Error("INVITATION_STATE_INVALID");
    } catch {
      recordRejection("ACTION_STATE_BINDING_MISMATCH", correlationId);
      redirect("/update-password?setup=invalid");
    }
    const { data: claimedInvitation } = await admin
      .from("auth_email_action_states")
      .update({
        status: "claimed",
        claimed_at: now,
        claim_correlation: correlationId,
        version: pendingState.version + 1,
        updated_at: now,
      })
      .eq("id", pendingState.id)
      .eq("status", "pending")
      .eq("version", pendingState.version)
      .select("id")
      .maybeSingle();
    if (!claimedInvitation) {
      recordRejection("STATE_CLAIM_REJECTED", correlationId);
      redirect("/update-password?setup=invalid");
    }
    const provider = new URL(
      "/auth/v1/verify",
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
    );
    provider.searchParams.set("token", invitationToken);
    provider.searchParams.set("type", "invite");
    provider.searchParams.set("redirect_to", pendingState.redirect_to);
    redirect(provider.toString());
  }

  const supabase = await createClient();
  const {
    data: { user: existingUser },
  } = await supabase.auth.getUser();
  const preclaim = evaluateRecoveryPreclaim({
    state: {
      flow: pendingState.flow,
      status: pendingState.status,
      expiresAt: pendingState.expires_at,
      browserNonceDigest: pendingState.browser_nonce_digest,
      authUserId: pendingState.auth_user_id,
    },
    browserNonce: cookieResult.value.browserNonce,
    existingUserId: existingUser?.id ?? null,
    now: new Date(now),
  });
  if (!preclaim.ok) {
    recordRejection(preclaim.code, correlationId);
    redirect("/update-password?setup=invalid");
  }

  const { data: claimedState, error: claimError } = await admin.rpc(
    "claim_recovery_email_action_state" as never,
    {
      p_state_id: pendingState.id,
      p_browser_nonce_digest: preclaim.nonceDigest,
      p_expected_version: pendingState.version,
      p_correlation: correlationId,
    } as never,
  );
  const claimed = Array.isArray(claimedState) ? claimedState[0] : claimedState;
  if (claimError || !claimed) {
    recordRejection("STATE_CLAIM_REJECTED", correlationId);
    redirect("/update-password?setup=invalid");
  }

  let tokenHash: string;
  try {
    tokenHash = decryptEmailActionToken({
      ciphertext: claimed.token_ciphertext,
      iv: claimed.token_iv,
      tag: claimed.token_tag,
    });
    if (
      !/^[a-zA-Z0-9_-]{20,512}$/.test(tokenHash) ||
      digestEmailActionValue(tokenHash) !== claimed.token_digest
    )
      throw new Error("RECOVERY_TOKEN_INVALID");
  } catch {
    await admin
      .from("auth_email_action_states")
      .update({
        status: "rejected",
        failure_code: "ACTION_STATE_BINDING_MISMATCH",
        updated_at: new Date().toISOString(),
      })
      .eq("id", pendingState.id)
      .eq("status", "claimed");
    recordRejection("ACTION_STATE_BINDING_MISMATCH", correlationId);
    redirect("/update-password?setup=invalid");
  }

  const verifier = createIsolatedClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  );
  const verification = await verifier.auth.verifyOtp({
    token_hash: tokenHash,
    type: "recovery",
  });
  if (verification.error || !verification.data.user || !verification.data.session) {
    await admin
      .from("auth_email_action_states")
      .update({
        status: "verification_failed",
        failure_code: "RECOVERY_VERIFICATION_FAILED",
        updated_at: new Date().toISOString(),
      })
      .eq("id", pendingState.id)
      .eq("status", "claimed");
    recordRejection("RECOVERY_VERIFICATION_FAILED", correlationId);
    redirect("/update-password?setup=invalid");
  }
  if (verification.data.user.id !== claimed.auth_user_id) {
    await admin
      .from("auth_email_action_states")
      .update({
        status: "rejected",
        failure_code: "RECOVERY_IDENTITY_MISMATCH",
        updated_at: new Date().toISOString(),
      })
      .eq("id", pendingState.id)
      .eq("status", "claimed");
    recordRejection("RECOVERY_IDENTITY_MISMATCH", correlationId);
    redirect("/update-password?setup=invalid");
  }

  const grant = createPasswordSetupGrant();
  const grantResult = await admin.rpc(
    "issue_recovery_password_setup_grant_v2" as never,
    {
      p_action_state_id: pendingState.id,
      p_auth_user_id: verification.data.user.id,
      p_grant_hash: grant.hash,
      p_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    } as never,
  );
  if (grantResult.error) {
    recordRejection("RECOVERY_GRANT_REJECTED", correlationId);
    redirect("/update-password?setup=invalid");
  }

  const persisted = await supabase.auth.setSession({
    access_token: verification.data.session.access_token,
    refresh_token: verification.data.session.refresh_token,
  });
  const verifiedIdentity = await supabase.auth.getUser();
  if (
    persisted.error ||
    verifiedIdentity.error ||
    verifiedIdentity.data.user?.id !== verification.data.user.id
  ) {
    recordRejection("RECOVERY_SESSION_PERSIST_FAILED", correlationId);
    redirect("/update-password?setup=invalid");
  }

  store.set(
    PASSWORD_SETUP_GRANT_COOKIE,
    grant.token,
    passwordSetupCookieOptions,
  );
  store.set(
    PASSWORD_SETUP_FLOW_COOKIE,
    "recovery",
    passwordSetupCookieOptions,
  );
  redirect("/update-password?flow=recovery");
}
