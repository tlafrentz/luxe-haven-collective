"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  decodeEmailActionStateCookie,
  decryptEmailActionToken,
  digestEmailActionValue,
} from "@/lib/auth/email-action-state";
import {
  createPasswordSetupGrant,
  EMAIL_ACTION_COOKIE,
  expiredPasswordSetupCookieOptions,
  PASSWORD_SETUP_FLOW_COOKIE,
  PASSWORD_SETUP_GRANT_COOKIE,
  passwordSetupCookieOptions,
} from "@/lib/auth/password-setup-grant";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function continueAuthenticationEmailAction(): Promise<never> {
  const store = await cookies();
  const encoded = store.get(EMAIL_ACTION_COOKIE)?.value;
  store.set(EMAIL_ACTION_COOKIE, "", expiredPasswordSetupCookieOptions);
  if (!encoded) redirect("/update-password?setup=invalid");
  const cookieState = decodeEmailActionStateCookie(encoded);
  if (!cookieState) redirect("/update-password?setup=invalid");

  const supabase = await createClient();
  const {
    data: { user: existingUser },
  } = await supabase.auth.getUser();
  if (existingUser) redirect("/update-password?setup=invalid");

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: action, error: claimError } = await admin
    .from("auth_email_action_states")
    .update({ status: "claimed", claimed_at: now, updated_at: now })
    .eq("id", cookieState.stateId)
    .eq("browser_nonce_digest", digestEmailActionValue(cookieState.browserNonce))
    .eq("status", "pending")
    .gt("expires_at", now)
    .select(
      "id,flow,token_ciphertext,token_iv,token_tag,token_digest,redirect_to",
    )
    .maybeSingle();
  if (claimError || !action) redirect("/update-password?setup=invalid");

  const failState = async () => {
    await admin
      .from("auth_email_action_states")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", action.id)
      .eq("status", "claimed");
  };
  let tokenHash: string;
  try {
    tokenHash = decryptEmailActionToken({
      ciphertext: action.token_ciphertext,
      iv: action.token_iv,
      tag: action.token_tag,
    });
    const redirectUrl = new URL(action.redirect_to);
    const siteUrl = new URL(
      process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    );
    if (
      !/^[a-zA-Z0-9_-]{20,512}$/.test(tokenHash) ||
      digestEmailActionValue(tokenHash) !== action.token_digest ||
      (action.flow !== "invite" && action.flow !== "recovery") ||
      redirectUrl.origin !== siteUrl.origin ||
      redirectUrl.pathname !== "/auth/callback"
    )
      throw new Error("EMAIL_ACTION_INVALID");
  } catch {
    await failState();
    redirect("/update-password?setup=invalid");
  }
  if (action.flow === "recovery") {
    const verification = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "recovery",
    });
    if (verification.error || !verification.data.user) {
      await failState();
      await supabase.auth.signOut({ scope: "local" });
      redirect("/update-password?setup=invalid");
    }

    const grant = createPasswordSetupGrant();
    const grantResult = await supabase.rpc(
      "issue_recovery_password_setup_grant" as never,
      {
        p_grant_hash: grant.hash,
        p_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      } as never,
    );
    if (grantResult.error) {
      await failState();
      await supabase.auth.signOut({ scope: "local" });
      redirect("/update-password?setup=invalid");
    }

    const { data: consumedState, error: consumeError } = await admin
      .from("auth_email_action_states")
      .update({
        status: "consumed",
        consumed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", action.id)
      .eq("status", "claimed")
      .select("id")
      .maybeSingle();
    if (consumeError || !consumedState) {
      await supabase.auth.signOut({ scope: "local" });
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
  const provider = new URL(
    "/auth/v1/verify",
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
  );
  provider.searchParams.set("token", tokenHash);
  provider.searchParams.set("type", action.flow);
  provider.searchParams.set("redirect_to", action.redirect_to);
  redirect(provider.toString());
}
