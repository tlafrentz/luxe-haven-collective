import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CapabilityCards } from "@/components/marketing/capability-cards";
import { CTASection } from "@/components/marketing/cta-section";
import { PlanCard } from "@/components/marketing/plan-card";
import { plans } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Hospitality Performance Platform",
  description:
    "Run your hospitality business with clarity, confidence, and control. The operating system for independent hospitality businesses.",
};

const trustMetrics = [
  ["100+", "Properties Supported"],
  ["4.9 ★", "Average Review Score"],
  ["2,000+", "Hospitality Operators Served"],
  ["3", "PMS Integrations"],
] as const;

export default function PerformancePlatformPage() {
  return (
    <main className="bg-[#fffdf9]">
      <section className="pb-8 pt-10 lg:pb-16 lg:pt-14">
        <div className="container-shell max-w-3xl">
          <p className="text-[11px] font-bold uppercase leading-5 tracking-[.16em] text-[#a56b19]">
            The Hospitality Performance Platform
          </p>
          <h1 className="mt-5 font-serif text-6xl leading-[.98] tracking-[-.035em] md:text-7xl">
            Run your hospitality business with clarity, confidence, and
            control.
          </h1>
          <p className="mt-7 max-w-xl text-base leading-7 text-stone-600">
            The operating system for independent hospitality businesses that
            connects evidence, decisions, execution, and continuous learning.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/performance/plans"
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[#07533a] px-5 text-sm font-semibold text-white"
            >
              Explore Plans <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/performance/overview"
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[#789487] bg-white px-5 text-sm font-semibold"
            >
              See How It Works <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      <CapabilityCards />

      <section className="py-16">
        <div className="container-shell">
          <p className="text-center text-[10px] font-bold uppercase tracking-[.16em] text-stone-500">
            Trusted by hospitality operators
          </p>
          <div className="mx-auto mt-8 grid max-w-3xl grid-cols-2 gap-6 sm:grid-cols-4">
            {trustMetrics.map(([value, label]) => (
              <div key={label} className="text-center">
                <p className="text-3xl font-bold text-[#171c19]">{value}</p>
                <p className="mt-1 text-xs text-stone-500">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#dce2dd] bg-[#f9faf8] py-16">
        <div className="container-shell">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.16em] text-[#a56b19]">
                Plans
              </p>
              <h2 className="mt-3 font-serif text-4xl">
                A plan for every stage of growth.
              </h2>
            </div>
            <Link
              href="/performance/plans"
              className="text-sm font-semibold text-[#074e38] underline"
            >
              Compare all plans →
            </Link>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {plans
              .filter((plan) => plan.slug !== "enterprise")
              .map((plan) => (
                <PlanCard key={plan.slug} plan={plan} billing="monthly" />
              ))}
          </div>
        </div>
      </section>

      <CTASection />
    </main>
  );
}
