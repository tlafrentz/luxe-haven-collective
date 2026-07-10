"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInAction } from "@/app/actions/auth";
import { SubmitButton } from "@/components/forms/submit-button";
import { AuthFormStatus } from "@/components/auth/auth-form-status";

export function LoginForm() {
  const [state, action] = useActionState(signInAction, {});
  return (
    <form action={action} className="space-y-5">
      <AuthFormStatus state={state} />
      <label className="block text-sm font-medium text-stone-700">Email
        <input name="email" type="email" required className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none ring-brass/20 focus:ring-4" />
      </label>
      {state.errors?.email && <p className="text-sm text-red-600">{state.errors.email[0]}</p>}
      <label className="block text-sm font-medium text-stone-700">Password
        <input name="password" type="password" required className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none ring-brass/20 focus:ring-4" />
      </label>
      {state.errors?.password && <p className="text-sm text-red-600">{state.errors.password[0]}</p>}
      <div className="flex items-center justify-between text-sm">
        <Link href="/forgot-password" className="text-stone-600 underline underline-offset-4">Forgot password?</Link>
        <Link href="/register" className="font-medium text-stone-950">Create account</Link>
      </div>
     <SubmitButton>Sign in</SubmitButton>
    </form>
  );
}
