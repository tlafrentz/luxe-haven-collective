import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Lock, ShieldCheck } from "lucide-react";
import { CommerceProgressHeader } from "@/components/commerce/commerce-progress-header";
import { createClient } from "@/lib/supabase/server";
import { beginCommerceCheckout } from "@/app/actions/commerce-checkout";
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
  title: "Secure Checkout",
  description: "Your payment is processed securely.",
};

export default async function FurnishingCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<FurnishingPurchaseParams>;
}) {
  const params = await searchParams;
  const pkg = params.package
    ? furnishingPackagesBySlug[params.package as FurnishingPackageSlug]
    : undefined;
  if (!pkg || !pkg.offerId) redirect("/furnishing/packages");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const query = purchaseQuery(params);
  if (!user) {
    redirect(`/furnishing/purchase/account${query ? `?${query}` : ""}`);
  }

  const selectedAddOnSlugs = params.addOns
    ? params.addOns.split(",").filter(Boolean)
    : [];
  const selectedAddOns = furnishingAddOns
    .filter((addOn) => selectedAddOnSlugs.includes(addOn.slug))
    .map((addOn) => ({ name: addOn.name, amountMinor: addOn.price * 100 }));
  const total =
    pkg.price +
    selectedAddOns.reduce((sum, addOn) => sum + addOn.amountMinor / 100, 0);

  const checkoutAction = beginCommerceCheckout.bind(
    null,
    pkg.offerId,
    selectedAddOns,
    {
      successPath: `/furnishing/purchase/confirmed`,
      cancelPath: `/furnishing/purchase/checkout${query ? `?${query}` : ""}`,
    },
  );

  return (
    <main>
      <CommerceProgressHeader
        current="checkout"
        steps={purchaseSteps}
        labels={purchaseStepLabels}
      />
      <div className="container-shell py-10 md:py-14">
        <div className="mx-auto max-w-xl rounded-2xl border border-[#dce2dd] bg-white p-6 text-center md:p-10">
          <Lock className="mx-auto size-8 text-emerald-800" />
          <h1 className="mt-4 font-serif text-4xl">Secure checkout.</h1>
          <p className="mt-2 text-sm text-stone-600">
            Your payment is processed securely by Stripe.
          </p>
          <div className="mt-5 flex items-center justify-center gap-2 text-xs font-semibold text-stone-500">
            <ShieldCheck className="size-4" />
            PCI compliant · 256-bit encryption
          </div>
          <div className="mt-6 flex items-center justify-center gap-3 text-xs font-bold uppercase tracking-wide text-stone-400">
            <span>Visa</span>
            <span>Mastercard</span>
            <span>Amex</span>
            <span>Apple Pay</span>
          </div>
          <form action={checkoutAction} className="mt-8">
            <button
              type="submit"
              className="w-full rounded-2xl bg-emerald-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800"
            >
              Pay ${total.toLocaleString()}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
