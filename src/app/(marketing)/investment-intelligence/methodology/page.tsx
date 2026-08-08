import type { Metadata } from "next";
import Link from "next/link";
import { investmentMethodologyPillars, investmentPackages } from "@/lib/investment-packages";

export const metadata: Metadata = {
  title: "Our Methodology",
  description: "How Investment Intelligence analyses are built, sourced, and reviewed.",
};

export default function InvestmentMethodologyPage() {
  return (
    <main className="bg-[#fffdf9]">
      <section className="border-b border-[#dce2dd] bg-[#f6f3eb] py-16">
        <div className="container-shell">
          <nav className="text-xs text-stone-500">
            <Link href="/investment-intelligence">Investment Intelligence</Link>
            <span className="mx-2">›</span>
            <span>Methodology</span>
          </nav>
          <h1 className="mt-6 max-w-3xl font-serif text-5xl md:text-6xl">
            Every number traces back to its source.
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-[#5f6963]">
            An investment analysis is only useful if you can trust — and
            verify — where the numbers came from. Here&apos;s exactly how we
            build every report.
          </p>
        </div>
      </section>

      <section className="py-14">
        <div className="container-shell grid gap-6 sm:grid-cols-2">
          {investmentMethodologyPillars.map((pillar) => (
            <div key={pillar.title} className="rounded-xl border border-[#dce2dd] bg-white p-6">
              <h2 className="font-serif text-2xl">{pillar.title}</h2>
              <p className="mt-3 text-sm leading-6 text-stone-600">{pillar.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-[#dce2dd] bg-[#f9faf8] py-14">
        <div className="container-shell">
          <h2 className="font-serif text-3xl">How an analysis is built</h2>
          <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["1. Market intelligence", "ADR, occupancy, RevPAR, and seasonality pulled from licensed market data providers for your property's specific market."],
              ["2. Financial modeling", "Purchase, financing, and operating assumptions combined into a full revenue and expense projection."],
              ["3. Scenario & risk analysis", "Base, optimistic, and conservative cases (plus a custom case on Premier), with sensitivity testing on key assumptions."],
              ["4. Recommendation", "An overall recommendation with a stated confidence level, key strengths, and risk flags — every figure links back to its source and formula."],
            ].map(([title, desc]) => (
              <li key={title} className="rounded-xl border bg-white p-5">
                <p className="font-semibold">{title}</p>
                <p className="mt-2 text-sm text-stone-600">{desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="py-14">
        <div className="container-shell rounded-xl border border-amber-200 bg-amber-50 p-8">
          <h2 className="font-serif text-2xl text-amber-950">Limitations</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-amber-900">
            An Investment Intelligence analysis is a decision-support tool
            built from historical and current market data — it is not a
            guarantee of future performance, and it is not legal, tax, or
            financing advice. Market conditions change, and every report
            states its data sources, key assumptions, and confidence level so
            you can weigh them yourself. Premier analyses add a licensed
            analyst&apos;s review of assumptions and conclusions, but the
            final investment decision, and any associated risk, remains
            yours.
          </p>
        </div>
      </section>

      <section className="border-t border-[#dce2dd] py-14">
        <div className="container-shell text-center">
          <h2 className="font-serif text-3xl">Ready to see it in action?</h2>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/investment-intelligence/sample-reports"
              className="rounded-full border px-6 py-3 text-sm font-semibold"
            >
              View sample reports
            </Link>
            <Link
              href="/investment-intelligence/packages"
              className="rounded-full bg-emerald-900 px-6 py-3 text-sm font-semibold text-white"
            >
              Compare packages
            </Link>
          </div>
          <p className="mt-6 text-xs text-stone-400">
            {investmentPackages.length} package tiers · from{" "}
            {investmentPackages[0].priceLabel}
          </p>
        </div>
      </section>
    </main>
  );
}
