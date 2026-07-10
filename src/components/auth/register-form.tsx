"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerAction } from "@/app/actions/auth";
import { SubmitButton } from "@/components/forms/submit-button";
import { AuthFormStatus } from "@/components/auth/auth-form-status";

export function RegisterForm() {
  const [state, action] = useActionState(registerAction, {});
  return (
    <form action={action} className="space-y-5">
      <AuthFormStatus state={state} />
      <label className="block text-sm font-medium text-stone-700">Full name
        <input name="fullName" required className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none ring-brass/20 focus:ring-4" />
      </label>
      <label className="block text-sm font-medium text-stone-700">Email
        <input name="email" type="email" required className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none ring-brass/20 focus:ring-4" />
      </label>
      <label className="block text-sm font-medium text-stone-700">Password
        <input name="password" type="password" minLength={8} required className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none ring-brass/20 focus:ring-4" />
      </label>
      <label className="block text-sm font-medium text-stone-700">Account type
        <select name="role" defaultValue="owner" className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none ring-brass/20 focus:ring-4">
          <option value="owner">Property owner</option>
          <option value="guest">Guest</option>
        </select>
      </label>
      {state.message ? null : <p className="text-sm text-stone-500">Admin and team roles are assigned internally after account creation.</p>}
      <SubmitButton>Create account</SubmitButton>
      <p className="text-sm text-stone-600">Already have an account? <Link href="/login" className="font-medium text-stone-950">Sign in</Link></p>
    </form>
  );
}
