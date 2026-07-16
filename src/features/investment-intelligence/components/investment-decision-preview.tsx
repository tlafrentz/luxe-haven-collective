"use client";

import {
  InvestmentReport,
} from "./investment-report";

import {
  useInvestmentWorkspaceState,
} from "./investment-workspace-state";

const REPORT_OUTPUTS = [
  "Acquisition recommendation",
  "Investment score",
  "Decision confidence",
  "Projected financial performance",
  "Comparable property analysis",
  "Supporting evidence",
  "Risks and mitigations",
] as const;

export function InvestmentDecisionPreview() {
  const {
    decision,
    isAnalyzing,
  } = useInvestmentWorkspaceState();

  if (isAnalyzing) {
    return (
      <section className="rounded-3xl border border-neutral-200 bg-white px-6 py-12 shadow-sm sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-950" />

          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
            Investment Intelligence
          </p>

          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-950">
            Evaluating the opportunity…
          </h2>

          <p className="mt-3 text-sm leading-6 text-neutral-600">
            Building the financial model, assessing market position,
            evaluating risk, and preparing the recommendation.
          </p>
        </div>
      </section>
    );
  }

  if (decision) {
    return (
      <InvestmentReport
        decision={decision}
      />
    );
  }

  return (
    <section
      id="decision"
      className="rounded-3xl border border-neutral-200 bg-white px-6 py-8 shadow-sm sm:px-8 lg:px-10 lg:py-10"
    >
      <div className="mx-auto max-w-4xl text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-neutral-200 bg-neutral-50">
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-6 w-6 text-neutral-700"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          >
            <path d="M4 5h16v14H4z" />
            <path d="M8 9h8" />
            <path d="M8 13h5" />
            <path d="M8 17h3" />
          </svg>
        </div>

        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
          Investment decision report
        </p>

        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
          Your report is ready to be generated.
        </h2>

        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-neutral-600">
          Once evaluated, this section will transform into the
          complete acquisition recommendation and explain why the
          property should be acquired, deferred, or passed.
        </p>

        <div className="mt-7 grid gap-3 text-left sm:grid-cols-2 lg:grid-cols-3">
          {REPORT_OUTPUTS.map(
            (output) => (
              <div
                key={output}
                className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-medium text-neutral-700"
              >
                {output}
              </div>
            ),
          )}
        </div>
      </div>
    </section>
  );
}
