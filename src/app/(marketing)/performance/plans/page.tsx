import type { Metadata } from "next";
import Link from "next/link";
import { BillingToggle, type BillingCycle } from "@/components/marketing/billing-toggle";
import { PlanCard } from "@/components/marketing/plan-card";
import { PlanComparisonTable } from "@/components/marketing/plan-comparison-table";
import { FaqAccordion } from "@/components/marketing/faq-accordion";
import { plans } from "@/lib/plans";
import { faqs } from "@/lib/faqs";
import { getPublishedOc001Offers } from "@/lib/oc001-public-catalog";

export const metadata: Metadata = {
  title: "Compare Plans",
  description:
    "Compare Starter, Professional, Portfolio, and Enterprise plans for the Hospitality Performance Platform.",
};

export default async function ComparePlansPage({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string; plan?: string }>;
}) {
  const params = await searchParams;
  const billing: BillingCycle = params.billing === "annual" ? "annual" : "monthly";
  const selectedPlan = params.plan;
  const publishedOffers = await getPublishedOc001Offers("hpm");
  const pricingFaqs = faqs.filter(
    (faq) => faq.audience === "owners" && faq.category === "revenue-pricing",
  );

  return (
    <main className="bg-[#fffdf9]">
      <section className="border-b border-[#dce2dd] bg-[#f6f3eb] py-16">
        <div className="container-shell">
          <nav className="text-xs text-stone-500">
            <Link href="/performance">HPM Platform</Link>
            <span className="mx-2">›</span>
            <span>Compare Plans</span>
          </nav>
          <h1 className="mt-6 max-w-3xl font-serif text-5xl md:text-6xl">
            Find the plan that fits your business.
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-[#5f6963]">
            Every plan includes the Hospitality Performance Platform&apos;s Observe,
            Understand, Decide, Execute, and Learn lifecycle. Higher tiers add
            more properties, more depth, and more support.
          </p>
          <div className="mt-8">
            <BillingToggle billing={billing} />
          </div>
        </div>
      </section>

      <section className="py-14">
        <div className="container-shell grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <PlanCard
              key={plan.slug}
              plan={plan}
              billing={billing}
              selected={selectedPlan === plan.slug}
              ctaLabel={publishedOffers.some(offer => offer.offerCode === `hpm.${plan.slug}` && offer.checkoutAvailable) ? "Choose Plan" : "View availability"}
            />
          ))}
        </div>
      </section>

      <section className="pb-16">
        <div className="container-shell">
          <h2 className="mb-6 font-serif text-3xl">Compare every feature.</h2>
          <PlanComparisonTable />
        </div>
      </section>

      <section className="border-t border-[#dce2dd] bg-[#f9faf8] py-16">
        <div className="container-shell max-w-3xl">
          <h2 className="font-serif text-3xl">Pricing questions</h2>
          <div className="mt-6">
            <FaqAccordion faqs={pricingFaqs} />
          </div>
          <p className="mt-6 text-sm text-stone-600">
            See all questions on the{" "}
            <Link href="/faq" className="font-semibold underline">
              FAQ page
            </Link>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
