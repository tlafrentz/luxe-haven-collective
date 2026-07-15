import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  PlayCircle,
} from "lucide-react";

import type {
  ActionCenterSummary,
} from "../domain";

type ExecutionSummaryProps = {
  summary: ActionCenterSummary;
};

const summaryItems = [
  {
    key: "accepted",
    label: "Ready to start",
    icon: CircleDot,
  },
  {
    key: "inProgress",
    label: "In progress",
    icon: PlayCircle,
  },
  {
    key: "blocked",
    label: "Blocked",
    icon: AlertTriangle,
  },
  {
    key: "completed",
    label: "Completed",
    icon: CheckCircle2,
  },
] as const;

export function ExecutionSummary({
  summary,
}: ExecutionSummaryProps) {
  return (
    <section
      aria-label="Execution overview"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      {summaryItems.map((item) => {
        const Icon = item.icon;

        return (
          <div
            key={item.key}
            className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                {item.label}
              </p>

              <Icon className="h-4 w-4 text-stone-400" />
            </div>

            <p className="mt-5 text-3xl font-semibold tracking-tight text-stone-950">
              {summary[item.key]}
            </p>
          </div>
        );
      })}
    </section>
  );
}
