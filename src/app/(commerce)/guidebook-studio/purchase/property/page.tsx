import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CommerceProgressHeader } from "@/components/commerce/commerce-progress-header";
import { createClient } from "@/lib/supabase/server";
import { guidebookPackagesBySlug, type GuidebookPackageSlug } from "@/lib/guidebook-packages";
import { purchaseQuery, type GuidebookPurchaseParams } from "@/lib/guidebook-purchase-params";
import { purchaseSteps, purchaseStepLabels } from "../steps";

export const metadata: Metadata = {
  title: "Add Property Details",
  description: "Let's add a few details about your property.",
};

export default async function GuidebookPropertyPage({
  searchParams,
}: {
  searchParams: Promise<GuidebookPurchaseParams>;
}) {
  const params = await searchParams;
  const pkg = params.package
    ? guidebookPackagesBySlug[params.package as GuidebookPackageSlug]
    : undefined;
  if (!pkg) redirect("/guidebook-studio/packages");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const query = purchaseQuery(params);
  if (!user) {
    redirect(`/guidebook-studio/purchase/account${query ? `?${query}` : ""}`);
  }

  return (
    <main>
      <CommerceProgressHeader current="property" steps={purchaseSteps} labels={purchaseStepLabels} />
      <div className="container-shell py-10 md:py-14">
        <div className="mx-auto max-w-2xl rounded-2xl border border-[#dce2dd] bg-white p-6 md:p-10">
          <h1 className="font-serif text-4xl">Let&apos;s add a few details about your property.</h1>
          <form
            method="get"
            action="/guidebook-studio/purchase/select"
            className="mt-7 space-y-5"
          >
            {Object.entries(params).map(([key, value]) =>
              value ? <input key={key} type="hidden" name={key} value={value} /> : null,
            )}

            <label className="block text-sm font-medium text-stone-700">
              Property Name
              <input
                name="propertyName"
                required
                placeholder="Desert Retreat"
                className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none ring-brass/20 focus:ring-4"
              />
            </label>

            <label className="block text-sm font-medium text-stone-700">
              Street address <span className="text-stone-400">(optional)</span>
              <input
                name="address"
                placeholder="123 Cactus Way, Scottsdale, AZ USA"
                className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none ring-brass/20 focus:ring-4"
              />
            </label>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block text-sm font-medium text-stone-700">
                City
                <input
                  name="city"
                  required
                  placeholder="Scottsdale"
                  className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none ring-brass/20 focus:ring-4"
                />
              </label>
              <label className="block text-sm font-medium text-stone-700">
                State / region
                <input
                  name="state"
                  required
                  placeholder="Arizona"
                  className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none ring-brass/20 focus:ring-4"
                />
              </label>
            </div>

            <label className="block text-sm font-medium text-stone-700">
              Country
              <input
                name="country"
                required
                defaultValue="US"
                className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none ring-brass/20 focus:ring-4"
              />
            </label>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block text-sm font-medium text-stone-700">
                Time Zone
                <select
                  name="timezone"
                  defaultValue="America/Phoenix"
                  className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none ring-brass/20 focus:ring-4"
                >
                  <option value="America/Phoenix">(GMT-7:00) Phoenix</option>
                  <option value="America/Los_Angeles">(GMT-8:00) Los Angeles</option>
                  <option value="America/Denver">(GMT-7:00) Denver</option>
                  <option value="America/Chicago">(GMT-6:00) Chicago</option>
                  <option value="America/New_York">(GMT-5:00) New York</option>
                </select>
              </label>
              <label className="block text-sm font-medium text-stone-700">
                Currency
                <select
                  name="currency"
                  defaultValue="USD"
                  className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none ring-brass/20 focus:ring-4"
                >
                  <option value="USD">USD - US Dollar</option>
                  <option value="CAD">CAD - Canadian Dollar</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="GBP">GBP - British Pound</option>
                </select>
              </label>
            </div>

            <button
              type="submit"
              className="w-full rounded-2xl bg-emerald-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800"
            >
              Save &amp; Continue
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
