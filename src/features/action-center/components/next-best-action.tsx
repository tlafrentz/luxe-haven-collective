import Link from "next/link";

import {
  ArrowRight,
  BadgeDollarSign,
  CircleGauge,
  Sparkles,
  UserRound,
} from "lucide-react";

import type {
  ActionCenterItem,
} from "../domain";

import {
  ActionPriorityBadge,
} from "./action-priority-badge";

import {
  ActionStatusBadge,
} from "./action-status-badge";

type NextBestActionProps = {
  action: ActionCenterItem;
};

function formatConfidence(
  confidence: NonNullable<
    ActionCenterItem["decisionContext"]
  >["confidence"],
): string {
  if (!confidence) {
    return "Not available";
  }

  return (
    confidence.charAt(0).toUpperCase() +
    confidence.slice(1)
  );
}

export function NextBestAction({
  action,
}: NextBestActionProps) {
  const context = action.decisionContext;

  return (
    <section className="overflow-hidden rounded-3xl border border-stone-800 bg-stone-950 text-white shadow-xl">
      <div className="p-6 sm:p-8">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
          <Sparkles className="h-4 w-4" />
          Next best action
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <ActionPriorityBadge
            priority={action.priority}
          />

          <ActionStatusBadge
            status={action.status}
          />
        </div>

        <div className="mt-6 grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
              Business outcome
            </p>

            <h2 className="mt-3 max-w-3xl text-2xl font-semibold tracking-tight sm:text-3xl">
              {context?.outcomeTitle ?? action.title}
            </h2>

            <p className="mt-4 max-w-2xl text-sm leading-6 text-stone-300 sm:text-base">
              {context?.whyNow ?? action.summary}
            </p>

            {context &&
            context.evidence.length > 0 ? (
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {context.evidence.map(
                  (item) => (
                    <div
                      key={item.label}
                      className="rounded-2xl border border-white/10 bg-white/[0.05] p-4"
                    >
                      <p className="text-xs text-stone-400">
                        {item.label}
                      </p>

                      <p className="mt-2 text-xl font-semibold text-white">
                        {item.value}
                      </p>
                    </div>
                  ),
                )}
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">
              Recommended action
            </p>

            <p className="mt-3 text-base font-semibold leading-6 text-white">
              {action.title}
            </p>

            <p className="mt-2 text-sm leading-6 text-stone-300">
              {action.summary}
            </p>

            <div className="mt-6 space-y-4 border-t border-white/10 pt-5">
              <div className="flex items-start justify-between gap-4">
                <p className="flex items-center gap-2 text-xs text-stone-400">
                  <UserRound className="h-4 w-4" />
                  Owner
                </p>

                <p className="text-right text-sm font-semibold text-white">
                  {action.ownerName}
                </p>
              </div>

              <div className="flex items-start justify-between gap-4">
                <p className="flex items-center gap-2 text-xs text-stone-400">
                  <BadgeDollarSign className="h-4 w-4" />
                  Expected impact
                </p>

                <p className="text-right text-sm font-semibold text-white">
                  {context?.expectedImpact ??
                    "Not estimated"}
                </p>
              </div>

              <div className="flex items-start justify-between gap-4">
                <p className="flex items-center gap-2 text-xs text-stone-400">
                  <CircleGauge className="h-4 w-4" />
                  Confidence
                </p>

                <p className="text-right text-sm font-semibold text-white">
                  {formatConfidence(
                    context?.confidence,
                  )}
                </p>
              </div>
            </div>

            <Link
              href={`/dashboard/actions/${action.id}`}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-stone-950 transition hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-2 focus:ring-offset-stone-950"
            >
              Open workspace
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
