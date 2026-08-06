import type { Metadata } from "next";
import Link from "next/link";
import { plansBySlug, type PlanSlug } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Checkout Cancelled",
  description: "Your checkout was cancelled.",
};

export default async function CheckoutCancelledPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; plan?: string }>;
}) {
  const { order, plan: planSlug } = await searchParams;
  const plan = planSlug ? plansBySlug[planSlug as PlanSlug] : undefined;

  return (
    <main className="container-shell py-20 text-center">
      <div className="mx-auto max-w-xl">
        <p className="text-xs font-bold uppercase tracking-[.14em] text-[#a56b19]">
          Checkout cancelled
        </p>
        <h1 className="mt-3 font-serif text-5xl">No payment was confirmed</h1>
        <p className="mt-5 text-stone-600">
          Your pending order remains available for a future retry and no entitlement has been
          activated.
        </p>
        {order ? <p className="mt-5 text-sm text-stone-500">Order reference: {order}</p> : null}
        <Link
          href={plan ? `/commerce/review?plan=${plan.slug}` : "/performance/plans"}
          className="mt-8 inline-flex min-h-11 items-center rounded-full bg-stone-950 px-6 text-sm font-semibold text-white"
        >
          Return to review
        </Link>
      </div>
    </main>
  );
}
