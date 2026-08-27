"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  createPasswordSetupGrant,
  EMAIL_ACTION_COOKIE,
  expiredPasswordSetupCookieOptions,
  PASSWORD_SETUP_FLOW_COOKIE,
  PASSWORD_SETUP_GRANT_COOKIE,
  passwordSetupCookieOptions,
} from "@/lib/auth/password-setup-grant";
import { createClient } from "@/lib/supabase/server";

type EmailAction = Readonly<{
  tokenHash: string;
  type: "invite" | "recovery";
  redirectTo: string;
}>;

export async function continueAuthenticationEmailAction(): Promise<never> {
  const store = await cookies();
  const encoded = store.get(EMAIL_ACTION_COOKIE)?.value;
  store.set(EMAIL_ACTION_COOKIE, "", expiredPasswordSetupCookieOptions);
  if (!encoded) redirect("/update-password?setup=invalid");
  let action: EmailAction;
  try {
    action = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as EmailAction;
    const redirectUrl = new URL(action.redirectTo);
    const siteUrl = new URL(
      process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    );
    if (
      !/^[a-zA-Z0-9_-]{20,512}$/.test(action.tokenHash) ||
      (action.type !== "invite" && action.type !== "recovery") ||
      redirectUrl.origin !== siteUrl.origin ||
      redirectUrl.pathname !== "/auth/callback"
    )
      throw new Error("EMAIL_ACTION_INVALID");
  } catch {
    redirect("/update-password?setup=invalid");
  }
  if (action.type === "recovery") {
    const supabase = await createClient();
    const {
      data: { user: existingUser },
    } = await supabase.auth.getUser();
    if (existingUser) redirect("/update-password?setup=invalid");

    const verification = await supabase.auth.verifyOtp({
      token_hash: action.tokenHash,
      type: "recovery",
    });
    if (verification.error || !verification.data.user) {
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
  provider.searchParams.set("token", action.tokenHash);
  provider.searchParams.set("type", action.type);
  provider.searchParams.set("redirect_to", action.redirectTo);
  redirect(provider.toString());
}
