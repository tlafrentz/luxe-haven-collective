import type { Metadata } from "next";
import Link from "next/link";
import { Hammer, HandHelping, Crown, ArrowRight } from "lucide-react";
import { guidebookPackagesBySlug } from "@/lib/guidebook-packages";

export const metadata: Metadata = {
  title: "Find My Best Fit",
  description: "Answer a few questions and we'll recommend the perfect package.",
};

const options = [
  {
    icon: Hammer,
    label: "I want to build it myself",
    packageSlug: "diy" as const,
  },
  {
    icon: HandHelping,
    label: "I want professional help",
    packageSlug: "done-for-you" as const,
  },
  {
    icon: Crown,
    label: "I want full-service",
    packageSlug: "premium" as const,
  },
];

export default function GuidebookFindMyFitPage() {
  return (
    <main className="bg-[#fffdf9]">
      <section className="py-16">
        <div className="container-shell max-w-2xl text-center">
          <nav className="text-left text-xs text-stone-500">
            <Link href="/guidebook-studio">Guidebook Studio</Link>
            <span className="mx-2">›</span>
            <span>Find My Best Fit</span>
          </nav>
          <h1 className="mt-8 font-serif text-4xl md:text-5xl">
            Answer a few questions and we&apos;ll recommend the perfect package.
          </h1>
          <p className="mt-4 text-lg text-stone-600">
            How do you prefer to create your guidebook?
          </p>
          <div className="mt-9 grid gap-4">
            {options.map((option) => {
              const Icon = option.icon;
              const pkg = guidebookPackagesBySlug[option.packageSlug];
              return (
                <Link
                  key={option.label}
                  href={`/guidebook-studio/packages/${option.packageSlug}`}
                  className="flex items-center gap-4 rounded-xl border bg-white p-5 text-left transition hover:border-emerald-800"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#f6f3eb] text-emerald-800">
                    <Icon className="size-5" />
                  </span>
                  <span className="flex-1">
                    <span className="block font-semibold">{option.label}</span>
                    <span className="block text-xs text-stone-500">
                      Recommended: {pkg.name} ({pkg.priceLabel})
                    </span>
                  </span>
                  <ArrowRight className="size-5 text-stone-400" />
                </Link>
              );
            })}
          </div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[.14em] text-stone-500">
            Takes 2 minutes
          </p>
        </div>
      </section>
    </main>
  );
}
