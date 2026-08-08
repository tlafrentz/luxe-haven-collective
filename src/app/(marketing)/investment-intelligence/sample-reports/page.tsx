import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { investmentSampleReports } from "@/lib/investment-packages";

export const metadata: Metadata = {
  title: "Sample Reports",
  description: "See real examples of Investment Intelligence analysis reports.",
};

export default function InvestmentSampleReportsPage() {
  return (
    <main className="bg-[#fffdf9]">
      <section className="border-b border-[#dce2dd] bg-[#f6f3eb] py-16">
        <div className="container-shell">
          <nav className="text-xs text-stone-500">
            <Link href="/investment-intelligence">Investment Intelligence</Link>
            <span className="mx-2">›</span>
            <span>Sample Reports</span>
          </nav>
          <h1 className="mt-6 max-w-3xl font-serif text-5xl md:text-6xl">
            See exactly what you&apos;ll receive.
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-[#5f6963]">
            Representative examples of completed analyses, across strategies
            and package tiers. Your report will reflect your property&apos;s
            actual data and assumptions.
          </p>
        </div>
      </section>

      <section className="py-14">
        <div className="container-shell space-y-6">
          {investmentSampleReports.map((report) => (
            <article
              key={report.slug}
              className="grid gap-6 rounded-xl border border-[#dce2dd] bg-white p-6 lg:grid-cols-[1fr_.3fr] lg:items-center"
            >
              <div>
                <p className="text-xs font-bold uppercase tracking-[.16em] text-[#a56b19]">
                  {report.packageName} · {report.strategy}
                </p>
                <h2 className="mt-2 font-serif text-3xl">{report.propertyLabel}</h2>
                <p className="mt-3 text-sm leading-6 text-stone-600">
                  {report.description}
                </p>
                <p className="mt-4 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                  {report.headline}
                </p>
              </div>
              <div className="flex flex-col gap-2 lg:items-end">
                <span className="text-xs text-stone-400">
                  Full report available after purchase
                </span>
                <Link
                  href="/investment-intelligence/packages"
                  className="inline-flex items-center gap-2 rounded-md border px-5 py-2.5 text-sm font-semibold"
                >
                  Compare packages <ArrowRight className="size-4" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-[#dce2dd] bg-[#f9faf8] py-14">
        <div className="container-shell">
          <p className="text-sm text-stone-500">
            Every sample above reflects a real analysis structure — actual
            property identities and financial details are illustrative.
            Want to see our methodology behind these numbers?{" "}
            <Link href="/investment-intelligence/methodology" className="font-semibold underline">
              Read our methodology →
            </Link>
          </p>
          <p className="mt-4 text-sm text-stone-500">
            More sample reports and package walkthroughs are available on
            request —{" "}
            <Link href="/contact" className="font-semibold underline">
              contact us
            </Link>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
