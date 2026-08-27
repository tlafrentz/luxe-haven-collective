import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { UpdatePasswordForm } from "@/components/auth/password-forms";
import {
  PASSWORD_SETUP_FLOW_COOKIE,
  PASSWORD_SETUP_GRANT_COOKIE,
  type PasswordSetupFlow,
} from "@/lib/auth/password-setup-grant";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Update Password | Luxe Haven Collective",
};

export default async function UpdatePasswordPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ flow?: string; setup?: string }>;
}>) {
  const parameters = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const store = await cookies();
  const grantToken = store.get(PASSWORD_SETUP_GRANT_COOKIE)?.value;
  const cookieFlow = store.get(PASSWORD_SETUP_FLOW_COOKIE)?.value;
  const flow: PasswordSetupFlow | null =
    cookieFlow === "invitation" || cookieFlow === "recovery"
      ? cookieFlow
      : null;
  const validation =
    user && grantToken && flow && parameters.flow === flow
      ? await supabase.rpc(
          "validate_password_setup_grant" as never,
          {
            p_grant_token: grantToken,
            p_flow: flow,
          } as never,
        )
      : { data: false, error: null };

  if (!user || !flow || validation.error || validation.data !== true) {
    return (
      <>
        <h2 className="font-serif text-3xl text-stone-950">
          Password setup unavailable
        </h2>
        <div
          className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950"
          role="alert"
        >
          This password setup link is invalid, expired, or already used. Return
          to sign in or contact support if you still need access.
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/login"
            className="rounded-full bg-stone-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-stone-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brass/30"
          >
            Return to sign in
          </Link>
          <Link
            href="/contact"
            className="rounded-full border border-stone-300 bg-white px-6 py-3 text-sm font-semibold text-stone-800 transition hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brass/30"
          >
            Contact support
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <h2 className="font-serif text-3xl text-stone-950">
        Choose a new password
      </h2>
      <p className="mt-3 text-stone-600">
        Set a new password for your Luxe Haven account.
      </p>
      <div className="mt-8">
        <UpdatePasswordForm flow={flow} />
      </div>
    </>
  );
}
