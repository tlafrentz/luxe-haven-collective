"use client";

import { useActionState } from "react";
import { forgotPasswordAction, updatePasswordAction } from "@/app/actions/auth";
import { SubmitButton } from "@/components/forms/submit-button";
import { AuthFormStatus } from "@/components/auth/auth-form-status";

export function ForgotPasswordForm() {
  const [state, action] = useActionState(forgotPasswordAction, {});
  return (
    <form action={action} className="space-y-5">
      <AuthFormStatus state={state} />
      <label className="block text-sm font-medium text-stone-700">Email
        <input name="email" type="email" required className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none ring-brass/20 focus:ring-4" />
      </label>
     <SubmitButton>Send reset link</SubmitButton>
    </form>
  );
}

export function UpdatePasswordForm() {
  const [state, action] = useActionState(updatePasswordAction, {});
  return (
    <form action={action} className="space-y-5">
      <AuthFormStatus state={state} />
      <label className="block text-sm font-medium text-stone-700">New password
        <input name="password" type="password" minLength={8} required className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none ring-brass/20 focus:ring-4" />
      </label>
     <SubmitButton>Update Password</SubmitButton>
    </form>
  );
}
