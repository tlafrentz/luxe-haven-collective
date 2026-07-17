import type {
  PurchaseDecisionReport,
} from "../domain";

export function PurchaseDecisionSummary({
  report,
}: {
  readonly report: PurchaseDecisionReport;
}) {
  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
            Purchase decision engine
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-stone-950">
            {report.recommendation.headline}
          </h2>
          <p className="mt-4 leading-7 text-stone-600">
            {report.thesis.summary}
          </p>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-stone-50 px-5 py-4 text-right">
          <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
            Confidence
          </p>
          <p className="mt-1 text-3xl font-semibold text-stone-950">
            {report.confidence.score}
          </p>
          <p className="text-sm capitalize text-stone-600">
            {report.confidence.level.replace("-", " ")}
          </p>
        </div>
      </div>

      <div className="mt-7 grid gap-5 lg:grid-cols-2">
        <div>
          <h3 className="font-semibold text-stone-950">
            Why
          </h3>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            {report.recommendation.rationale}
          </p>
        </div>
        <div>
          <h3 className="font-semibold text-stone-950">
            Next actions
          </h3>
          <ul className="mt-2 space-y-2 text-sm leading-6 text-stone-600">
            {report.recommendation.nextActions.map(
              (action) => (
                <li key={action}>• {action}</li>
              ),
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}
