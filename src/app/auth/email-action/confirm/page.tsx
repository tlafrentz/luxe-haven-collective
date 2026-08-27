import Link from "next/link";

import { continueAuthenticationEmailAction } from "@/app/actions/auth-email-action";

export default function ConfirmAuthenticationEmailActionPage() {
  return (
    <main className="mx-auto max-w-lg px-5 py-20">
      <h1 className="font-serif text-4xl text-stone-950">
        Continue account setup
      </h1>
      <p className="mt-4 text-stone-600">
        Continue only if you requested this account action. Opening this page
        alone does not verify the email or grant access.
      </p>
      <form action={continueAuthenticationEmailAction} className="mt-8">
        <button
          type="submit"
          className="min-h-11 rounded-full bg-stone-950 px-6 font-semibold text-white"
        >
          Continue securely
        </button>
      </form>
      <Link
        href="/login"
        prefetch={false}
        className="mt-5 inline-block text-sm underline"
      >
        Return to sign in
      </Link>
    </main>
  );
}
