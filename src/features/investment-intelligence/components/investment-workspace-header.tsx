"use client";

import { RotateCcw } from "lucide-react";

import { useInvestmentWorkspaceState } from "./investment-workspace-state";

export function InvestmentWorkspaceHeader() {
  const { values, draftPersistence, clearDraft } = useInvestmentWorkspaceState();
  const strategy = values.acquisitionType === "purchase" ? "Purchase" : "Rental Arbitrage";

  const startOver = () => {
    if (!window.confirm("Start over with a new draft? Unsaved inputs in this current draft will be cleared. Saved scenarios, opportunities, analysis versions, reports, exports, and shares will not be changed.")) return;
    clearDraft();
    const url = new URL(window.location.href);
    url.searchParams.delete("step");
    url.searchParams.delete("strategy");
    window.history.pushState({}, "", url);
  };

  return (
    <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">Investment Intelligence</p>
        <h1 className="mt-2 max-w-4xl font-serif text-3xl tracking-tight text-neutral-950 sm:text-5xl">Let’s build the investment case.</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-600">Move from a property and strategy to transparent market evidence, financial outcomes, and a recommendation you can explain.</p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <div aria-live="polite" className="text-right text-xs text-neutral-600">
          <p className="font-semibold text-neutral-900">{strategy} draft</p>
          <p>{draftStatus(draftPersistence)}</p>
        </div>
        <button type="button" onClick={startOver} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-900 outline-none focus-visible:ring-2 focus-visible:ring-teal-600">
          <RotateCcw aria-hidden="true" className="h-4 w-4" /> Start over
        </button>
      </div>
    </header>
  );
}

function draftStatus(state: ReturnType<typeof useInvestmentWorkspaceState>["draftPersistence"]) {
  if (state.status === "restoring") return "Restoring saved draft…";
  if (state.status === "saving") return "Saving draft…";
  if (state.status === "failed") return "Draft could not be saved. You can continue editing.";
  if (state.status === "unavailable") return "This analysis is not stored as a draft.";
  if (state.savedAt) return `Saved ${new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(state.savedAt)}`;
  return "Draft ready";
}
