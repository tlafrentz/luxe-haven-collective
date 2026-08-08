import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import {
  furnishingPackages,
  furnishingPlanIncludes,
} from "@/lib/furnishing-packages";

export const metadata: Metadata = {
  title: "Compare Packages",
  description:
    "Compare Essential, Elevated, and Luxury Furnishing Studio packages.",
};

const comparisonRows: {
  label: string;
  value: (pkg: (typeof furnishingPackages)[number]) => ReactNode;
}[] = [
  {
    label: "Starting price",
    value: (pkg) => pkg.priceLabel,
  },
  {
    label: "Supported property size",
    value: (pkg) => pkg.comparison.propertySize,
  },
  {
    label: "Design service level",
    value: (pkg) => pkg.comparison.designServiceLevel,
  },
  {
    label: "Furniture quality level",
    value: (pkg) => pkg.comparison.furnitureQualityLevel,
  },
  {
    label: "Room coverage",
    value: (pkg) => pkg.comparison.roomCoverage,
  },
  {
    label: "Revisions",
    value: (pkg) => pkg.comparison.revisions,
  },
  {
    label: "Delivery support",
    value: (pkg) => <BoolIcon value={pkg.comparison.delivery} />,
  },
  {
    label: "Installation support",
    value: (pkg) => <BoolIcon value={pkg.comparison.installation} />,
  },
  {
    label: "Styling & staging",
    value: (pkg) => <BoolIcon value={pkg.comparison.styling} />,
  },
  {
    label: "Concierge project management",
    value: (pkg) => <BoolIcon value={pkg.comparison.concierge} />,
  },
  {
    label: "Typical timeline",
    value: (pkg) => pkg.comparison.typicalTimeline,
  },
  {
    label: "Eligibility limitations",
    value: (pkg) => (
      <span className="text-xs text-stone-500">
        {pkg.eligibilityLimitations}
      </span>
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

export default function FurnishingPackagesPage() {
  return (
    <main className="bg-[#fffdf9]">
      <section className="border-b border-[#dce2dd] bg-[#f6f3eb] py-16">
        <div className="container-shell">
          <nav className="text-xs text-stone-500">
            <Link href="/furnishing">Furnishing Studio</Link>
            <span className="mx-2">›</span>
            <span>Compare Packages</span>
          </nav>
          <h1 className="mt-6 max-w-3xl font-serif text-5xl md:text-6xl">
            Choose the furnishing experience that fits your property.
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-[#5f6963]">
            {furnishingPlanIncludes.join(" · ")}
          </p>
        </div>
      </section>

      <section className="py-14">
        <div className="container-shell grid gap-5 md:grid-cols-3">
          {furnishingPackages.map((pkg) => (
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
                  {pkg.startingAt ? "starting at" : "one-time"}
                </span>
              </p>
              <p className="mt-2 text-sm text-stone-600">{pkg.tagline}</p>
              <ul className="mt-5 flex-1 space-y-2">
                {pkg.highlights.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-sm text-stone-700"
                  >
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-700" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href={`/furnishing/packages/${pkg.slug}`}
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
                  {furnishingPackages.map((pkg) => (
                    <th key={pkg.slug} className="p-4 text-center font-semibold">
                      {pkg.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.label} className="border-t">
                    <th
                      scope="row"
                      className="p-4 text-left font-medium text-stone-600"
                    >
                      {row.label}
                    </th>
                    {furnishingPackages.map((pkg) => (
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
            All packages include {furnishingPlanIncludes
              .map((item) => item.toLowerCase())
              .join(", ")}
            . Package price covers design and project-management services —
            the furnishing budget for products is estimated separately during
            Launch Setup.
          </p>
          <p className="mt-3 text-sm text-stone-500">
            Not sure which fits?{" "}
            <Link
              href="/furnishing/find-my-fit"
              className="font-semibold underline"
            >
              Find My Best Fit →
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
