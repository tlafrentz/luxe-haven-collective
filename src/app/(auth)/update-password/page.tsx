import type { Metadata } from "next";
import Link from "next/link";
import { UpdatePasswordForm } from "@/components/auth/password-forms";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Update Password | Luxe Haven Collective" };

export default async function UpdatePasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <>
        <h2 className="font-serif text-3xl text-stone-950">
          Request a new password link
        </h2>
        <div
          className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950"
          role="alert"
        >
          This password link is missing, invalid, or expired. Request a new link
          and open it in the same browser where you want to reset your password.
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/forgot-password"
            className="rounded-full bg-stone-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-stone-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brass/30"
          >
            Request new link
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-stone-300 bg-white px-6 py-3 text-sm font-semibold text-stone-800 transition hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brass/30"
          >
            Return to sign in
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
        <UpdatePasswordForm />
      </div>
    </>
  );
}
