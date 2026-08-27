import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  EMAIL_ACTION_COOKIE,
  passwordSetupCookieOptions,
} from "@/lib/auth/password-setup-grant";
import {
  createEmailActionBrowserNonce,
  digestEmailActionValue,
  encodeEmailActionStateCookie,
  encryptEmailActionToken,
} from "@/lib/auth/email-action-state";
import { createAdminClient } from "@/lib/supabase/admin";

function validRedirect(value: string | null, origin: string): string | null {
  if (!value) return null;
  try {
    const target = new URL(value);
    return target.origin === origin && target.pathname === "/auth/callback"
      ? target.toString()
      : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const redirectTo = validRedirect(
    url.searchParams.get("redirect_to"),
    url.origin,
  );
  if (
    !tokenHash ||
    !/^[a-zA-Z0-9_-]{20,512}$/.test(tokenHash) ||
    (type !== "invite" && type !== "recovery") ||
    !redirectTo
  )
    return NextResponse.redirect(
      new URL("/update-password?setup=invalid", url.origin),
    );

  const browserNonce = createEmailActionBrowserNonce();
  const encrypted = encryptEmailActionToken(tokenHash);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const { data: state, error } = await createAdminClient()
    .from("auth_email_action_states")
    .insert({
      flow: type,
      token_ciphertext: encrypted.ciphertext,
      token_iv: encrypted.iv,
      token_tag: encrypted.tag,
      token_digest: digestEmailActionValue(tokenHash),
      browser_nonce_digest: digestEmailActionValue(browserNonce),
      redirect_to: redirectTo,
      expires_at: expiresAt,
    })
    .select("id")
    .single();
  if (error || !state)
    return NextResponse.redirect(
      new URL("/update-password?setup=invalid", url.origin),
    );

  const store = await cookies();
  store.set(
    EMAIL_ACTION_COOKIE,
    encodeEmailActionStateCookie({
      stateId: state.id,
      browserNonce,
    }),
    { ...passwordSetupCookieOptions, maxAge: 5 * 60 },
  );
  return NextResponse.redirect(
    new URL("/auth/email-action/confirm", url.origin),
  );
}
