import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeInternalDestination } from "@/lib/auth/post-login-destination";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeInternalDestination(requestUrl.searchParams.get("next")) ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      const recoveryUrl = new URL("/update-password", requestUrl.origin);
      recoveryUrl.searchParams.set("recovery", "invalid");
      return NextResponse.redirect(recoveryUrl);
    }
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
