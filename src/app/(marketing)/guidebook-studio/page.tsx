import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Smartphone, RefreshCw, Hammer } from "lucide-react";
import { SafeImage } from "@/components/shared/safe-image";
import { mesaAirbnbImages } from "@/lib/mesa-airbnb";
import { guidebookPackages } from "@/lib/guidebook-packages";
import { CTASection } from "@/components/marketing/cta-section";

export const metadata: Metadata = {
  title: "Guidebook Studio",
  description:
    "Create unforgettable stays with a beautiful digital guidebook. Everything your guests need, all in one place.",
};

const bullets = [
  [Hammer, "Easy to build"],
  [Smartphone, "Mobile optimized"],
  [RefreshCw, "Always up to date"],
] as const;

export default function GuidebookStudioLandingPage() {
  return (
    <main className="bg-[#fffdf9]">
      <section className="border-b">
        <div className="container-shell grid gap-8 lg:grid-cols-2 lg:items-stretch">
          <div className="py-14 lg:py-20">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[#a56b19]">
              Guidebook Studio
            </p>
            <h1 className="mt-5 max-w-xl font-serif text-5xl leading-[1.07] md:text-6xl">
              Create unforgettable stays with a beautiful digital guidebook.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-stone-600">
              Everything your guests need. All in one place.
            </p>
            <div className="mt-8 grid max-w-sm gap-3">
              {bullets.map(([Icon, label]) => (
                <p key={label} className="flex items-center gap-3 text-sm font-medium text-stone-700">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full border border-[#dce2dd] bg-white text-emerald-800">
                    <Icon className="size-4" />
                  </span>
                  {label}
                </p>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/guidebook-studio/packages"
                className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[#07533a] px-5 text-sm font-semibold text-white"
              >
                Explore Packages <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/guidebook-studio/examples"
                className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[#789487] bg-white px-5 text-sm font-semibold"
              >
                See Examples <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
          <div className="relative min-h-[380px]">
            <SafeImage
              src={mesaAirbnbImages[1]}
              alt=""
              fill
              priority
              className="object-cover"
              sizes="50vw"
            />
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container-shell">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.16em] text-[#a56b19]">
                Packages
              </p>
              <h2 className="mt-3 font-serif text-4xl">
                Choose the guidebook experience that fits.
              </h2>
            </div>
            <Link
              href="/guidebook-studio/packages"
              className="text-sm font-semibold text-[#074e38] underline"
            >
              Compare all packages →
            </Link>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {guidebookPackages.map((pkg) => (
              <article
                key={pkg.slug}
                className={`rounded-xl border bg-white p-6 ${pkg.popular ? "border-emerald-800 shadow-sm" : ""}`}
              >
                {pkg.popular ? (
                  <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-800">
                    Most popular
                  </span>
                ) : null}
                <h3 className="mt-3 font-serif text-2xl">{pkg.name}</h3>
                <p className="mt-2 text-2xl font-bold">
                  {pkg.priceLabel}
                  {pkg.startingAt ? (
                    <span className="ml-1 text-sm font-normal text-stone-500">starting at</span>
                  ) : (
                    <span className="ml-1 text-sm font-normal text-stone-500">one-time</span>
                  )}
                </p>
                <p className="mt-2 text-sm text-stone-600">{pkg.tagline}</p>
                <ul className="mt-5 space-y-2">
                  {pkg.highlights.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-stone-700">
                      <Check className="mt-0.5 size-4 shrink-0 text-emerald-700" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/guidebook-studio/packages/${pkg.slug}`}
                  className="mt-6 inline-flex text-sm font-semibold text-emerald-800"
                >
                  Learn more →
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <CTASection
        title="See how it looks before you decide."
        description="Browse real guidebook examples and professional templates, or take our two-minute quiz to find your best fit."
        primaryHref="/guidebook-studio/find-my-fit"
        primaryLabel="Find My Best Fit"
        secondaryHref="/guidebook-studio/examples"
        secondaryLabel="See Examples"
      />
    </main>
  );
}
