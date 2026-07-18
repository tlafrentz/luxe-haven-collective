"use client";

import {
  useInvestmentWorkspaceState,
} from "./investment-workspace-state";

export function DecisionReadinessCard() {
  const {
    readinessGroups,
    completedReadinessCount,
    totalReadinessCount,
    isReadyForAnalysis,
  } = useInvestmentWorkspaceState();

  const completionPercentage =
    totalReadinessCount === 0
      ? 0
      : (
          completedReadinessCount /
          totalReadinessCount
        ) * 100;

  return (
    <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
            Analysis readiness
          </p>

          <h3 className="mt-2 text-lg font-semibold tracking-tight text-neutral-950">
            {isReadyForAnalysis
              ? "Ready to analyze the opportunity."
              : "Complete the remaining assumptions."}
          </h3>

          <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-600">
            {isReadyForAnalysis
              ? "The required property, capital, revenue, and operating inputs are complete."
              : "The analysis will become available once every required underwriting group is complete."}
          </p>
        </div>

        <span
          className={
            isReadyForAnalysis
              ? "rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800"
              : "rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800"
          }
        >
          {completedReadinessCount} /{" "}
          {totalReadinessCount}
        </span>
      </div>

      <div
        className="mt-5 h-2 overflow-hidden rounded-full bg-neutral-100"
        aria-hidden="true"
      >
        <div
          className={
            isReadyForAnalysis
              ? "h-full rounded-full bg-emerald-500 transition-all duration-300"
              : "h-full rounded-full bg-neutral-950 transition-all duration-300"
          }
          style={{
            width: `${completionPercentage}%`,
          }}
        />
      </div>

      <p className="sr-only">
        {Math.round(completionPercentage)}%
        complete
      </p>

      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {readinessGroups.map(
          ({
            id,
            label,
            isComplete,
          }) => (
            <li
              key={id}
              className={[
                "flex items-center gap-3 rounded-xl border px-3 py-3 text-sm",
                isComplete
                  ? "border-emerald-100 bg-emerald-50/60 text-neutral-800"
                  : "border-neutral-200 bg-neutral-50 text-neutral-600",
              ].join(" ")}
            >
              <span
                aria-hidden="true"
                className={
                  isComplete
                    ? "flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700"
                    : "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-neutral-300 text-xs text-neutral-400"
                }
              >
                {isComplete ? "✓" : "•"}
              </span>

              <span className="font-medium">
                {label}
              </span>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}
