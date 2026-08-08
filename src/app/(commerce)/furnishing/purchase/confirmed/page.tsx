import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { getCheckoutResult } from "@/app/actions/commerce-payments";

export const metadata: Metadata = {
  title: "Purchase Confirmed",
  description: "Your Furnishing Studio order has been confirmed.",
};

export default async function FurnishingPurchaseConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;
  const result = session_id ? await getCheckoutResult(session_id) : null;
  const paid = result?.orderStatus === "paid";

  return (
    <main>
      <div className="container-shell py-16">
        <div className="mx-auto max-w-xl rounded-2xl border border-[#dce2dd] bg-white p-10 text-center">
          <CheckCircle2 className="mx-auto size-14 text-emerald-700" />
          <h1 className="mt-6 font-serif text-4xl">
            {paid ? "Thank you!" : "Payment confirmation is processing"}
          </h1>
          <p className="mt-3 text-sm text-stone-600">
            {paid
              ? "Your Furnishing Studio order has been confirmed."
              : "You do not need to submit another payment. This page will reflect the verified order state after webhook processing."}
          </p>
          {result ? (
            <dl className="mt-8 rounded-xl bg-stone-50 p-5 text-left">
              <dt className="text-xs uppercase tracking-wider text-stone-500">
                Order
              </dt>
              <dd className="mt-1 font-semibold">{result.orderNumber}</dd>
              <dt className="mt-4 text-xs uppercase tracking-wider text-stone-500">
                Package
              </dt>
              <dd className="mt-1">{result.productName}</dd>
            </dl>
          ) : null}
          <p className="mt-6 text-xs text-stone-500">
            We&apos;ve sent a confirmation email with your order details.
          </p>
          <Link
            href={`/dashboard/furnishing/projects/new${result?.productName ? `?package=${encodeURIComponent(result.productName)}` : ""}`}
            className="mt-8 flex w-full items-center justify-center rounded-2xl bg-emerald-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800"
          >
            Begin Setup →
          </Link>
        </div>
      </div>
    </main>
  );
}
