import type {
  RentalArbitrageStressOutcome,
  RentalArbitrageStressTest,
  RentalArbitrageStressTestSummary,
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

function formatSignedCurrency(
  amount: number,
): string {
  const formatted =
    formatCurrency(
      Math.abs(amount),
    );

  if (amount > 0) {
    return `+${formatted}`;
  }

  if (amount < 0) {
    return `-${formatted}`;
  }

  return formatted;
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

function outcomeClasses(
  outcome:
    RentalArbitrageStressOutcome,
): string {
  switch (outcome) {
    case "fails":
      return "border-rose-200 bg-rose-50 text-rose-800";

    case "pressured":
      return "border-amber-200 bg-amber-50 text-amber-800";

    case "resilient":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
}

function StressCard({
  stress,
  rank,
}: {
  readonly stress:
    RentalArbitrageStressTest;
  readonly rank: number;
}) {
  return (
    <article className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
            Threat #{rank}
          </p>

          <h4 className="mt-2 text-base font-semibold text-neutral-950">
            {stress.title}
          </h4>
        </div>

        <span
          className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${outcomeClasses(
            stress.outcome,
          )}`}
        >
          {formatLabel(
            stress.outcome,
          )}
        </span>
      </div>

      <p className="mt-3 text-sm leading-6 text-neutral-600">
        {stress.description}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-neutral-50 p-3">
          <p className="text-xs text-neutral-500">
            Stressed cash flow
          </p>

          <p className="mt-1 text-lg font-semibold text-neutral-950">
            {formatCurrency(
              stress
                .stressedAnnualCashFlow
                .amount,
            )}
          </p>
        </div>

        <div className="rounded-xl bg-neutral-50 p-3">
          <p className="text-xs text-neutral-500">
            Change from base
          </p>

          <p className="mt-1 text-lg font-semibold text-neutral-950">
            {formatSignedCurrency(
              stress
                .annualCashFlowChange
                .amount,
            )}
          </p>
        </div>

        <div className="rounded-xl bg-neutral-50 p-3">
          <p className="text-xs text-neutral-500">
            Stressed ADR
          </p>

          <p className="mt-1 text-sm font-semibold text-neutral-950">
            {formatCurrency(
              stress.stressedAdr.amount,
            )}
          </p>
        </div>

        <div className="rounded-xl bg-neutral-50 p-3">
          <p className="text-xs text-neutral-500">
            Stressed occupancy
          </p>

          <p className="mt-1 text-sm font-semibold text-neutral-950">
            {
              stress
                .stressedOccupancy.value
            }
            %
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-neutral-500">
        <span className="rounded-full border border-neutral-200 px-2.5 py-1">
          ADR{" "}
          {stress.assumptions
            .adrChangePercentage > 0
            ? "+"
            : ""}
          {
            stress.assumptions
              .adrChangePercentage
          }
          %
        </span>

        <span className="rounded-full border border-neutral-200 px-2.5 py-1">
          Occupancy{" "}
          {stress.assumptions
            .occupancyChangePoints > 0
            ? "+"
            : ""}
          {
            stress.assumptions
              .occupancyChangePoints
          }{" "}
          pts
        </span>

        <span className="rounded-full border border-neutral-200 px-2.5 py-1">
          OpEx{" "}
          {stress.assumptions
            .operatingExpenseChangePercentage >
          0
            ? "+"
            : ""}
          {
            stress.assumptions
              .operatingExpenseChangePercentage
          }
          %
        </span>
      </div>

      <p className="mt-4 border-t border-neutral-100 pt-4 text-xs leading-5 text-neutral-500">
        {stress.interpretation}
      </p>
    </article>
  );
}

export function RentalArbitrageMarketStressAnalysis({
  stressSummary,
}: {
  readonly stressSummary:
    RentalArbitrageStressTestSummary;
}) {
  return (
    <section className="rounded-3xl border border-neutral-200 bg-neutral-50/70 p-6 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">
            Market stress testing
          </p>

          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950">
            What is most likely to break this deal?
          </h3>

          <p className="mt-3 text-sm leading-6 text-neutral-600">
            {stressSummary.summary}
          </p>
        </div>

        <span
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${outcomeClasses(
            stressSummary.overallOutcome,
          )}`}
        >
          {formatLabel(
            stressSummary.overallOutcome,
          )}
        </span>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-rose-100 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-700">
            Failed
          </p>

          <p className="mt-2 text-3xl font-semibold text-neutral-950">
            {
              stressSummary.failedStressCount
            }
          </p>
        </div>

        <div className="rounded-2xl border border-amber-100 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">
            Pressured
          </p>

          <p className="mt-2 text-3xl font-semibold text-neutral-950">
            {
              stressSummary
                .pressuredStressCount
            }
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
            Resilient
          </p>

          <p className="mt-2 text-3xl font-semibold text-neutral-950">
            {
              stressSummary
                .resilientStressCount
            }
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {stressSummary.tests.map(
          (stress, index) => (
            <StressCard
              key={stress.id}
              stress={stress}
              rank={index + 1}
            />
          ),
        )}
      </div>
    </section>
  );
}
