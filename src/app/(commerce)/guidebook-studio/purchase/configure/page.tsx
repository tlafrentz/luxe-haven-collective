import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CommerceProgressHeader } from "@/components/commerce/commerce-progress-header";
import { guidebookPackagesBySlug, type GuidebookPackageSlug } from "@/lib/guidebook-packages";
import { purchaseSteps, purchaseStepLabels } from "../steps";
import type { GuidebookPurchaseParams } from "@/lib/guidebook-purchase-params";

export const metadata: Metadata = {
  title: "Configure Purchase",
  description: "Tell us about your guidebook.",
};

export default async function ConfigurePurchasePage({
  searchParams,
}: {
  searchParams: Promise<GuidebookPurchaseParams>;
}) {
  const params = await searchParams;
  const pkg = params.package
    ? guidebookPackagesBySlug[params.package as GuidebookPackageSlug]
    : undefined;
  if (!pkg) redirect("/guidebook-studio/packages");

  return (
    <main>
      <CommerceProgressHeader current="configure" steps={purchaseSteps} labels={purchaseStepLabels} />
      <div className="container-shell py-10 md:py-14">
        <div className="mx-auto max-w-2xl rounded-2xl border border-[#dce2dd] bg-white p-6 md:p-10">
          <h1 className="font-serif text-4xl">Tell us about your guidebook.</h1>
          <p className="mt-2 text-sm text-stone-600">
            {pkg.name} — {pkg.priceLabel} {pkg.startingAt ? "starting at" : "one-time"}
          </p>
          <form
            method="get"
            action="/guidebook-studio/purchase/account"
            className="mt-7 space-y-5"
          >
            <input type="hidden" name="package" value={pkg.slug} />

            <label className="block text-sm font-medium text-stone-700">
              Property Type
              <select
                name="propertyType"
                defaultValue="entire-home"
                className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none ring-brass/20 focus:ring-4"
              >
                <option value="entire-home">Entire Home</option>
                <option value="condo">Condo</option>
                <option value="cabin">Cabin</option>
                <option value="multi-unit">Multi-unit</option>
              </select>
            </label>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block text-sm font-medium text-stone-700">
                Number of Bedrooms
                <input
                  name="bedrooms"
                  type="number"
                  min={0}
                  defaultValue={2}
                  className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none ring-brass/20 focus:ring-4"
                />
              </label>
              <label className="block text-sm font-medium text-stone-700">
                Guest Capacity
                <input
                  name="guestCapacity"
                  type="number"
                  min={1}
                  defaultValue={4}
                  className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none ring-brass/20 focus:ring-4"
                />
              </label>
            </div>

            <label className="block text-sm font-medium text-stone-700">
              Primary Goal
              <select
                name="primaryGoal"
                defaultValue="improve-guest-experience"
                className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none ring-brass/20 focus:ring-4"
              >
                <option value="improve-guest-experience">Improve guest experience</option>
                <option value="reduce-questions">Reduce repetitive questions</option>
                <option value="increase-reviews">Increase reviews</option>
                <option value="launch-new-property">Launch a new property</option>
              </select>
            </label>

            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input type="checkbox" name="hasPromo" className="size-4" />
              I have a promo code
            </label>
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
