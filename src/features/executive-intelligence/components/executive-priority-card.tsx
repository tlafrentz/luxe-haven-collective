import Link from "next/link";

import {
  ArrowRight,
  BadgeDollarSign,
  CircleAlert,
  Gauge,
} from "lucide-react";

import type {
  ExecutivePriority,
} from "../domain";

type ExecutivePriorityCardProps = {
  priority: ExecutivePriority;
  reviewHref: string;
};

const severityClasses = {
  high: "border-rose-200 bg-rose-50 text-rose-700",
  medium:
    "border-amber-200 bg-amber-50 text-amber-700",
  low: "border-stone-200 bg-stone-50 text-stone-600",
};

function formatImpact(
  priority: ExecutivePriority,
) {
  const amount =
    priority.impact?.estimatedAmount;

  if (typeof amount === "number") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency:
        priority.impact?.currency ?? "USD",
      maximumFractionDigits: 0,
    }).format(amount);
  }

  const percentage =
    priority.impact?.estimatedPercentage;

  if (typeof percentage === "number") {
    return `${percentage.toFixed(1)}%`;
  }

  return null;
}

export function ExecutivePriorityCard({
  priority,
  reviewHref,
}: ExecutivePriorityCardProps) {
  const impact = formatImpact(priority);

  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:border-stone-300 hover:shadow-md">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-950 text-sm font-semibold text-white">
          {priority.rank}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={[
                "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
                severityClasses[priority.severity],
              ].join(" ")}
            >
              {priority.severity}
            </span>

            <span className="text-xs capitalize text-stone-500">
              {priority.pillar.replace("-", " ")}
            </span>
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-stone-950">
                {priority.title}
              </h3>

              <p className="mt-2 text-sm leading-6 text-stone-600">
                {priority.summary}
              </p>
            </div>

            {impact ? (
              <div className="shrink-0 rounded-xl bg-stone-100 px-3 py-2 text-right">
                <p className="text-xs text-stone-500">
                  Estimated impact
                </p>

                <p className="mt-1 font-semibold text-stone-950">
                  {impact}
                </p>
              </div>
            ) : null}
          </div>

          <div className="mt-4 grid gap-3 rounded-xl bg-stone-50 p-4 sm:grid-cols-2">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold text-stone-700">
                <Gauge className="h-3.5 w-3.5" />
                Why this matters
              </p>

              <p className="mt-1 text-xs leading-5 text-stone-500">
                {priority.rationale}
              </p>
            </div>

            <div>
              <p className="flex items-center gap-2 text-xs font-semibold text-stone-700">
                <CircleAlert className="h-3.5 w-3.5" />
                Recommended action
              </p>

              <p className="mt-1 text-xs leading-5 text-stone-500">
                {priority.action.summary}
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-4">
            <p className="flex items-center gap-2 text-xs text-stone-500">
              <BadgeDollarSign className="h-3.5 w-3.5" />
              {priority.confidence} confidence
            </p>

            <Link
              href={reviewHref}
              className="inline-flex items-center gap-2 text-sm font-semibold text-stone-950 transition hover:text-amber-700"
            >
              Review opportunity
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
