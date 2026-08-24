"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { initializeWorkspaceAction } from "@/app/actions/workspace";

export function InitializeWorkspaceForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState(initializeWorkspaceAction, {});
  useEffect(() => {
    if (!state.ok) return;
    router.replace("/dashboard/workspace");
    router.refresh();
  }, [router, state.ok]);
  return <form action={action} className="mt-6">
    <button type="submit" disabled={pending} aria-disabled={pending} className="inline-flex min-h-11 items-center rounded-full bg-white px-5 text-sm font-semibold text-stone-950 disabled:opacity-60">
      {pending ? "Setting up workspace…" : "Set up workspace"}
    </button>
    <p role="status" aria-live="polite" className="mt-3 text-sm text-red-200">{state.ok === false ? state.message : null}</p>
  </form>;
}
