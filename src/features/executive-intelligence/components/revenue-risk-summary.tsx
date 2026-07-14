import {
  ShieldAlert,
} from "lucide-react";

import type {
  RevenueRiskSummary as RevenueRiskSummaryType,
} from "../domain";

type RevenueRiskSummaryProps = {
  risk: RevenueRiskSummaryType;
};

export function RevenueRiskSummary({
  risk,
}: RevenueRiskSummaryProps) {
  const amount = new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: risk.currency || "USD",
      maximumFractionDigits: 0,
    },
  ).format(risk.totalEstimatedAmount);

  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
            Revenue at risk
          </p>

          <p className="mt-3 text-3xl font-semibold tracking-tight text-stone-950">
            {amount}
          </p>
        </div>

        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
          <ShieldAlert className="h-5 w-5" />
        </div>
      </div>

      <p className="mt-3 text-sm text-stone-600">
        {risk.itemCount} active{" "}
        {risk.itemCount === 1 ? "risk" : "risks"}{" "}
        identified by Revenue Intelligence.
      </p>

      <div className="mt-5 space-y-3">
        {risk.items.slice(0, 3).map((item) => (
          <div
            key={item.id}
            className="rounded-xl bg-stone-50 p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-stone-900">
                {item.title}
              </p>

              <p className="text-sm font-semibold text-stone-950">
                {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: item.currency,
                  maximumFractionDigits: 0,
                }).format(item.estimatedAmount)}
              </p>
            </div>

            <p className="mt-1 text-xs leading-5 text-stone-500">
              {item.summary}
            </p>
          </div>
        ))}

        {risk.items.length === 0 ? (
          <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
            No quantified revenue risks were detected.
          </p>
        ) : null}
      </div>
    </section>
  );
}
