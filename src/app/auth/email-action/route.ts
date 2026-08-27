import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  EMAIL_ACTION_COOKIE,
  passwordSetupCookieOptions,
} from "@/lib/auth/password-setup-grant";

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

  const store = await cookies();
  store.set(
    EMAIL_ACTION_COOKIE,
    Buffer.from(
      JSON.stringify({ tokenHash, type, redirectTo }),
      "utf8",
    ).toString("base64url"),
    { ...passwordSetupCookieOptions, maxAge: 5 * 60 },
  );
  return NextResponse.redirect(
    new URL("/auth/email-action/confirm", url.origin),
  );
}
