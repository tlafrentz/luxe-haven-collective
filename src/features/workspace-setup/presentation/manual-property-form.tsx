"use client";

import { useActionState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createManualPropertyAction } from "@/app/actions/workspace-setup";

const initialState: { ok?: boolean; message?: string } = {};

export function ManualPropertyForm({successHref}:{successHref?:string} = {}) {
  const [state, action] = useActionState(createManualPropertyAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      if(successHref) router.push(successHref); else router.refresh();
    }
  }, [state.ok, router, successHref]);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-6">
      <h2 className="font-semibold text-stone-950">Add a property manually</h2>
      {state.message ? (
        <p className={`mt-3 text-sm ${state.ok ? "text-emerald-700" : "text-red-700"}`} role="status">
          {state.message}
        </p>
      ) : null}
      <form ref={formRef} action={action} className="mt-4 grid gap-4 sm:grid-cols-3">
        <label className="block text-sm font-medium text-stone-700 sm:col-span-1">
          Property name
          <input
            name="name"
            required
            className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-stone-500"
          />
        </label>
        <label className="block text-sm font-medium text-stone-700">
          City
          <input
            name="city"
            className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-stone-500"
          />
        </label>
        <label className="block text-sm font-medium text-stone-700">
          State
          <input
            name="state"
            className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-stone-500"
          />
        </label>
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-stone-950 px-5 text-sm font-semibold text-white sm:col-span-3 sm:w-fit"
        >
          Add property
        </button>
      </form>
    </div>
  );
}
