import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CommerceProgressHeader } from "@/components/commerce/commerce-progress-header";
import { createClient } from "@/lib/supabase/server";
import { FurnishingSelectAddOnsForm } from "@/features/commerce-onboarding/furnishing-select-addons-form";
import {
  furnishingAddOns,
  furnishingPackagesBySlug,
  type FurnishingPackageSlug,
} from "@/lib/furnishing-packages";
import {
  purchaseQuery,
  type FurnishingPurchaseParams,
} from "@/lib/furnishing-purchase-params";
import { purchaseSteps, purchaseStepLabels } from "../steps";

export const metadata: Metadata = {
  title: "Select Package & Add-ons",
  description: "Review your order.",
};

export default async function FurnishingSelectPage({
  searchParams,
}: {
  searchParams: Promise<FurnishingPurchaseParams>;
}) {
  const params = await searchParams;
  const pkg = params.package
    ? furnishingPackagesBySlug[params.package as FurnishingPackageSlug]
    : undefined;
  if (!pkg) redirect("/furnishing/packages");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const query = purchaseQuery(params);
  if (!user) {
    redirect(`/furnishing/purchase/account${query ? `?${query}` : ""}`);
  }

  return (
    <main>
      <CommerceProgressHeader
        current="select"
        steps={purchaseSteps}
        labels={purchaseStepLabels}
      />
      <div className="container-shell py-10 md:py-14">
        <div className="mx-auto max-w-2xl rounded-2xl border border-[#dce2dd] bg-white p-6 md:p-10">
          <h1 className="font-serif text-4xl">Review your order.</h1>
          <p className="mt-2 text-sm text-stone-600">
            {pkg.name} — {pkg.priceLabel}
          </p>
          <div className="mt-7">
            <FurnishingSelectAddOnsForm
              pkg={pkg}
              addOns={furnishingAddOns}
              params={params}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
