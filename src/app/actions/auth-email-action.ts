"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  EMAIL_ACTION_COOKIE,
  expiredPasswordSetupCookieOptions,
} from "@/lib/auth/password-setup-grant";

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
  const provider = new URL(
    "/auth/v1/verify",
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
  );
  provider.searchParams.set("token", action.tokenHash);
  provider.searchParams.set("type", action.type);
  provider.searchParams.set("redirect_to", action.redirectTo);
  redirect(provider.toString());
}
