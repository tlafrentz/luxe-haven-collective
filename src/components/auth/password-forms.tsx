"use client";

import { useActionState, useRef, useState } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import {
  forgotPasswordAction,
  updatePasswordAction,
  type AuthActionState,
} from "@/app/actions/auth";
import { SubmitButton } from "@/components/forms/submit-button";
import { AuthFormStatus } from "@/components/auth/auth-form-status";

export function ForgotPasswordForm() {
  const turnstileRef = useRef<TurnstileInstance>(null);
  const [captchaToken, setCaptchaToken] = useState("");
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const [state, action] = useActionState(async (
    previousState: AuthActionState,
    formData: FormData,
  ) => {
    const nextState = await forgotPasswordAction(previousState, formData);
    setCaptchaToken("");
    turnstileRef.current?.reset();
    return nextState;
  }, {});

  return (
    <form action={action} className="space-y-5">
      <AuthFormStatus state={state} />
      <label className="block text-sm font-medium text-stone-700">
        Email
        <input
          name="email"
          type="email"
          required
          className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none ring-brass/20 focus:ring-4"
        />
      </label>
      <input type="hidden" name="captchaToken" value={captchaToken} />
      {siteKey ? (
        <Turnstile
          ref={turnstileRef}
          siteKey={siteKey}
          onSuccess={setCaptchaToken}
          onExpire={() => setCaptchaToken("")}
          onError={() => setCaptchaToken("")}
          options={{ action: "password_reset", theme: "light" }}
        />
      ) : (
        <p role="alert" className="text-sm text-red-600">
          Password reset is temporarily unavailable.
        </p>
      )}
      <SubmitButton disabled={!siteKey || !captchaToken}>
        Send reset link
      </SubmitButton>
    </form>
  );
}

export function UpdatePasswordForm({
  flow,
}: Readonly<{ flow: "invitation" | "recovery" }>) {
  const [state, action] = useActionState(updatePasswordAction, {});
  return (
    <form action={action} className="space-y-5">
      <AuthFormStatus state={state} />
      <input type="hidden" name="flow" value={flow} />
      <label className="block text-sm font-medium text-stone-700">
        New password
        <input
          name="password"
          type="password"
          minLength={8}
          required
          className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none ring-brass/20 focus:ring-4"
        />
      </label>
      <SubmitButton>Update Password</SubmitButton>
    </form>
  );
}
