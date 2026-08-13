import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Lock, ShieldCheck } from "lucide-react";
import { CommerceProgressHeader } from "@/components/commerce/commerce-progress-header";
import { createClient } from "@/lib/supabase/server";
import { beginCommerceCheckout } from "@/app/actions/commerce-checkout";
import {
  guidebookPackagesBySlug,
  type GuidebookPackageSlug,
} from "@/lib/guidebook-packages";
import { purchaseQuery, type GuidebookPurchaseParams } from "@/lib/guidebook-purchase-params";
import { purchaseSteps, purchaseStepLabels } from "../steps";

export const metadata: Metadata = {
  title: "Secure Checkout",
  description: "Your payment is processed securely.",
};

export default async function GuidebookCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<GuidebookPurchaseParams>;
}) {
  const params = await searchParams;
  const pkg = params.package
    ? guidebookPackagesBySlug[params.package as GuidebookPackageSlug]
    : undefined;
  if (!pkg || !pkg.offerId) redirect("/guidebook-studio/packages");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const query = purchaseQuery(params);
  if (!user) {
    redirect(`/guidebook-studio/purchase/account${query ? `?${query}` : ""}`);
  }

  const total = pkg.price;

  const checkoutAction = beginCommerceCheckout.bind(null, pkg.offerId, undefined, {
    successPath: `/guidebook-studio/purchase/confirmed${query ? `?${query}` : ""}`,
    cancelPath: `/guidebook-studio/purchase/checkout${query ? `?${query}` : ""}`,
  });

  return (
    <main>
      <CommerceProgressHeader current="checkout" steps={purchaseSteps} labels={purchaseStepLabels} />
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
              Pay ${total}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
