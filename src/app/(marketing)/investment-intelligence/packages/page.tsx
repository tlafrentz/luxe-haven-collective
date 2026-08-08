import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { investmentPackages } from "@/lib/investment-packages";

export const metadata: Metadata = {
  title: "Compare Packages",
  description: "Compare Essentials, Pro, and Premier Investment Intelligence packages.",
};

const comparisonRows: {
  label: string;
  value: (pkg: (typeof investmentPackages)[number]) => ReactNode;
}[] = [
  { label: "Price", value: (pkg) => pkg.priceLabel },
  { label: "Market analysis", value: (pkg) => pkg.comparison.marketAnalysis },
  { label: "Financial modeling", value: (pkg) => pkg.comparison.financialModeling },
  { label: "Comparable properties", value: (pkg) => pkg.comparison.comparableProperties },
  { label: "Scenarios modeled", value: (pkg) => pkg.comparison.scenarios },
  { label: "Risk assessment", value: (pkg) => pkg.comparison.riskAssessment },
  { label: "Expert analyst review", value: (pkg) => <BoolIcon value={pkg.comparison.expertReview} /> },
  { label: "Turnaround", value: (pkg) => pkg.comparison.turnaround },
  {
    label: "Eligibility limitations",
    value: (pkg) => (
      <span className="text-xs text-stone-500">{pkg.eligibilityLimitations}</span>
    ),
  },
];

function BoolIcon({ value }: { value: boolean }) {
  return value ? (
    <Check className="mx-auto size-4 text-emerald-700" aria-label="Included" />
  ) : (
    <X className="mx-auto size-4 text-stone-300" aria-label="Not included" />
  );
}

export default function InvestmentIntelligencePackagesPage() {
  return (
    <main className="bg-[#fffdf9]">
      <section className="border-b border-[#dce2dd] bg-[#f6f3eb] py-16">
        <div className="container-shell">
          <nav className="text-xs text-stone-500">
            <Link href="/investment-intelligence">Investment Intelligence</Link>
            <span className="mx-2">›</span>
            <span>Compare Packages</span>
          </nav>
          <h1 className="mt-6 max-w-3xl font-serif text-5xl md:text-6xl">
            Choose the right level of analysis.
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-[#5f6963]">
            Every package includes inspectable calculations, clearly stated
            assumptions, and an overall recommendation with a confidence
            level.
          </p>
        </div>
      </section>

      <section className="py-14">
        <div className="container-shell grid gap-5 md:grid-cols-3">
          {investmentPackages.map((pkg) => (
            <article
              key={pkg.slug}
              className={`flex flex-col rounded-xl border bg-white p-6 ${pkg.popular ? "border-emerald-800 shadow-sm" : ""}`}
            >
              {pkg.popular ? (
                <span className="inline-flex w-fit rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-800">
                  Most popular
                </span>
              ) : null}
              <h2 className="mt-3 font-serif text-3xl">{pkg.name}</h2>
              <p className="mt-2 text-3xl font-bold">
                {pkg.priceLabel}
                <span className="ml-1 text-sm font-normal text-stone-500">
                  per analysis
                </span>
              </p>
              <p className="mt-2 text-sm text-stone-600">{pkg.tagline}</p>
              <ul className="mt-5 flex-1 space-y-2">
                {pkg.highlights.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-stone-700">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-700" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href={`/investment-intelligence/packages/${pkg.slug}`}
                className={
                  pkg.popular
                    ? "mt-6 flex justify-center rounded-md bg-emerald-900 px-5 py-3 text-sm font-semibold text-white"
                    : "mt-6 flex justify-center rounded-md border px-5 py-3 text-sm font-semibold"
                }
              >
                Choose
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-[#dce2dd] bg-[#f9faf8] py-14">
        <div className="container-shell">
          <h2 className="font-serif text-3xl">Full comparison</h2>
          <div className="mt-6 overflow-x-auto rounded-xl border bg-white">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-stone-50">
                <tr>
                  <th className="p-4 font-semibold">&nbsp;</th>
                  {investmentPackages.map((pkg) => (
                    <th key={pkg.slug} className="p-4 text-center font-semibold">
                      {pkg.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.label} className="border-t">
                    <th scope="row" className="p-4 text-left font-medium text-stone-600">
                      {row.label}
                    </th>
                    {investmentPackages.map((pkg) => (
                      <td key={pkg.slug} className="p-4 text-center">
                        {row.value(pkg)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-6 text-sm text-stone-500">
            Does the package price include ongoing portfolio advisory? No —
            each package is a single, self-contained analysis. For
            multi-property portfolio work, contact us about a custom Portfolio
            Advisory engagement.
          </p>
          <p className="mt-3 text-sm text-stone-500">
            Not sure which fits?{" "}
            <Link href="/investment-intelligence/find-my-fit" className="font-semibold underline">
              Find My Best Fit →
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
