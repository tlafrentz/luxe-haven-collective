import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { SafeImage } from "@/components/shared/safe-image";
import { mesaAirbnbImages } from "@/lib/mesa-airbnb";
import { getPublishedOc001Offer } from "@/lib/oc001-public-catalog";
import { Oc001PurchaseAction } from "@/components/marketing/oc001-purchase-action";
import {
  guidebookPackages,
  guidebookPackagesBySlug,
  type GuidebookPackageSlug,
} from "@/lib/guidebook-packages";

export function generateStaticParams() {
  return guidebookPackages.map((pkg) => ({ slug: pkg.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const pkg = guidebookPackagesBySlug[slug as GuidebookPackageSlug];
  if (!pkg) return {};
  return { title: pkg.name, description: pkg.tagline };
}

export default async function GuidebookPackageDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const pkg = guidebookPackagesBySlug[slug as GuidebookPackageSlug];
  if (!pkg) notFound();
  const offer = await getPublishedOc001Offer(`guidebook.${pkg.slug.replaceAll("-", "_")}`);

  const relatedPackages = guidebookPackages.filter((item) => item.slug !== pkg.slug);

  return (
    <main className="bg-[#fffdf9]">
      <section className="border-b border-[#dce2dd] bg-[#f6f3eb] py-16">
        <div className="container-shell">
          <nav className="text-xs text-stone-500">
            <Link href="/guidebook-studio/packages">Compare Packages</Link>
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

            <div>
              <h2 className="font-serif text-2xl">Additional services</h2>
              <p className="mt-3 text-sm leading-6 text-stone-600">No add-on is currently approved for online purchase. Contact Luxe Haven to discuss additional scope.</p>
            </div>

            <div>
              <h2 className="font-serif text-2xl">Other packages</h2>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                {relatedPackages.map((related) => (
                  <Link
                    key={related.slug}
                    href={`/guidebook-studio/packages/${related.slug}`}
                    className="rounded-xl border bg-white p-5"
                  >
                    <h3 className="font-serif text-xl">{related.name}</h3>
                    <p className="mt-1 text-lg font-bold">{related.priceLabel}</p>
                    <p className="mt-2 text-sm text-stone-600">{related.tagline}</p>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <aside className="h-fit lg:sticky lg:top-28">
            <div className="mx-auto w-48 overflow-hidden rounded-[2rem] border-8 border-[#171c19] bg-[#171c19] shadow-xl">
              <div className="relative aspect-[9/19]">
                <SafeImage
                  src={mesaAirbnbImages[2]}
                  alt={`${pkg.name} guidebook preview`}
                  fill
                  className="object-cover"
                  sizes="200px"
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
              <Oc001PurchaseAction offer={offer} configureHref={`/guidebook-studio/purchase/configure?package=${pkg.slug}`} label="Select This Package" />
              <Link
                href="/guidebook-studio/packages"
                className="mt-3 flex min-h-11 items-center justify-center rounded-md border border-[#789487] px-5 text-sm font-semibold text-[#26342e]"
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
