"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  createFurnishingAccountAction,
  type FurnishingAccountActionState,
} from "@/app/actions/furnishing-commerce";
import { SubmitButton } from "@/components/forms/submit-button";

const initialState: FurnishingAccountActionState = {};

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="text-xs font-medium text-red-700">{errors[0]}</p>;
}

export function FurnishingCreateAccountForm({
  next,
  signInHref,
}: {
  next: string;
  signInHref: string;
}) {
  const [state, action] = useActionState(
    createFurnishingAccountAction,
    initialState,
  );

  return (
    <div>
      {state.message ? (
        <div
          className={`mb-5 rounded-2xl border px-4 py-3 text-sm ${
            state.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {state.message}
        </div>
      ) : null}
      <form action={action} className="space-y-5">
        <input type="hidden" name="next" value={next} />

        <label className="block text-sm font-medium text-stone-700">
          Email address
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

        <SubmitButton>Create Account</SubmitButton>
        <p className="text-sm text-stone-600">
          Already have an account?{" "}
          <Link href={signInHref} className="font-medium text-stone-950">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
