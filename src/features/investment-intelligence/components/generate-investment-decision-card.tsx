"use client";

import {
  useInvestmentWorkspaceState,
} from "./investment-workspace-state";

const ANALYSIS_STEPS = [
  "Build revenue projection",
  "Estimate operating expenses",
  "Evaluate financial performance",
  "Compare market position",
  "Assess investment risks",
  "Generate acquisition recommendation",
] as const;

export function GenerateInvestmentDecisionCard() {
  const {
    isReadyForAnalysis,
    isAnalyzing,
    analysisError,
    generateInvestmentDecision,
  } = useInvestmentWorkspaceState();

  return (
    <section className="overflow-hidden rounded-3xl border border-neutral-900 bg-neutral-950 text-white shadow-sm">
      <div className="grid gap-10 px-7 py-9 sm:px-9 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.7fr)] lg:items-center lg:px-12 lg:py-12">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">
            Phase 2
          </p>

          <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Generate the investment decision.
          </h2>

          <p className="mt-4 max-w-2xl text-sm leading-6 text-neutral-300">
            Investment Intelligence will synthesize the property,
            financing structure, operating plan, market position,
            financial performance, risks, and supporting evidence
            into one explainable recommendation.
          </p>

          <div className="mt-7">
            <button
              type="button"
              disabled={
                !isReadyForAnalysis ||
                isAnalyzing
              }
              onClick={() => {
                void generateInvestmentDecision();
              }}
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-6 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-neutral-950 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
            >
              {isAnalyzing
                ? "Analyzing Opportunity…"
                : "Generate Investment Decision"}
            </button>

            <p className="mt-3 text-xs leading-5 text-neutral-500">
              The report will include recommendation, score,
              confidence, financial performance, evidence, and risks.
            </p>

            {analysisError ? (
              <p
                role="alert"
                className="mt-3 text-sm leading-6 text-rose-300"
              >
                {analysisError}
              </p>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
            Analysis sequence
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
