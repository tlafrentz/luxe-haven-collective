import {
  EvidenceDirection,
} from "../domain";

import type {
  PurchaseInvestmentLifecycleResult,
} from "../domain";

function formatCurrency(
  amount: number,
): string {
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    },
  ).format(amount);
}

function formatLabel(
  value: string,
): string {
  return value
    .split("-")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1),
    )
    .join(" ");
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
        {label}
      </p>

      <p className="mt-3 text-2xl font-semibold tracking-tight text-neutral-950">
        {value}
      </p>
    </div>
  );
}

export function PurchaseInvestmentReport({
  result,
}: {
  result:
    PurchaseInvestmentLifecycleResult;
}) {
  const decision = result.analysis;

  const positiveEvidence =
    decision.supportingEvidence.filter(
      ({ direction }) =>
        direction ===
        EvidenceDirection.Positive,
    );

  const cautionEvidence =
    decision.supportingEvidence.filter(
      ({ direction }) =>
        direction ===
        EvidenceDirection.Caution,
    );

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-3xl bg-neutral-950 text-white shadow-sm">
        <div className="grid gap-8 px-7 py-9 sm:px-9 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center lg:px-12 lg:py-12">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">
              Acquisition recommendation
            </p>

            <h3 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
              {formatLabel(
                decision.recommendation,
              )}
            </h3>

            <p className="mt-4 max-w-2xl text-sm leading-6 text-neutral-300">
              The recommendation reflects projected financial
              performance, comparable-market position, identified
              risks, supporting evidence, and the confidence of the
              underlying analysis.
            </p>

            <div className="mt-6 inline-flex rounded-full border border-white/15 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-neutral-200">
              {formatLabel(
                decision.confidence,
              )}{" "}
              confidence
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
              Investment score
            </p>

            <div className="mt-3 flex items-end gap-2">
              <span className="text-6xl font-semibold tracking-tight">
                {decision.score.overall.value}
              </span>

              <span className="pb-2 text-sm text-neutral-400">
                / 100
              </span>
            </div>

            <p className="mt-4 text-xs leading-5 text-neutral-400">
              Risk exposure:{" "}
              {decision.score.riskExposure.value} / 100
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Annual revenue"
          value={formatCurrency(
            decision.revenueProjection
              .projectedAnnualRevenue.amount,
          )}
        />

        <MetricCard
          label="Net operating income"
          value={formatCurrency(
            decision.financialPerformance
              .netOperatingIncome.amount,
          )}
        />

        <MetricCard
          label="Annual cash flow"
          value={formatCurrency(
            decision.financialPerformance
              .annualCashFlow.amount,
          )}
        />

        <MetricCard
          label="Cap rate"
          value={`${decision.financialPerformance.capRate.value}%`}
        />

        <MetricCard
          label="Cash-on-cash return"
          value={`${decision.financialPerformance.cashOnCashReturn.value}%`}
        />

        <MetricCard
          label="DSCR"
          value={String(
            decision.financialPerformance
              .debtServiceCoverageRatio,
          )}
        />

        <MetricCard
          label="Break-even occupancy"
          value={`${decision.financialPerformance.breakEvenOccupancy.value}%`}
        />

        <MetricCard
          label="Revenue upside"
          value={formatCurrency(
            decision.comparableAnalysis
              .projectedRevenueUpside.amount,
          )}
        />
      </section>

      <section className="grid gap-8 xl:grid-cols-2">
        <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            Supporting evidence
          </p>

          <h3 className="mt-2 text-xl font-semibold tracking-tight text-neutral-950">
            Reasons supporting acquisition
          </h3>

          <div className="mt-5 space-y-4">
            {positiveEvidence.length > 0 ? (
              positiveEvidence.map(
                (evidence) => (
                  <article
                    key={evidence.id}
                    className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4"
                  >
                    <h4 className="text-sm font-semibold text-neutral-950">
                      {evidence.title}
                    </h4>

                    <p className="mt-2 text-sm leading-6 text-neutral-600">
                      {evidence.description}
                    </p>
                  </article>
                ),
              )
            ) : (
              <p className="text-sm leading-6 text-neutral-500">
                No strong positive evidence was identified.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
            Risks and cautions
          </p>

          <h3 className="mt-2 text-xl font-semibold tracking-tight text-neutral-950">
            Conditions requiring attention
          </h3>

          <div className="mt-5 space-y-4">
            {decision.risks.length > 0 ? (
              decision.risks.map(
                (risk) => (
                  <article
                    key={risk.id}
                    className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold text-neutral-950">
                        {risk.title}
                      </h4>

                      <span className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-xs font-medium text-amber-800">
                        {formatLabel(
                          risk.severity,
                        )}
                      </span>
                    </div>

                    <p className="mt-2 text-sm leading-6 text-neutral-600">
                      {risk.description}
                    </p>

                    {risk.mitigation ? (
                      <p className="mt-3 text-xs leading-5 text-neutral-500">
                        Mitigation:{" "}
                        {risk.mitigation}
                      </p>
                    ) : null}
                  </article>
                ),
              )
            ) : cautionEvidence.length > 0 ? (
              cautionEvidence.map(
                (evidence) => (
                  <article
                    key={evidence.id}
                    className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4"
                  >
                    <h4 className="text-sm font-semibold text-neutral-950">
                      {evidence.title}
                    </h4>

                    <p className="mt-2 text-sm leading-6 text-neutral-600">
                      {evidence.description}
                    </p>
                  </article>
                ),
              )
            ) : (
              <p className="text-sm leading-6 text-neutral-500">
                No material investment risks were identified.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
