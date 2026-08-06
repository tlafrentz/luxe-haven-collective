"use client";

import { useTransition } from "react";
import { skipSetupStepAction } from "@/app/actions/workspace-setup";

export function SkipTeamButton() {
  const [pending, startTransition] = useTransition();

  function handleSkip() {
    if (!window.confirm("Skip inviting your team for now? You can invite teammates later from Team & Access.")) {
      return;
    }
    startTransition(() => {
      skipSetupStepAction("team");
    });
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={handleSkip}
      className="inline-flex min-h-11 items-center rounded-full border border-stone-300 px-6 text-sm font-semibold text-stone-700 disabled:opacity-60"
    >
      Skip for now
    </button>
  );
}
