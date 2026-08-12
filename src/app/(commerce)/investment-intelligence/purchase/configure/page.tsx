import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CommerceProgressHeader } from "@/components/commerce/commerce-progress-header";
import {
  investmentPackagesBySlug,
  type InvestmentPackageSlug,
} from "@/lib/investment-packages";
import { purchaseSteps, purchaseStepLabels } from "../steps";
import type { InvestmentPurchaseParams } from "@/lib/investment-purchase-params";

export const metadata: Metadata = {
  title: "Configure Purchase",
  description: "Tell us about the property you're evaluating.",
};

export default async function ConfigurePurchasePage({
  searchParams,
}: {
  searchParams: Promise<InvestmentPurchaseParams>;
}) {
  const params = await searchParams;
  const pkg = params.package
    ? investmentPackagesBySlug[params.package as InvestmentPackageSlug]
    : undefined;
  if (!pkg) redirect("/investment-intelligence/packages");

  return (
    <main>
      <CommerceProgressHeader
        current="configure"
        steps={purchaseSteps}
        labels={purchaseStepLabels}
      />
      <div className="container-shell py-10 md:py-14">
        <div className="mx-auto max-w-2xl rounded-2xl border border-[#dce2dd] bg-white p-6 md:p-10">
          <h1 className="font-serif text-4xl">Tell us about the property.</h1>
          <p className="mt-2 text-sm text-stone-600">
            {pkg.name} — {pkg.priceLabel} per analysis
          </p>
          <form
            method="get"
            action="/investment-intelligence/purchase/account"
            className="mt-7 space-y-5"
          >
            <input type="hidden" name="package" value={pkg.slug} />

            <label className="block text-sm font-medium text-stone-700">
              Property Type
              <select
                name="propertyType"
                defaultValue="single_family"
                className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none ring-brass/20 focus:ring-4"
              >
                <option value="single_family">Single-family home</option>
                <option value="condo">Condo</option>
                <option value="townhome">Townhome</option>
                <option value="multi_family">Multi-family</option>
              </select>
            </label>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block text-sm font-medium text-stone-700">
                Bedrooms
                <input
                  name="bedrooms"
                  type="number"
                  min={0}
                  defaultValue={3}
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
              Square footage
              <input
                name="squareFootage"
                type="text"
                inputMode="numeric"
                placeholder="e.g. 1,800"
                className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none ring-brass/20 focus:ring-4"
              />
            </label>

            <label className="block text-sm font-medium text-stone-700">
              Primary Strategy
              <select
                name="strategy"
                defaultValue="short_term_rental"
                className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none ring-brass/20 focus:ring-4"
              >
                <option value="short_term_rental">Short-term rental</option>
                <option value="rental_arbitrage">Rental arbitrage</option>
                <option value="mid_term_rental">Mid-term rental</option>
                <option value="traditional_rental">Traditional rental</option>
                <option value="vacation_home">Vacation home</option>
              </select>
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
