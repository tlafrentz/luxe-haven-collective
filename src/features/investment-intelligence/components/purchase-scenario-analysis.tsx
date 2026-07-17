import type {
  PurchaseScenario,
} from "../domain";

function currency(amount: number) {
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    },
  ).format(amount);
}

export function PurchaseScenarioAnalysis({
  scenarios,
}: {
  readonly scenarios:
    readonly PurchaseScenario[];
}) {
  return (
    <section className="rounded-3xl border border-neutral-200 bg-neutral-50/70 p-6 shadow-sm sm:p-7">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">
        Purchase scenario analysis
      </p>
      <h3 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950">
        How does the deal perform when assumptions change?
      </h3>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        {scenarios.map((scenario) => (
          <article
            key={scenario.type}
            className="rounded-2xl border border-neutral-200 bg-white p-5"
          >
            <h4 className="text-lg font-semibold text-neutral-950">
              {scenario.label}
            </h4>
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-neutral-500">Annual revenue</p>
                <p className="mt-1 font-semibold">{currency(scenario.annualRevenue.amount)}</p>
              </div>
              <div>
                <p className="text-neutral-500">Annual cash flow</p>
                <p className="mt-1 font-semibold">{currency(scenario.annualCashFlow.amount)}</p>
              </div>
              <div>
                <p className="text-neutral-500">Cap rate</p>
                <p className="mt-1 font-semibold">{scenario.capRate.value}%</p>
              </div>
              <div>
                <p className="text-neutral-500">Cash-on-cash</p>
                <p className="mt-1 font-semibold">{scenario.cashOnCashReturn.value}%</p>
              </div>
              <div>
                <p className="text-neutral-500">DSCR</p>
                <p className="mt-1 font-semibold">{scenario.debtServiceCoverageRatio.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-neutral-500">Break-even occupancy</p>
                <p className="mt-1 font-semibold">{scenario.breakEvenOccupancy.value}%</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
