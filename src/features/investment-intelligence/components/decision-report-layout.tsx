import type {
  DecisionReport,
  DecisionReportRiskSeverity,
} from "../domain";

function formatLabel(value: string): string {
  return value
    .split("-")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1),
    )
    .join(" ");
}

function severityClasses(
  severity: DecisionReportRiskSeverity,
): string {
  switch (severity) {
    case "critical":
      return "border-red-200 bg-red-50 text-red-800";
    case "high":
      return "border-orange-200 bg-orange-50 text-orange-800";
    case "medium":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "low":
      return "border-stone-200 bg-stone-50 text-stone-700";
  }
}

export function DecisionReportLayout({
  report,
  strategyContent,
}: {
  readonly report: DecisionReport;
  readonly strategyContent?: React.ReactNode;
}) {
  const positiveEvidence =
    report.evidence.filter(
      ({ direction }) =>
        direction === "positive",
    );

  const cautionEvidence =
    report.evidence.filter(
      ({ direction }) =>
        direction === "caution",
    );

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-3xl bg-stone-950 text-white shadow-sm">
        <div className="grid gap-8 px-7 py-9 sm:px-9 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center lg:px-12 lg:py-12">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-400">
              {formatLabel(report.strategy)} decision report
            </p>

            <h2 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
              {report.recommendation.headline}
            </h2>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-stone-300">
              {report.thesis.summary}
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/15 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-stone-200">
                {formatLabel(
                  report.recommendation.value,
                )}
              </span>

              <span className="rounded-full border border-white/15 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-stone-200">
                {formatLabel(
                  report.confidence.level,
                )}{" "}
                confidence
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
              Decision confidence
            </p>

            <div className="mt-3 flex items-end gap-2">
              <span className="text-6xl font-semibold tracking-tight">
                {report.confidence.score}
              </span>

              <span className="pb-2 text-sm text-stone-400">
                / 100
              </span>
            </div>

            <p className="mt-4 text-xs leading-5 text-stone-400">
              {report.confidence.explanation}
            </p>
          </div>
        </div>
      </section>

      {strategyContent}

      <section className="grid gap-8 xl:grid-cols-2">
        <article className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            Supporting evidence
          </p>

          <h3 className="mt-2 text-xl font-semibold tracking-tight text-stone-950">
            Why the decision is supportable
          </h3>

          <div className="mt-5 space-y-4">
            {positiveEvidence.length > 0 ? (
              positiveEvidence.map(
                (evidence) => (
                  <div
                    key={evidence.id}
                    className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h4 className="text-sm font-semibold text-stone-950">
                        {evidence.label}
                      </h4>

                      {evidence.value ? (
                        <span className="text-sm font-semibold text-emerald-800">
                          {evidence.value}
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-2 text-sm leading-6 text-stone-600">
                      {evidence.finding}
                    </p>
                  </div>
                ),
              )
            ) : (
              <p className="text-sm leading-6 text-stone-500">
                No strong positive evidence was identified.
              </p>
            )}
          </div>
        </article>

        <article className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
            Caution evidence
          </p>

          <h3 className="mt-2 text-xl font-semibold tracking-tight text-stone-950">
            Assumptions requiring validation
          </h3>

          <div className="mt-5 space-y-4">
            {cautionEvidence.length > 0 ? (
              cautionEvidence.map(
                (evidence) => (
                  <div
                    key={evidence.id}
                    className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h4 className="text-sm font-semibold text-stone-950">
                        {evidence.label}
                      </h4>

                      {evidence.value ? (
                        <span className="text-sm font-semibold text-amber-800">
                          {evidence.value}
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-2 text-sm leading-6 text-stone-600">
                      {evidence.finding}
                    </p>
                  </div>
                ),
              )
            ) : (
              <p className="text-sm leading-6 text-stone-500">
                No material caution evidence was identified.
              </p>
            )}
          </div>
        </article>
      </section>

      <section className="grid gap-8 xl:grid-cols-2">
        <article className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
            Risks
          </p>

          <h3 className="mt-2 text-xl font-semibold tracking-tight text-stone-950">
            What could invalidate the decision
          </h3>

          <div className="mt-5 space-y-4">
            {report.risks.length > 0 ? (
              report.risks.map((risk) => (
                <div
                  key={risk.id}
                  className="rounded-2xl border border-stone-200 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h4 className="text-sm font-semibold text-stone-950">
                      {risk.title}
                    </h4>

                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium ${severityClasses(
                        risk.severity,
                      )}`}
                    >
                      {formatLabel(
                        risk.severity,
                      )}
                    </span>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-stone-600">
                    {risk.finding}
                  </p>

                  <p className="mt-3 text-xs leading-5 text-stone-500">
                    Impact: {risk.impact}
                  </p>

                  <p className="mt-1 text-xs leading-5 text-stone-500">
                    Mitigation:{" "}
                    {risk.mitigation}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm leading-6 text-stone-500">
                No material decision risks were identified.
              </p>
            )}
          </div>
        </article>

        <article className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
            Opportunities
          </p>

          <h3 className="mt-2 text-xl font-semibold tracking-tight text-stone-950">
            How the operating plan can improve
          </h3>

          <div className="mt-5 space-y-4">
            {report.opportunities.length > 0 ? (
              report.opportunities.map(
                (opportunity) => (
                  <div
                    key={opportunity.id}
                    className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4"
                  >
                    <h4 className="text-sm font-semibold text-stone-950">
                      {opportunity.title}
                    </h4>

                    <p className="mt-2 text-sm leading-6 text-stone-600">
                      {opportunity.finding}
                    </p>

                    <p className="mt-3 text-xs leading-5 text-stone-500">
                      Expected upside:{" "}
                      {opportunity.expectedUpside}
                    </p>

                    <p className="mt-1 text-xs leading-5 text-stone-500">
                      Next action:{" "}
                      {opportunity.nextAction}
                    </p>
                  </div>
                ),
              )
            ) : (
              <p className="text-sm leading-6 text-stone-500">
                No material operating opportunities were identified.
              </p>
            )}
          </div>
        </article>
      </section>

      <section className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <article className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
            Confidence factors
          </p>

          <div className="mt-5 space-y-5">
            {report.confidence.factors.map(
              (factor) => (
                <div key={factor.label}>
                  <div className="flex items-center justify-between gap-4">
                    <h4 className="text-sm font-semibold text-stone-950">
                      {factor.label}
                    </h4>

                    <span className="text-sm font-semibold text-stone-700">
                      {factor.score}/100 ·{" "}
                      {factor.weight}%
                    </span>
                  </div>

                  <p className="mt-2 text-xs leading-5 text-stone-500">
                    {factor.explanation}
                  </p>
                </div>
              ),
            )}
          </div>
        </article>

        <article className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
            Decision actions
          </p>

          {report.recommendation.conditions.length >
          0 ? (
            <>
              <h3 className="mt-3 text-lg font-semibold text-stone-950">
                Conditions
              </h3>

              <ul className="mt-3 space-y-2 text-sm leading-6 text-stone-600">
                {report.recommendation.conditions.map(
                  (condition) => (
                    <li key={condition}>
                      • {condition}
                    </li>
                  ),
                )}
              </ul>
            </>
          ) : null}

          <h3 className="mt-6 text-lg font-semibold text-stone-950">
            Next actions
          </h3>

          <ul className="mt-3 space-y-2 text-sm leading-6 text-stone-600">
            {report.recommendation.nextActions.map(
              (action) => (
                <li key={action}>
                  • {action}
                </li>
              ),
            )}
          </ul>
        </article>
      </section>
    </div>
  );
}
