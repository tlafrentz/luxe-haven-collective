import Link from "next/link";
import { CheckCircle2, Sparkles } from "lucide-react";

import type { ActionCenterSummary } from "../domain";

type ActionCenterHeaderProps = {
  summary: ActionCenterSummary;
};

export function ActionCenterHeader({ summary }: ActionCenterHeaderProps) {
  const activeCount = summary.ready + summary.inProgress + summary.blocked;

  return (
    <header className="space-y-6">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
            <Sparkles className="h-3.5 w-3.5" />
            Execute
          </div>

          <h1 className="mt-5 max-w-3xl text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">
            Action Center
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600 sm:text-base">
            Execute the highest-impact work across your hospitality portfolio, resolve blockers,
            and capture what improves performance.
          </p>
        </div>

        <div className="w-full shrink-0 rounded-2xl border border-stone-200 bg-white px-5 py-4 shadow-sm sm:w-auto sm:min-w-56">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Current workload
          </p>

          <p className="mt-2 text-2xl font-semibold text-stone-950">{activeCount} active</p>

          <p className="mt-1 text-xs text-stone-500">{summary.blocked} blocked</p>
        </div>
      </div>

      <nav aria-label="Execute workspace" className="flex gap-2 overflow-x-auto pb-1 text-sm">
        {[["Overview", "/dashboard/execute"], ["My Work", "/dashboard/execute?view=my-work"], ["All Actions", "/dashboard/execute?view=all"], ["Action Plans", "/dashboard/execute?view=plans"], ["Recurring", "/dashboard/execute?view=recurring"], ["Completed", "/dashboard/execute?view=completed"]].map(([label, href], index) => <Link key={label} className={`shrink-0 rounded-full px-4 py-2 font-semibold ${index === 0 ? "bg-stone-950 text-white" : "border bg-white text-stone-600"}`} href={href} aria-current={index === 0 ? "page" : undefined}>{label}</Link>)}
      </nav>
    </header>
  );
}
