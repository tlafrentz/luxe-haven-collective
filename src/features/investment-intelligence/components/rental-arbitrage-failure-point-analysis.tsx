import type {
  RentalArbitrageFailurePoints,
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

function ThresholdCard({
  label,
  value,
  detail,
}: {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
}) {
  return (
    <article className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
        {label}
      </p>

      <p className="mt-3 text-2xl font-semibold tracking-tight text-neutral-950">
        {value}
      </p>

      <p className="mt-2 text-xs leading-5 text-neutral-500">
        {detail}
      </p>
    </article>
  );
}

export function RentalArbitrageFailurePointAnalysis({
  failurePoints,
}: {
  readonly failurePoints:
    RentalArbitrageFailurePoints;
}) {
  return (
    <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">
            Break-even and failure points
          </p>

          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950">
            Where does this deal stop working?
          </h3>

          <p className="mt-3 text-sm leading-6 text-neutral-600">
            {failurePoints.summary}
          </p>
        </div>

        <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-700">
          {formatLabel(
            failurePoints.status,
          )}
        </span>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ThresholdCard
          label="Maximum monthly lease"
          value={formatCurrency(
            failurePoints
              .maximumMonthlyLease.amount,
          )}
          detail={`${formatCurrency(
            failurePoints
              .monthlyLeaseSafetyMargin
              .amount,
          )} above the current lease, or ${failurePoints.monthlyLeaseSafetyMarginPercentage.value}%.`}
        />

        <ThresholdCard
          label="Minimum occupancy"
          value={`${failurePoints.minimumOccupancy.value}%`}
          detail={`${failurePoints.occupancySafetyMarginPoints} percentage points below the projected occupancy.`}
        />

        <ThresholdCard
          label="Minimum ADR"
          value={formatCurrency(
            failurePoints.minimumAdr.amount,
          )}
          detail={`${formatCurrency(
            failurePoints
              .adrSafetyMargin.amount,
          )} below projected ADR, or ${failurePoints.adrSafetyMarginPercentage.value}%.`}
        />

        <ThresholdCard
          label="Expense capacity"
          value={formatCurrency(
            failurePoints
              .operatingExpenseSafetyMargin
              .amount,
          )}
          detail="Additional annual cost the operating plan can absorb before cash flow reaches zero."
        />
      </div>
    </section>
  );
}
