import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CommerceProgressHeader } from "@/components/commerce/commerce-progress-header";
import {
  furnishingPackagesBySlug,
  type FurnishingPackageSlug,
} from "@/lib/furnishing-packages";
import { purchaseSteps, purchaseStepLabels } from "../steps";
import type { FurnishingPurchaseParams } from "@/lib/furnishing-purchase-params";

export const metadata: Metadata = {
  title: "Configure Purchase",
  description: "Tell us about your property.",
};

export default async function ConfigurePurchasePage({
  searchParams,
}: {
  searchParams: Promise<FurnishingPurchaseParams>;
}) {
  const params = await searchParams;
  const pkg = params.package
    ? furnishingPackagesBySlug[params.package as FurnishingPackageSlug]
    : undefined;
  if (!pkg) redirect("/furnishing/packages");

  return (
    <main>
      <CommerceProgressHeader
        current="configure"
        steps={purchaseSteps}
        labels={purchaseStepLabels}
      />
      <div className="container-shell py-10 md:py-14">
        <div className="mx-auto max-w-2xl rounded-2xl border border-[#dce2dd] bg-white p-6 md:p-10">
          <h1 className="font-serif text-4xl">Tell us about your property.</h1>
          <p className="mt-2 text-sm text-stone-600">
            {pkg.name} — {pkg.priceLabel}{" "}
            {pkg.startingAt ? "starting at" : "one-time"}
          </p>
          <form
            method="get"
            action="/furnishing/purchase/account"
            className="mt-7 space-y-5"
          >
            <input type="hidden" name="package" value={pkg.slug} />

            <label className="block text-sm font-medium text-stone-700">
              Property Type
              <select
                name="propertyType"
                defaultValue="short_term_rental"
                className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none ring-brass/20 focus:ring-4"
              >
                <option value="short_term_rental">Short-term rental</option>
                <option value="mid_term_rental">Mid-term rental</option>
                <option value="boutique_hotel">Boutique hotel</option>
              </select>
            </label>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block text-sm font-medium text-stone-700">
                Bedrooms
                <input
                  name="bedrooms"
                  type="number"
                  min={0}
                  defaultValue={2}
                  className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none ring-brass/20 focus:ring-4"
                />
              </label>
              <label className="block text-sm font-medium text-stone-700">
                Bathrooms
                <input
                  name="bathrooms"
                  type="number"
                  min={0}
                  step={0.5}
                  defaultValue={2}
                  className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none ring-brass/20 focus:ring-4"
                />
              </label>
            </div>

            <label className="block text-sm font-medium text-stone-700">
              Approximate size
              <select
                name="sizeRange"
                defaultValue="1000-2000"
                className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none ring-brass/20 focus:ring-4"
              >
                <option value="under-1000">Under 1,000 sq ft</option>
                <option value="1000-2000">1,000 – 2,000 sq ft</option>
                <option value="2000-3500">2,000 – 3,500 sq ft</option>
                <option value="over-3500">Over 3,500 sq ft</option>
              </select>
            </label>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block text-sm font-medium text-stone-700">
                Target market
                <input
                  name="market"
                  placeholder="e.g. Scottsdale, AZ"
                  className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none ring-brass/20 focus:ring-4"
                />
              </label>
              <label className="block text-sm font-medium text-stone-700">
                ZIP or service region
                <input
                  name="zip"
                  placeholder="e.g. 85254"
                  className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none ring-brass/20 focus:ring-4"
                />
              </label>
            </div>

            <label className="block text-sm font-medium text-stone-700">
              Promo Code (optional)
              <input
                name="promo"
                className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none ring-brass/20 focus:ring-4"
              />
            </label>

            <button
              type="submit"
              className="w-full rounded-2xl bg-emerald-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800"
            >
              Continue
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
