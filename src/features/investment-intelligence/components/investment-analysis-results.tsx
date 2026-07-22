"use client";

import {
  InvestmentReport,
} from "./investment-report";

import {
  useInvestmentWorkspaceState,
} from "./investment-workspace-state";

import { buildInvestmentWorkspaceView } from "../application/adapters";

const ANALYSIS_OUTPUTS = [
  "Acquisition recommendation",
  "Investment score",
  "Analysis confidence",
  "Projected financial performance",
  "Comparable property analysis",
  "Supporting evidence",
  "Risks and mitigations",
] as const;

export function InvestmentAnalysisResults() {
  const {
    analysis,
    hasStaleAnalysis,
    isAnalyzing,
    analysisError,
  } = useInvestmentWorkspaceState();

  if (
    isAnalyzing &&
    analysis === null
  ) {
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

  if (analysis) {
    buildInvestmentWorkspaceView(
      analysis,
    );

    return (
      <div className="space-y-4">
        {hasStaleAnalysis ? (
          <section
            role="status"
            className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4"
          >
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-semibold text-amber-800"
              >
                !
              </span>

              <div>
                <h3 className="text-sm font-semibold text-amber-950">
                  This report uses earlier assumptions.
                </h3>

                <p className="mt-1 text-sm leading-6 text-amber-900/75">
                  Review it as a reference only. Run the analysis again to
                  update the recommendation, score, financial performance,
                  evidence, and risks.
                </p>
              </div>
            </div>
          </section>
        ) : null}

        {isAnalyzing ? (
          <section
            role="status"
            className="rounded-2xl border border-neutral-200 bg-neutral-50 px-5 py-4"
          >
            <p className="text-sm font-semibold text-neutral-950">
              Updating the analysis…
            </p>

            <p className="mt-1 text-sm leading-6 text-neutral-600">
              The existing report will remain visible until the refreshed
              analysis is complete.
            </p>
          </section>
        ) : null}

        {analysisError ? (
          <section
            role="alert"
            className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4"
          >
            <h3 className="text-sm font-semibold text-rose-950">
              The report could not be updated.
            </h3>

            <p className="mt-1 text-sm leading-6 text-rose-900/75">
              {analysisError}
            </p>
          </section>
        ) : null}

        <InvestmentReport
          result={analysis}
        />
      </div>
    );
  }

  if (analysisError) {
    return (
      <section
        role="alert"
        className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-8 shadow-sm sm:px-8"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-700">
          Analysis unavailable
        </p>

        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-rose-950">
          The investment analysis could not be generated.
        </h2>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-rose-900/75">
          {analysisError}
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-neutral-200 bg-white px-6 py-8 shadow-sm sm:px-8 lg:px-10 lg:py-10">
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
          Full investment analysis
        </p>

        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
          Your explainable analysis will appear here.
        </h2>

        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-neutral-600">
          The live preview above responds immediately to your assumptions.
          Run the full analysis to understand whether the opportunity should
          be acquired, pursued with conditions, deferred, or passed.
        </p>

        <div className="mt-7 grid gap-3 text-left sm:grid-cols-2 lg:grid-cols-3">
          {ANALYSIS_OUTPUTS.map(
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
