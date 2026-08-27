import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  EMAIL_ACTION_COOKIE,
  emailActionCookieOptions,
} from "@/lib/auth/password-setup-grant";
import {
  createEmailActionBrowserNonce,
  digestEmailActionValue,
  encodeEmailActionStateCookie,
  encryptEmailActionToken,
} from "@/lib/auth/email-action-state";
import { createAdminClient } from "@/lib/supabase/admin";

const sensitiveResponseHeaders = {
  "Cache-Control": "no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

function sensitiveRedirect(target: URL, status: 303 | 307 = 303) {
  return NextResponse.redirect(target, {
    status,
    headers: sensitiveResponseHeaders,
  });
}

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
  const canonical = new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  );
  if (process.env.VERCEL_ENV === "preview")
    return sensitiveRedirect(
      new URL("/update-password?setup=invalid", canonical.origin),
    );
  if (url.origin !== canonical.origin) {
    const target = new URL(`${url.pathname}${url.search}`, canonical.origin);
    return sensitiveRedirect(target, 307);
  }
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
    return sensitiveRedirect(
      new URL("/update-password?setup=invalid", url.origin),
    );

  const admin = createAdminClient();
  let recoveryRequest: { id: string; auth_user_id: string } | null = null;
  if (type === "recovery") {
    const recoveryRequestId = new URL(redirectTo).searchParams.get(
      "recovery_request",
    );
    if (!recoveryRequestId || !/^[0-9a-f-]{36}$/i.test(recoveryRequestId))
      return sensitiveRedirect(
        new URL("/update-password?setup=invalid", url.origin),
      );
    const result = await admin
      .from("auth_recovery_requests")
      .select("id,auth_user_id")
      .eq("id", recoveryRequestId)
      .eq("status", "emailed")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (result.error || !result.data)
      return sensitiveRedirect(
        new URL("/update-password?setup=invalid", url.origin),
      );
    recoveryRequest = result.data;
  }

  const browserNonce = createEmailActionBrowserNonce();
  const encrypted = encryptEmailActionToken(tokenHash);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const { data: state, error } = await admin
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
      recovery_request_id: recoveryRequest?.id ?? null,
      auth_user_id: recoveryRequest?.auth_user_id ?? null,
    })
    .select("id")
    .single();
  if (error || !state)
    return sensitiveRedirect(
      new URL("/update-password?setup=invalid", url.origin),
    );

  const store = await cookies();
  store.set(
    EMAIL_ACTION_COOKIE,
    encodeEmailActionStateCookie({
      version: 1,
      stateId: state.id,
      browserNonce,
      expiresAt: Date.parse(expiresAt),
    }),
    emailActionCookieOptions,
  );
  return sensitiveRedirect(
    new URL("/auth/email-action/confirm", url.origin),
  );
}
