import Link from "next/link";
import type { BillingCycle } from "./billing-toggle";
import type { Plan } from "@/lib/plans";

function priceDisplay(plan: Plan, billing: BillingCycle) {
  if (plan.monthlyPrice === null) {
    return { price: "Custom", suffix: "pricing", savings: null };
  }
  if (billing === "annual") {
    return {
      price: `$${plan.annualMonthlyEquivalent}`,
      suffix: "/ month, billed annually",
      savings: plan.annualSavingsLabel,
    };
  }
  return { price: `$${plan.monthlyPrice}`, suffix: "/ month", savings: null };
}

export function PlanCard({
  plan,
  billing,
  selected,
  ctaLabel = "Choose Plan",
  ctaHref,
}: {
  plan: Plan;
  billing: BillingCycle;
  selected?: boolean;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  const { price, suffix, savings } = priceDisplay(plan, billing);
  return (
    <article
      className={`relative flex flex-col rounded-xl p-6 ${
        selected || plan.popular
          ? "border-2 border-emerald-800 bg-white"
          : "border border-[#dce2dd] bg-white"
      }`}
    >
      {plan.popular ? (
        <span className="absolute right-4 top-4 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
          Most popular
        </span>
      ) : null}
      <h3 className="font-serif text-2xl">{plan.name}</h3>
      <p className="mt-2 text-sm text-stone-600">{plan.bestFor}</p>
      <div className="mt-6">
        <span className="text-3xl font-bold">{price}</span>
        <span className="ml-1 text-sm text-stone-500">{suffix}</span>
        {savings ? (
          <p className="mt-1 text-xs font-semibold text-emerald-700">
            {savings}
          </p>
        ) : null}
      </div>
      <ul className="mt-6 flex-1 space-y-2 text-sm text-stone-600">
        <li>{plan.comparisonRow.properties} properties</li>
        <li>{plan.comparisonRow.users} users</li>
      </ul>
      <Link
        href={ctaHref ?? `/performance/plans/${plan.slug}`}
        className="mt-6 flex min-h-11 items-center justify-center rounded-md bg-emerald-900 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800"
      >
        {ctaLabel}
      </Link>
    </article>
  );
}
