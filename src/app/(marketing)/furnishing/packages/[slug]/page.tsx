import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import {
  furnishingPackages,
  furnishingPackagesBySlug,
  type FurnishingPackageSlug,
} from "@/lib/furnishing-packages";

const heroImage =
  "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=85";

export function generateStaticParams() {
  return furnishingPackages.map((pkg) => ({ slug: pkg.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const pkg = furnishingPackagesBySlug[slug as FurnishingPackageSlug];
  if (!pkg) return {};
  return { title: pkg.name, description: pkg.tagline };
}

export default async function FurnishingPackageDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const pkg = furnishingPackagesBySlug[slug as FurnishingPackageSlug];
  if (!pkg) notFound();

  const relatedPackages = furnishingPackages.filter(
    (item) => item.slug !== pkg.slug,
  );

  return (
    <main className="bg-[#fffdf9]">
      <section className="border-b border-[#dce2dd] bg-[#f6f3eb] py-16">
        <div className="container-shell">
          <nav className="text-xs text-stone-500">
            <Link href="/furnishing/packages">Compare Packages</Link>
            <span className="mx-2">›</span>
            <span>{pkg.name}</span>
          </nav>
          <p className="mt-6 text-xs font-bold uppercase tracking-[.16em] text-[#a56b19]">
            {pkg.startingAt ? "Starting at" : "One-time"} {pkg.priceLabel}
          </p>
          <h1 className="mt-3 font-serif text-5xl md:text-6xl">{pkg.name}</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-[#5f6963]">
            {pkg.description}
          </p>
        </div>
      </section>

      <section className="py-14">
        <div className="container-shell grid gap-10 lg:grid-cols-[1fr_.45fr]">
          <div className="space-y-10">
            <div>
              <h2 className="font-serif text-3xl">What&apos;s included</h2>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {pkg.features.map((item) => (
                  <li
                    key={item}
                    className="flex gap-2 rounded-xl border border-[#dce2dd] bg-white p-4 text-sm text-stone-700"
                  >
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-700" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="rounded-xl border border-[#dce2dd] bg-white p-5">
                <h3 className="font-serif text-xl">Scope &amp; timeline</h3>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-stone-500">Property size</dt>
                    <dd className="text-right font-medium">
                      {pkg.comparison.propertySize}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-stone-500">Typical duration</dt>
                    <dd className="text-right font-medium">
                      {pkg.comparison.typicalTimeline}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-stone-500">Delivery</dt>
                    <dd className="text-right font-medium">
                      {pkg.comparison.delivery ? "Included" : "Not included"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-stone-500">Installation</dt>
                    <dd className="text-right font-medium">
                      {pkg.comparison.installation
                        ? "Included"
                        : "Not included"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-stone-500">Revisions</dt>
                    <dd className="text-right font-medium">
                      {pkg.comparison.revisions}
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="rounded-xl border border-[#dce2dd] bg-white p-5">
                <h3 className="font-serif text-xl">Not included</h3>
                <ul className="mt-4 space-y-2 text-sm text-stone-600">
                  {pkg.exclusions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <p className="mt-4 text-xs text-stone-500">
                  {pkg.eligibilityLimitations}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-[#dce2dd] bg-white p-5">
              <h3 className="font-serif text-xl">
                Payment, cancellation &amp; refunds
              </h3>
              <p className="mt-3 text-sm leading-6 text-stone-600">
                A deposit is due at checkout; the remaining balance follows
                your order&apos;s payment schedule. This package price covers
                the design and project-management service only — the
                furnishing budget for actual products is estimated separately
                with you during Launch Setup and is never included in this
                order automatically.
              </p>
              <p className="mt-3 text-sm leading-6 text-stone-600">
                {pkg.cancellationPolicy}
              </p>
            </div>

            <div>
              <h2 className="font-serif text-2xl">Add-ons</h2>
              <p className="mt-3 text-sm leading-6 text-stone-600">
                Compatible add-ons for this package are shown during purchase
                configuration, once your property details are known.
              </p>
            </div>

            <div>
              <h2 className="font-serif text-2xl">Other packages</h2>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                {relatedPackages.map((related) => (
                  <Link
                    key={related.slug}
                    href={`/furnishing/packages/${related.slug}`}
                    className="rounded-xl border bg-white p-5"
                  >
                    <h3 className="font-serif text-xl">{related.name}</h3>
                    <p className="mt-1 text-lg font-bold">
                      {related.priceLabel}
                    </p>
                    <p className="mt-2 text-sm text-stone-600">
                      {related.tagline}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <aside className="h-fit lg:sticky lg:top-28">
            <div className="overflow-hidden rounded-[1.5rem]">
              <div className="relative aspect-[4/5]">
                <Image
                  src={heroImage}
                  alt={`${pkg.name} furnishing package example`}
                  fill
                  className="object-cover"
                  sizes="320px"
                />
              </div>
            </div>
            <div className="mt-6 rounded-xl border border-[#dce2dd] bg-white p-6">
              <p className="text-4xl font-bold">
                {pkg.priceLabel}
                <span className="ml-1 text-sm font-normal text-stone-500">
                  {pkg.startingAt ? "starting at" : "one-time"}
                </span>
              </p>
              <Link
                href={`/furnishing/purchase/configure?package=${pkg.slug}`}
                className="mt-6 flex min-h-11 items-center justify-center rounded-md bg-emerald-900 px-5 text-sm font-semibold text-white transition hover:bg-emerald-800"
              >
                Select This Package
              </Link>
              <Link
                href="/furnishing/rooms"
                className="mt-3 flex min-h-11 items-center justify-center rounded-md border border-[#789487] px-5 text-sm font-semibold text-[#26342e]"
              >
                See Room Examples
              </Link>
              <Link
                href="/furnishing/packages"
                className="mt-3 flex min-h-11 items-center justify-center rounded-md border border-transparent px-5 text-sm font-semibold text-[#26342e] underline"
              >
                Compare Packages
              </Link>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
