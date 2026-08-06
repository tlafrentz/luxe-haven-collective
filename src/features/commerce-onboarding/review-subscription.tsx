import Link from "next/link";
import { Check } from "lucide-react";
import { lifecycleStages, resolvePlanOfferId, type Plan } from "@/lib/plans";
import type { BillingCycle } from "@/components/marketing/billing-toggle";
import {
  businessTypeLabels,
  primaryGoalLabels,
  propertyCountLabels,
  type BusinessType,
  type PrimaryGoal,
  type PropertyCount,
} from "./types";

export type BusinessProfileSummary = {
  businessType: BusinessType;
  propertyCount: PropertyCount;
  primaryGoal: PrimaryGoal;
  integrations: string[];
};

export function ReviewSubscription({
  plan,
  billing,
  businessProfile,
}: {
  plan: Plan;
  billing: BillingCycle;
  businessProfile: BusinessProfileSummary;
}) {
  const price = billing === "annual" ? plan.annualMonthlyEquivalent : plan.monthlyPrice;
  const offerAvailable = Boolean(resolvePlanOfferId(plan, billing));

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_.6fr]">
      <div className="rounded-2xl border border-[#dce2dd] bg-white p-6 md:p-8">
        <p className="text-xs font-bold uppercase tracking-[.14em] text-[#a56b19]">Your plan</p>
        <div className="mt-2 flex items-baseline justify-between">
          <h2 className="font-serif text-3xl">{plan.name}</h2>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
            {billing === "annual" ? "Billed annually" : "Billed monthly"}
          </span>
        </div>
        <p className="mt-2 text-sm text-stone-600">{plan.tagline}</p>

        <h3 className="mt-7 text-sm font-bold uppercase tracking-wide text-stone-500">Includes</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {lifecycleStages.map((stage) => {
            const items = plan.featuresByStage[stage.slug];
            if (!items.length) return null;
            return (
              <div key={stage.slug}>
                <p className="text-xs font-bold uppercase tracking-wide text-[#074e38]">
                  {stage.label}
                </p>
                <ul className="mt-2 space-y-1.5">
                  {items.map((item) => (
                    <li key={item} className="flex gap-2 text-sm text-stone-600">
                      <Check className="mt-0.5 size-4 shrink-0 text-emerald-700" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <h3 className="mt-7 text-sm font-bold uppercase tracking-wide text-stone-500">Support</h3>
        <p className="mt-2 text-sm text-stone-600">{plan.support}</p>

        <h3 className="mt-7 text-sm font-bold uppercase tracking-wide text-stone-500">
          Your workspace
        </h3>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-stone-500">Business Type</dt>
            <dd className="mt-1 text-sm font-semibold">
              {businessTypeLabels[businessProfile.businessType]}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-stone-500">Property Count</dt>
            <dd className="mt-1 text-sm font-semibold">
              {propertyCountLabels[businessProfile.propertyCount]}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-stone-500">Primary Goal</dt>
            <dd className="mt-1 text-sm font-semibold">
              {primaryGoalLabels[businessProfile.primaryGoal]}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-stone-500">Integrations</dt>
            <dd className="mt-1 text-sm font-semibold">
              {businessProfile.integrations.length ? businessProfile.integrations.join(", ") : "None yet"}
            </dd>
          </div>
        </dl>
      </div>

      <aside className="h-fit rounded-2xl border border-[#dce2dd] bg-white p-6 lg:sticky lg:top-10">
        <div className="flex gap-2 text-xs font-semibold">
          <Link
            href={`/commerce/review?plan=${plan.slug}&billing=monthly`}
            className={billing === "monthly" ? "text-[#074e38] underline" : "text-stone-500"}
          >
            Monthly
          </Link>
          <span className="text-stone-300">/</span>
          <Link
            href={`/commerce/review?plan=${plan.slug}&billing=annual`}
            className={billing === "annual" ? "text-[#074e38] underline" : "text-stone-500"}
          >
            Annual (Save 20%)
          </Link>
        </div>

        <dl className="mt-5 space-y-3 border-b border-[#dce2dd] pb-5 text-sm">
          <div className="flex justify-between">
            <dt className="text-stone-600">{plan.name} plan</dt>
            <dd className="font-semibold">{price === null ? "Custom" : `$${price}/mo`}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone-600">Tax</dt>
            <dd className="text-stone-500">Calculated at checkout</dd>
          </div>
        </dl>
        <div className="mt-5 flex justify-between text-lg font-bold">
          <span>Total Due Today</span>
          <span>{price === null ? "Custom" : `$${price}.00`}</span>
        </div>

        <div className="mt-7 flex flex-col gap-3">
          <Link
            href={`/commerce/configure-workspace?plan=${plan.slug}&billing=${billing}`}
            className="flex min-h-11 items-center justify-center rounded-md border border-[#789487] px-5 text-sm font-semibold text-[#26342e]"
          >
            Back
          </Link>
          {offerAvailable ? (
            <Link
              href={`/commerce/checkout?plan=${plan.slug}&billing=${billing}`}
              className="flex min-h-11 items-center justify-center rounded-md bg-emerald-900 px-5 text-sm font-semibold text-white transition hover:bg-emerald-800"
            >
              Continue to Secure Checkout →
            </Link>
          ) : (
            <div className="rounded-xl border border-dashed border-[#dce2dd] p-4 text-center text-xs text-stone-500">
              This plan isn&apos;t available for checkout yet.{" "}
              <Link href={`/contact?plan=${plan.slug}`} className="font-semibold underline">
                Contact us
              </Link>{" "}
              to get started.
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
