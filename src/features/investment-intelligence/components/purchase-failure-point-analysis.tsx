import type {
  PurchaseFailurePoints,
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

export function PurchaseFailurePointAnalysis({
  failurePoints,
}: {
  readonly failurePoints:
    PurchaseFailurePoints;
}) {
  const metrics = [
    ["Minimum ADR", currency(failurePoints.minimumSustainableAdr.amount)],
    ["Minimum occupancy", `${failurePoints.minimumSustainableOccupancy.value}%`],
    ["Maximum purchase price", currency(failurePoints.maximumSupportedPurchasePrice.amount)],
    ["Purchase-price margin", currency(failurePoints.purchasePriceSafetyMargin.amount)],
    ["Operating expense capacity", currency(failurePoints.operatingExpenseCapacity.amount)],
    ["Debt-service capacity", currency(failurePoints.debtServiceCapacity.amount)],
  ] as const;

  return (
    <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
            Purchase failure points
          </p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950">
            Where does this underwriting stop working?
          </h3>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-600">
            {failurePoints.summary}
          </p>
        </div>
        <span className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-semibold capitalize text-neutral-700">
          {failurePoints.resilienceStatus}
        </span>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"
          >
            <p className="text-xs text-neutral-500">{label}</p>
            <p className="mt-2 text-xl font-semibold text-neutral-950">{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
