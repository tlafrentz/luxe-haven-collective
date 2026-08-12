import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { PlanCard } from "@/components/marketing/plan-card";
import { lifecycleStages, plans, plansBySlug, type PlanSlug } from "@/lib/plans";
import type { BillingCycle } from "@/components/marketing/billing-toggle";
import { getPublishedOc001Offer } from "@/lib/oc001-public-catalog";
import { Oc001PurchaseAction } from "@/components/marketing/oc001-purchase-action";

export function generateStaticParams() {
  return plans.map((plan) => ({ planSlug: plan.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ planSlug: string }>;
}): Promise<Metadata> {
  const { planSlug } = await params;
  const plan = plansBySlug[planSlug as PlanSlug];
  if (!plan) return {};
  return {
    title: plan.name,
    description: plan.tagline,
  };
}

export default async function PlanDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ planSlug: string }>;
  searchParams: Promise<{ billing?: string }>;
}) {
  const { planSlug } = await params;
  const plan = plansBySlug[planSlug as PlanSlug];
  if (!plan) notFound();
  const offer = await getPublishedOc001Offer(`hpm.${plan.slug}`);

  const { billing: billingParam } = await searchParams;
  const billing: BillingCycle = billingParam === "annual" ? "annual" : "monthly";
  const price =
    plan.monthlyPrice === null
      ? "Custom"
      : billing === "annual"
        ? `$${plan.annualMonthlyEquivalent}`
        : `$${plan.monthlyPrice}`;
  const priceSuffix =
    plan.monthlyPrice === null
      ? "pricing"
      : billing === "annual"
        ? "/ month, billed annually"
        : "/ month";

  const relatedPlans = plans.filter((p) => p.slug !== plan.slug).slice(0, 2);

  return (
    <main className="bg-[#fffdf9]">
      <section className="border-b border-[#dce2dd] bg-[#f6f3eb] py-16">
        <div className="container-shell">
          <nav className="text-xs text-stone-500">
            <Link href="/performance/plans">Compare Plans</Link>
            <span className="mx-2">›</span>
            <span>{plan.name}</span>
          </nav>
          <p className="mt-6 text-xs font-bold uppercase tracking-[.16em] text-[#a56b19]">
            {plan.bestFor}
          </p>
          <h1 className="mt-3 font-serif text-5xl md:text-6xl">{plan.name}</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-[#5f6963]">
            {plan.tagline}
          </p>
        </div>
      </section>

      <section className="py-14">
        <div className="container-shell grid gap-10 lg:grid-cols-[1fr_.45fr]">
          <div className="space-y-12">
            <div>
              <h2 className="font-serif text-3xl">What&apos;s included</h2>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                {lifecycleStages.map((stage) => {
                  const items = plan.featuresByStage[stage.slug];
                  if (!items.length) return null;
                  return (
                    <div
                      key={stage.slug}
                      className="rounded-xl border border-[#dce2dd] bg-white p-5"
                    >
                      <h3 className="text-sm font-bold uppercase tracking-wide text-[#074e38]">
                        {stage.label}
                      </h3>
                      <ul className="mt-3 space-y-2">
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
            </div>

            <div>
              <h2 className="font-serif text-3xl">Who it&apos;s for</h2>
              <ul className="mt-5 space-y-3">
                {plan.whoItsFor.map((item) => (
                  <li key={item} className="flex gap-3 text-sm text-stone-600">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-700" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid gap-8 sm:grid-cols-2">
              <div>
                <h2 className="font-serif text-2xl">Implementation</h2>
                <p className="mt-3 text-sm leading-7 text-stone-600">
                  {plan.implementation}
                </p>
              </div>
              <div>
                <h2 className="font-serif text-2xl">Support</h2>
                <p className="mt-3 text-sm leading-7 text-stone-600">
                  {plan.support}
                </p>
              </div>
            </div>

            {plan.roadmap ? (
              <div>
                <h2 className="font-serif text-2xl">Roadmap</h2>
                <p className="mt-3 text-sm leading-7 text-stone-600">
                  {plan.roadmap}
                </p>
              </div>
            ) : null}

            <div>
              <h2 className="font-serif text-2xl">Related plans</h2>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                {relatedPlans.map((related) => (
                  <PlanCard key={related.slug} plan={related} billing={billing} />
                ))}
              </div>
            </div>
          </div>

          <aside className="h-fit rounded-xl border border-[#dce2dd] bg-white p-6 lg:sticky lg:top-28">
            <p className="text-xs font-bold uppercase tracking-[.14em] text-stone-500">
              {billing === "annual" ? "Billed annually" : "Billed monthly"}
            </p>
            <p className="mt-2 text-4xl font-bold">
              {price}
              <span className="ml-1 text-sm font-normal text-stone-500">
                {priceSuffix}
              </span>
            </p>
            {plan.annualSavingsLabel && billing === "annual" ? (
              <p className="mt-1 text-xs font-semibold text-emerald-700">
                {plan.annualSavingsLabel}
              </p>
            ) : null}
            <div className="mt-4 flex gap-2 text-xs font-semibold">
              <Link
                href={`?billing=monthly`}
                className={billing === "monthly" ? "text-[#074e38] underline" : "text-stone-500"}
              >
                Monthly
              </Link>
              <span className="text-stone-300">/</span>
              <Link
                href={`?billing=annual`}
                className={billing === "annual" ? "text-[#074e38] underline" : "text-stone-500"}
              >
                Annual
              </Link>
            </div>
            <Oc001PurchaseAction offer={offer} configureHref={`/commerce/configure-workspace?plan=${plan.slug}&billing=${billing}`} label={`Choose ${plan.name}`} />
            <Link
              href="/performance/plans"
              className="mt-3 flex min-h-11 items-center justify-center rounded-md border border-[#789487] px-5 text-sm font-semibold text-[#26342e]"
            >
              Compare Plans
            </Link>
          </aside>
        </div>
      </section>
    </main>
  );
}
