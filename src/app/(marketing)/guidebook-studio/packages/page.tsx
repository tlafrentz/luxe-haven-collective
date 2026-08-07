import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import {
  guidebookAddOns,
  guidebookPackages,
  guidebookPlanIncludes,
} from "@/lib/guidebook-packages";

export const metadata: Metadata = {
  title: "Compare Packages",
  description:
    "Compare DIY, Done For You, and Premium Guidebook Studio packages.",
};

export default function GuidebookStudioPackagesPage() {
  return (
    <main className="bg-[#fffdf9]">
      <section className="border-b border-[#dce2dd] bg-[#f6f3eb] py-16">
        <div className="container-shell">
          <nav className="text-xs text-stone-500">
            <Link href="/guidebook-studio">Guidebook Studio</Link>
            <span className="mx-2">›</span>
            <span>Compare Packages</span>
          </nav>
          <h1 className="mt-6 max-w-3xl font-serif text-5xl md:text-6xl">
            Choose the guidebook experience that fits your needs.
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-[#5f6963]">
            {guidebookPlanIncludes.join(" · ")}
          </p>
        </div>
      </section>

      <section className="py-14">
        <div className="container-shell grid gap-5 md:grid-cols-3">
          {guidebookPackages.map((pkg) => (
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
                  <li key={item} className="flex items-start gap-2 text-sm text-stone-700">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-700" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href={`/guidebook-studio/packages/${pkg.slug}`}
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
        <div className="container-shell max-w-3xl">
          <h2 className="font-serif text-3xl">Add-ons available</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {guidebookAddOns.map((addOn) => (
              <div key={addOn.slug} className="rounded-xl border bg-white p-5">
                <p className="font-semibold">{addOn.name}</p>
                <p className="mt-1 text-sm font-bold text-emerald-800">{addOn.priceLabel}</p>
                <p className="mt-2 text-xs leading-5 text-stone-600">{addOn.description}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm text-stone-500">
            All plans include {guidebookPlanIncludes.map((item) => item.toLowerCase()).join(", ")}.
          </p>
        </div>
      </section>
    </main>
  );
}
