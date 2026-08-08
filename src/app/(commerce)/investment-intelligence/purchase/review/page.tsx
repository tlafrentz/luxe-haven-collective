import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CommerceProgressHeader } from "@/components/commerce/commerce-progress-header";
import { createClient } from "@/lib/supabase/server";
import {
  investmentAddOns,
  investmentPackagesBySlug,
  type InvestmentPackageSlug,
} from "@/lib/investment-packages";
import {
  purchaseQuery,
  type InvestmentPurchaseParams,
} from "@/lib/investment-purchase-params";
import { purchaseSteps, purchaseStepLabels } from "../steps";

export const metadata: Metadata = {
  title: "Review Order",
  description: "Review your order before checkout.",
};

const PROMO_DISCOUNT = 25;

export default async function InvestmentReviewPage({
  searchParams,
}: {
  searchParams: Promise<InvestmentPurchaseParams>;
}) {
  const params = await searchParams;
  const pkg = params.package
    ? investmentPackagesBySlug[params.package as InvestmentPackageSlug]
    : undefined;
  if (!pkg) redirect("/investment-intelligence/packages");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const query = purchaseQuery(params);
  if (!user) {
    redirect(`/investment-intelligence/purchase/account${query ? `?${query}` : ""}`);
  }

  // All figures below are computed server-side from the static, trusted
  // package/add-on catalog — never from client-supplied totals.
  const selectedAddOnSlugs = params.addOns
    ? params.addOns.split(",").filter(Boolean)
    : [];
  const selectedAddOns = pkg.comparison.expertReview
    ? []
    : investmentAddOns.filter((addOn) => selectedAddOnSlugs.includes(addOn.slug));
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
            This fee covers your investment analysis service — it is not a
            property purchase, deposit, or transaction of any kind.
          </p>

          <div className="mt-7 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-stone-600">{pkg.name} analysis</span>
              <span className="font-semibold">{pkg.priceLabel}</span>
            </div>
            {pkg.comparison.expertReview ? (
              <div className="flex items-center justify-between text-sm">
                <span className="text-stone-600">Expert Review</span>
                <span className="font-semibold">Included</span>
              </div>
            ) : null}
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
              <span>Total (USD)</span>
              <span>${total.toLocaleString()}</span>
            </div>
          </div>

          <p className="mt-5 text-xs text-stone-500">
            By continuing you agree to the service terms and cancellation
            policy shown on your package. Payment is collected in full at
            checkout; your analysis credit is fulfilled once your report is
            generated.
          </p>

          <Link
            href={`/investment-intelligence/purchase/checkout${query ? `?${query}` : ""}`}
            className="mt-7 flex w-full items-center justify-center rounded-2xl bg-emerald-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800"
          >
            Proceed to Checkout
          </Link>
        </div>
      </div>
    </main>
  );
}
