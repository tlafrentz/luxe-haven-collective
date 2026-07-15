import {
  CheckCircle2,
  Sparkles,
} from "lucide-react";

import type {
  ActionCenterSummary,
} from "../domain";

type ActionCenterHeaderProps = {
  summary: ActionCenterSummary;
};

export function ActionCenterHeader({
  summary,
}: ActionCenterHeaderProps) {
  const activeCount =
    summary.accepted +
    summary.inProgress +
    summary.blocked;

  return (
    <header className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
          <Sparkles className="h-3.5 w-3.5" />
          Execution workspace
        </div>

        <h1 className="mt-5 max-w-3xl text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">
        Turn recommendations into business outcomes.
        </h1>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600 sm:text-base">
        Execute the highest-impact work across your
hospitality portfolio, resolve blockers, and
capture what improves performance.
        </p>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white px-5 py-4 shadow-sm">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          Current workload
        </p>

        <p className="mt-2 text-2xl font-semibold text-stone-950">
          {activeCount} active
        </p>

        <p className="mt-1 text-xs text-stone-500">
          {summary.blocked} blocked
        </p>
      </div>
    </header>
  );
}
