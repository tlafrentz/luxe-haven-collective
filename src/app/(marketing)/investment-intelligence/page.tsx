import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Check,
  FileSearch,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { investmentPackages, investmentSampleReports } from "@/lib/investment-packages";
import { CTASection } from "@/components/marketing/cta-section";

export const metadata: Metadata = {
  title: "Investment Intelligence",
  description:
    "Transparent, evidence-based investment decision analysis for short-term rental properties — from a quick review to full professional underwriting.",
};

const images = [
  "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1400&q=85",
  "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1000&q=85",
];

const trustSignals = ["Google", "Forbes", "BiggerPockets", "Airbnb", "The Real Deal"];

export default function InvestmentIntelligenceLandingPage() {
  const featuredReport = investmentSampleReports[0];

  return (
    <main className="bg-[#f8f5ef] text-[#1e2521]">
      <section className="mx-auto grid min-h-[720px] max-w-[96rem] items-stretch lg:grid-cols-2">
        <div className="flex flex-col justify-center px-6 py-20 lg:px-16">
          <p className="text-xs font-bold uppercase tracking-[.22em] text-[#9a7142]">
            Luxe Haven Investment Intelligence
          </p>
          <h1 className="mt-6 max-w-xl font-serif text-6xl leading-[.95] md:text-7xl">
            Make smarter
            <br />
            investment decisions
            <br />
            <span className="text-[#386f5f]">with confidence.</span>
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-stone-600">
            Transparent, evidence-based property underwriting — market
            intelligence, financial modeling, and a clear recommendation with
            every calculation inspectable and traceable to its source.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/investment-intelligence/packages"
              className="inline-flex items-center gap-2 rounded-full bg-[#17483b] px-7 py-3.5 text-sm font-semibold text-white"
            >
              Explore packages <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/investment-intelligence/sample-reports"
              className="rounded-full border border-[#8fa69d] bg-white px-7 py-3.5 text-sm font-semibold"
            >
              See sample report
            </Link>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            {[
              [<BarChart3 key="i" />, "Market intelligence"],
              [<TrendingUp key="i" />, "Financial modeling"],
              [<FileSearch key="i" />, "Comparable analysis"],
              [<ShieldCheck key="i" />, "Risk assessment"],
            ].map(([icon, label]) => (
              <div
                key={String(label)}
                className="flex items-center gap-2 text-stone-600 [&_svg]:size-4 [&_svg]:text-[#386f5f]"
              >
                {icon}
                {label}
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
            <span className="text-[10px] text-stone-400">As featured in</span>
            {trustSignals.map((name) => (
              <span key={name}>{name}</span>
            ))}
          </div>
        </div>
        <div className="relative min-h-[520px]">
          <Image
            src={images[0]}
            alt="Property investment analysis and market data"
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#f8f5ef] via-transparent to-transparent lg:block hidden" />
        </div>
      </section>

      <section id="packages" className="bg-white py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <Heading
              eyebrow="Compare packages"
              title="Choose the right level of analysis"
              description="From a quick first-look snapshot to full underwriting with expert review."
            />
            <Link
              href="/investment-intelligence/packages"
              className="text-sm font-semibold text-[#17483b] underline"
            >
              Compare all packages →
            </Link>
          </div>
          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {investmentPackages.map((pkg) => (
              <article
                key={pkg.slug}
                className={`rounded-[2rem] border p-7 ${pkg.popular ? "border-[#17483b] bg-[#f1f7f4] ring-2 ring-[#bad2c8]" : "border-stone-200"}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[.18em] text-[#9a7142]">
                      {pkg.comparison.turnaround}
                    </p>
                    <h3 className="mt-2 font-serif text-3xl">{pkg.name}</h3>
                  </div>
                  {pkg.popular ? (
                    <span className="rounded-full bg-[#17483b] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                      Most popular
                    </span>
                  ) : null}
                </div>
                <p className="mt-5 text-4xl font-semibold">
                  {pkg.priceLabel}
                  <span className="ml-1 text-sm font-normal text-stone-500">
                    per analysis
                  </span>
                </p>
                <p className="mt-3 min-h-12 text-sm leading-6 text-stone-500">
                  {pkg.tagline}
                </p>
                <ul className="mt-6 space-y-3 text-sm">
                  {pkg.highlights.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <Check className="mt-0.5 size-4 text-[#386f5f]" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/investment-intelligence/packages/${pkg.slug}`}
                  className={`mt-7 inline-flex w-full justify-center rounded-full px-5 py-3 text-sm font-semibold ${pkg.popular ? "bg-[#17483b] text-white" : "border"}`}
                >
                  Learn more
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <Heading
            eyebrow="Our methodology"
            title="Every number traces back to its source"
            description="Curated data sources, a proven underwriting framework, and clear limitations stated upfront."
          />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Curated data sources", "Licensed short-term-rental market data, refreshed on a defined cadence."],
              ["Proven methodology", "The same documented framework applied to every analysis."],
              ["Expert oversight", "Premier analyses add a licensed analyst's review."],
              ["Clear limitations", "Assumptions, sources, and confidence stated explicitly."],
            ].map(([title, desc]) => (
              <div key={title} className="rounded-2xl border border-stone-200 bg-white p-6">
                <h3 className="font-serif text-xl">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-stone-600">{desc}</p>
              </div>
            ))}
          </div>
          <Link
            href="/investment-intelligence/methodology"
            className="mt-8 inline-flex text-sm font-semibold text-[#17483b] underline"
          >
            Learn more about our methodology →
          </Link>
        </div>
      </section>

      <section id="sample-reports" className="bg-[#173f35] py-24 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-[.75fr_1.25fr] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[#d2b786]">
              Real analysis · Real data
            </p>
            <h2 className="mt-4 font-serif text-5xl">
              See exactly what you&apos;ll receive.
            </h2>
            <p className="mt-5 leading-7 text-white/65">
              A full sample report — market data, financial model, scenario
              comparison, and recommendation — not just a summary page.
            </p>
            <dl className="mt-8 grid grid-cols-3 gap-4">
              <div>
                <dt className="text-xs text-white/50">Property</dt>
                <dd className="mt-2 font-semibold">{featuredReport.propertyLabel}</dd>
              </div>
              <div>
                <dt className="text-xs text-white/50">Strategy</dt>
                <dd className="mt-2 font-semibold">{featuredReport.strategy}</dd>
              </div>
              <div>
                <dt className="text-xs text-white/50">Result</dt>
                <dd className="mt-2 font-semibold">{featuredReport.headline}</dd>
              </div>
            </dl>
            <Link
              href="/investment-intelligence/sample-reports"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#173f35]"
            >
              View sample reports <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="relative aspect-[16/10] overflow-hidden rounded-[2rem]">
            <Image
              src={images[1]}
              alt="Sample investment analysis report"
              fill
              className="object-cover"
            />
          </div>
        </div>
      </section>

      <CTASection
        title="Not sure which package fits your situation?"
        description="Answer a few questions about your property and goals, and we'll recommend a starting point — you can always override it."
        primaryHref="/investment-intelligence/find-my-fit"
        primaryLabel="Find My Best Fit"
        secondaryHref="/investment-intelligence/faq"
        secondaryLabel="Read the FAQ"
      />
    </main>
  );
}

function Heading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header>
      <p className="text-xs font-bold uppercase tracking-[.2em] text-[#9a7142]">
        {eyebrow}
      </p>
      <h2 className="mt-4 max-w-3xl font-serif text-5xl">{title}</h2>
      <p className="mt-4 max-w-2xl text-base leading-7 text-stone-600">
        {description}
      </p>
    </header>
  );
}
