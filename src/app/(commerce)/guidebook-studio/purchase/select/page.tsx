import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CommerceProgressHeader } from "@/components/commerce/commerce-progress-header";
import { createClient } from "@/lib/supabase/server";
import { GuidebookSelectAddOnsForm } from "@/features/commerce-onboarding/guidebook-select-addons-form";
import {
  guidebookPackagesBySlug,
  type GuidebookPackageSlug,
} from "@/lib/guidebook-packages";
import { purchaseQuery, type GuidebookPurchaseParams } from "@/lib/guidebook-purchase-params";
import { purchaseSteps, purchaseStepLabels } from "../steps";

export const metadata: Metadata = {
  title: "Review Package",
  description: "Review your order.",
};

export default async function GuidebookSelectPage({
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
      <CommerceProgressHeader current="select" steps={purchaseSteps} labels={purchaseStepLabels} />
      <div className="container-shell py-10 md:py-14">
        <div className="mx-auto max-w-2xl rounded-2xl border border-[#dce2dd] bg-white p-6 md:p-10">
          <h1 className="font-serif text-4xl">Review your order.</h1>
          <p className="mt-2 text-sm text-stone-600">{pkg.name} — {pkg.priceLabel}</p>
          <div className="mt-7">
            <GuidebookSelectAddOnsForm pkg={pkg} addOns={[]} params={{...params,addOns:undefined}} />
          </div>
        </div>
      </div>
    </main>
  );
}
