"use client";

import {
  useInvestmentWorkspaceState,
} from "./investment-workspace-state";

const ANALYSIS_STEPS = [
  "Validate normalized assumptions",
  "Resolve the subject property",
  "Analyze current Market evidence",
  "Build the Investment decision",
] as const;

export function GenerateInvestmentAnalysisCard() {
  const {
    analysis,
    hasStaleAnalysis,
    isReadyForAnalysis,
    isAnalyzing,
    analysisError,
    analyzeInvestment,
  } = useInvestmentWorkspaceState();

  const hasCurrentAnalysis =
    analysis !== null &&
    !hasStaleAnalysis;

  const buttonLabel = isAnalyzing
    ? "Running Full Analysis…"
    : hasStaleAnalysis
      ? "Run Updated Analysis"
      : hasCurrentAnalysis
        ? "Run Full Analysis Again"
        : "Run Full Investment Analysis";

  return (
    <section aria-live="polite" aria-busy={isAnalyzing} className="overflow-hidden rounded-3xl border border-neutral-900 bg-neutral-950 text-white shadow-sm">
      <div className="grid gap-10 px-7 py-9 sm:px-9 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.7fr)] lg:items-center lg:px-12 lg:py-12">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">
            Full investment analysis
          </p>

          <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            {hasStaleAnalysis
              ? "Update the analysis with your latest assumptions."
              : hasCurrentAnalysis
                ? "Re-evaluate the investment opportunity."
                : "Analyze the investment opportunity."}
          </h2>

          <p className="mt-4 max-w-2xl text-sm leading-6 text-neutral-300">
            The live preview shows indicative financial performance as
            assumptions change. The full analysis adds market position,
            comparable evidence, risk assessment, confidence, investment
            score, and an explainable acquisition recommendation.
          </p>

          {hasStaleAnalysis ? (
            <div className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/10 px-4 py-3">
              <p className="text-sm font-medium text-amber-100">
                Assumptions changed. Run the full analysis again to refresh the recommendation.
              </p>

              <p className="mt-1 text-xs leading-5 text-amber-100/70">
                The previous report remains visible for reference, but it no
                longer reflects the current workspace inputs.
              </p>
            </div>
          ) : null}

          <div className="mt-7">
            <button
              type="button"
              disabled={
                !isReadyForAnalysis ||
                isAnalyzing
              }
              onClick={() => {
                void analyzeInvestment();
              }}
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-6 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-neutral-950 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
            >
              {buttonLabel}
            </button>

            <p className="mt-3 text-xs leading-5 text-neutral-500">
              Generates the recommendation, score, confidence, complete
              financial performance, evidence, scenarios, and risks.
            </p>

            {analysisError ? (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/10 px-4 py-3"
              >
                <p className="text-sm font-medium text-rose-200">
                  Analysis could not be completed.
                </p>

                <p className="mt-1 text-xs leading-5 text-rose-200/75">
                  {analysisError}
                </p>
                <p className="mt-2 text-xs font-medium text-rose-100">Your route and assumptions were preserved. Review the inputs or retry the full analysis.</p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
            Full analysis sequence
          </p>

          <ul className="mt-5 space-y-4">
            {ANALYSIS_STEPS.map(
              (step, index) => (
                <li
                  key={step}
                  className="flex items-center gap-3 text-sm text-neutral-200"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/15 text-[10px] font-medium text-neutral-400">
                    {index + 1}
                  </span>

                  {step}
                </li>
              ),
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}
