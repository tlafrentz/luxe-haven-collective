"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createCommerceAccountAction, type CommerceAccountActionState } from "@/app/actions/commerce-account";
import { PublicAuthSubmitButton, TurnstileChallenge } from "@/components/auth/turnstile";
import { AuthCooldown } from "@/components/auth/auth-form-status";
import { useWorkspaceDraft } from "./use-workspace-draft";
import { isWorkspaceConfigComplete } from "./types";
import type { Plan } from "@/lib/plans";
import type { BillingCycle } from "@/components/marketing/billing-toggle";

const initialState: CommerceAccountActionState = {};

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="text-xs font-medium text-red-700">{errors[0]}</p>;
}

export function CreateAccountForm({ plan, billing }: { plan: Plan; billing: BillingCycle }) {
  const scope = `${plan.slug}:${billing}`;
  const { answers, draftReady } = useWorkspaceDraft(scope);
  const [state, action] = useActionState(createCommerceAccountAction, initialState);

  if (!draftReady) {
    return <div className="h-96" aria-hidden />;
  }

  if (!isWorkspaceConfigComplete(answers)) {
    return (
      <div className="rounded-2xl border border-[#dce2dd] bg-white p-8 text-center">
        <p className="text-sm text-stone-600">
          Let&apos;s configure your workspace first so we can personalize onboarding.
        </p>
        <Link
          href={`/commerce/configure-workspace?plan=${plan.slug}&billing=${billing}`}
          className="mt-5 inline-flex min-h-11 items-center rounded-md bg-emerald-900 px-5 text-sm font-semibold text-white"
        >
          Configure workspace
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#dce2dd] bg-white p-6 md:p-10">
      <h1 className="font-serif text-4xl">Create your account.</h1>
      {state.message ? (
        <div
          className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${
            state.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {state.message}
        </div>
      ) : null}
      <AuthCooldown seconds={state.retryAfterSeconds} attemptKey={state.correlationId} />
      <form action={action} className="mt-6 space-y-5">
        <input type="hidden" name="plan" value={plan.slug} />
        <input type="hidden" name="billing" value={billing} />
        <input type="hidden" name="workspaceDraft" value={JSON.stringify(answers)} />

        <label className="block text-sm font-medium text-stone-700">
          Full name
          <input
            name="fullName"
            autoComplete="name"
            required
            className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none ring-brass/20 focus:ring-4"
          />
          <FieldError errors={state.errors?.fullName} />
        </label>

        <label className="block text-sm font-medium text-stone-700">
          Email
          <input
            name="email"
            type="email"
            required
            className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none ring-brass/20 focus:ring-4"
          />
          <FieldError errors={state.errors?.email} />
        </label>

        <label className="block text-sm font-medium text-stone-700">
          Password
          <input
            name="password"
            type="password"
            minLength={8}
            required
            className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none ring-brass/20 focus:ring-4"
          />
          <FieldError errors={state.errors?.password} />
        </label>

        <label className="block text-sm font-medium text-stone-700">
          Confirm Password
          <input
            name="confirmPassword"
            type="password"
            minLength={8}
            required
            className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none ring-brass/20 focus:ring-4"
          />
          <FieldError errors={state.errors?.confirmPassword} />
        </label>

        <label className="flex items-start gap-3 text-sm text-stone-700">
          <input type="checkbox" name="termsAccepted" required className="mt-1" />
          <span>
            I agree to the{" "}
            <Link href="/terms" className="font-medium text-stone-950 underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="font-medium text-stone-950 underline">
              Privacy Policy
            </Link>
            .
          </span>
        </label>
        <FieldError errors={state.errors?.termsAccepted} />

        <TurnstileChallenge key={state.correlationId ?? "initial"} attemptKey={state.correlationId} />
        <PublicAuthSubmitButton>Create Account</PublicAuthSubmitButton>
        <p className="text-sm text-stone-600">
          Already have an account?{" "}
          <Link
            href={`/login?next=${encodeURIComponent(`/commerce/review?plan=${plan.slug}&billing=${billing}`)}`}
            className="font-medium text-stone-950"
          >
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
