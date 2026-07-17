import type {
  InvestmentScenario,
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

function formatChange(
  amount: number,
): string {
  if (amount === 0) {
    return "Base case";
  }

  const prefix =
    amount > 0 ? "+" : "";

  return `${prefix}${formatCurrency(amount)}`;
}

function ScenarioCard({
  scenario,
}: {
  scenario: InvestmentScenario;
}) {
  const isDownside =
    scenario.type === "downside";

  const isUpside =
    scenario.type === "upside";

  const accentClass =
    isDownside
      ? "text-amber-700"
      : isUpside
        ? "text-emerald-700"
        : "text-neutral-600";

  return (
    <article className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p
            className={`text-xs font-semibold uppercase tracking-[0.18em] ${accentClass}`}
          >
            {scenario.label} case
          </p>

          <h4 className="mt-2 text-xl font-semibold tracking-tight text-neutral-950">
            {formatLabel(
              scenario.recommendation,
            )}
          </h4>
        </div>

        <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-700">
          {formatChange(
            scenario
              .cashFlowChangeFromBase
              .amount,
          )}
        </span>
      </div>

      <p className="mt-4 text-sm leading-6 text-neutral-600">
        {scenario.description}
      </p>

      <dl className="mt-6 grid grid-cols-2 gap-x-5 gap-y-4">
        <div>
          <dt className="text-xs text-neutral-500">
            Annual revenue
          </dt>
          <dd className="mt-1 text-sm font-semibold text-neutral-950">
            {formatCurrency(
              scenario
                .projectedAnnualRevenue
                .amount,
            )}
          </dd>
        </div>

        <div>
          <dt className="text-xs text-neutral-500">
            Annual cash flow
          </dt>
          <dd className="mt-1 text-sm font-semibold text-neutral-950">
            {formatCurrency(
              scenario
                .annualCashFlow.amount,
            )}
          </dd>
        </div>

        <div>
          <dt className="text-xs text-neutral-500">
            Lease coverage
          </dt>
          <dd className="mt-1 text-sm font-semibold text-neutral-950">
            {scenario
              .leaseCoverageRatio
              .toFixed(2)}
          </dd>
        </div>

        <div>
          <dt className="text-xs text-neutral-500">
            Cash-on-cash
          </dt>
          <dd className="mt-1 text-sm font-semibold text-neutral-950">
            {scenario
              .cashOnCashReturn.value}
            %
          </dd>
        </div>

        <div>
          <dt className="text-xs text-neutral-500">
            Occupancy
          </dt>
          <dd className="mt-1 text-sm font-semibold text-neutral-950">
            {scenario
              .projectedOccupancy.value}
            %
          </dd>
        </div>

        <div>
          <dt className="text-xs text-neutral-500">
            Break-even
          </dt>
          <dd className="mt-1 text-sm font-semibold text-neutral-950">
            {scenario
              .breakEvenOccupancy.value}
            %
          </dd>
        </div>
      </dl>
    </article>
  );
}

export function InvestmentScenarioAnalysis({
  scenarios,
}: {
  scenarios:
    readonly InvestmentScenario[];
}) {
  const downside =
    scenarios.find(
      ({ type }) =>
        type === "downside",
    );

  const resilienceMessage =
    downside &&
    downside.annualCashFlow.amount > 0 &&
    downside.leaseCoverageRatio >= 1
      ? "The operating plan remains cash-flow positive in the modeled downside case."
      : "The operating plan fails to remain fully supported in the modeled downside case.";

  return (
    <section className="rounded-3xl border border-neutral-200 bg-neutral-50/70 p-6 shadow-sm sm:p-7">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
          Scenario analysis
        </p>

        <h3 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950">
          How resilient is this operating plan?
        </h3>

        <p className="mt-3 text-sm leading-6 text-neutral-600">
          {resilienceMessage}
        </p>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-3">
        {scenarios.map(
          (scenario) => (
            <ScenarioCard
              key={scenario.type}
              scenario={scenario}
            />
          ),
        )}
      </div>
    </section>
  );
}
