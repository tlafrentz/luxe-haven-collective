import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CommerceProgressHeader } from "@/components/commerce/commerce-progress-header";
import { createClient } from "@/lib/supabase/server";
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
  title: "Review Order",
  description: "Review your order before checkout.",
};

const PROMO_DISCOUNT = 250;

export default async function FurnishingReviewPage({
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

  // All figures below are computed server-side from the static, trusted
  // package/add-on catalog — never from client-supplied totals.
  const selectedAddOnSlugs = params.addOns
    ? params.addOns.split(",").filter(Boolean)
    : [];
  const selectedAddOns = furnishingAddOns.filter((addOn) =>
    selectedAddOnSlugs.includes(addOn.slug),
  );
  const subtotal =
    pkg.price + selectedAddOns.reduce((sum, addOn) => sum + addOn.price, 0);
  const discount = params.promo ? PROMO_DISCOUNT : 0;
  const total = subtotal - discount;

  return (
    <main>
      <CommerceProgressHeader
        current="review"
        steps={purchaseSteps}
        labels={purchaseStepLabels}
      />
      <div className="container-shell py-10 md:py-14">
        <div className="mx-auto max-w-2xl rounded-2xl border border-[#dce2dd] bg-white p-6 md:p-10">
          <h1 className="font-serif text-4xl">Review your order.</h1>
          <p className="mt-2 text-sm text-stone-600">
            This service fee covers design and project management. Your
            furnishing budget for actual products is separate and is
            estimated with you during Launch Setup — it is never included in
            this order automatically.
          </p>

          <div className="mt-7 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-stone-600">{pkg.name} package fee</span>
              <span className="font-semibold">{pkg.priceLabel}</span>
            </div>
            {selectedAddOns.map((addOn) => (
              <div
                key={addOn.slug}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-stone-600">{addOn.name}</span>
                <span className="font-semibold">{addOn.priceLabel}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 space-y-2 border-t border-stone-200 pt-5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-stone-600">Subtotal</span>
              <span>${subtotal.toLocaleString()}</span>
            </div>
            {discount > 0 ? (
              <div className="flex items-center justify-between text-emerald-700">
                <span>Discount</span>
                <span>-${discount.toLocaleString()}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between text-lg font-bold text-stone-900">
              <span>Amount owed today (USD)</span>
              <span>${total.toLocaleString()}</span>
            </div>
          </div>

          <p className="mt-5 text-xs text-stone-500">
            By continuing you agree to the service terms and cancellation
            policy shown on your package. Luxe Haven purchases furnishing
            products on your behalf only where you&apos;ve approved each
            selection and price during design and procurement — this order
            does not authorize any product purchase.
          </p>

          <Link
            href={`/furnishing/purchase/checkout${query ? `?${query}` : ""}`}
            className="mt-7 flex w-full items-center justify-center rounded-2xl bg-emerald-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800"
          >
            Proceed to Checkout
          </Link>
        </div>
      </div>
    </main>
  );
}
