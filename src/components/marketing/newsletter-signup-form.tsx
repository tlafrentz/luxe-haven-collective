"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { subscribeToNewsletterAction } from "@/app/actions/newsletter";
import type { FormState } from "@/app/actions/forms";

const initialState: FormState = { ok: false, message: "" };

function SubscribeButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-[#a56b19] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Joining..." : "Join the conversation"}
    </button>
  );
}

export function NewsletterSignupForm() {
  const [state, action] = useActionState(subscribeToNewsletterAction, initialState);

  return (
    <div>
      <form action={action} className="flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor="newsletter-email">
          Email address
        </label>
        <input
          id="newsletter-email"
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          className="w-full min-w-0 rounded-md border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/50 outline-none focus:border-white/50 sm:flex-1"
        />
        <SubscribeButton />
      </form>
      {state.message ? (
        <p
          className={
            state.ok ? "mt-3 text-xs font-medium text-emerald-200" : "mt-3 text-xs font-medium text-red-200"
          }
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
