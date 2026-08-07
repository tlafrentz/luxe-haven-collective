import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CommerceProgressHeader } from "@/components/commerce/commerce-progress-header";
import { createClient } from "@/lib/supabase/server";
import {
  guidebookAddOns,
  guidebookPackagesBySlug,
  type GuidebookPackageSlug,
} from "@/lib/guidebook-packages";
import { purchaseQuery, type GuidebookPurchaseParams } from "@/lib/guidebook-purchase-params";
import { purchaseSteps, purchaseStepLabels } from "../steps";

export const metadata: Metadata = {
  title: "Review Order",
  description: "Review your order before checkout.",
};

const PROMO_DISCOUNT = 99;

export default async function GuidebookReviewPage({
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

  const selectedAddOnSlugs = params.addOns ? params.addOns.split(",").filter(Boolean) : [];
  const selectedAddOns = guidebookAddOns.filter((addOn) => selectedAddOnSlugs.includes(addOn.slug));
  const subtotal = pkg.price + selectedAddOns.reduce((sum, addOn) => sum + addOn.price, 0);
  const discount = params.promo ? PROMO_DISCOUNT : 0;
  const total = subtotal - discount;

  return (
    <main>
      <CommerceProgressHeader current="review" steps={purchaseSteps} labels={purchaseStepLabels} />
      <div className="container-shell py-10 md:py-14">
        <div className="mx-auto max-w-2xl rounded-2xl border border-[#dce2dd] bg-white p-6 md:p-10">
          <h1 className="font-serif text-4xl">Review your order.</h1>

          <div className="mt-7 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-stone-600">{pkg.name} Guidebook</span>
              <span className="font-semibold">{pkg.priceLabel}</span>
            </div>
            {selectedAddOns.map((addOn) => (
              <div key={addOn.slug} className="flex items-center justify-between text-sm">
                <span className="text-stone-600">{addOn.name}</span>
                <span className="font-semibold">{addOn.priceLabel}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 space-y-2 border-t border-stone-200 pt-5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-stone-600">Subtotal</span>
              <span>${subtotal}</span>
            </div>
            {discount > 0 ? (
              <div className="flex items-center justify-between text-emerald-700">
                <span>Discount</span>
                <span>-${discount}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between text-lg font-bold text-stone-900">
              <span>Total (USD)</span>
              <span>${total}</span>
            </div>
          </div>

          <Link
            href={`/guidebook-studio/purchase/checkout${query ? `?${query}` : ""}`}
            className="mt-7 flex w-full items-center justify-center rounded-2xl bg-emerald-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800"
          >
            Proceed to Checkout
          </Link>
        </div>
      </div>
    </main>
  );
}
