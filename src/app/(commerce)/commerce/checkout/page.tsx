import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CommerceProgressHeader } from "@/components/commerce/commerce-progress-header";
import { SecureCheckoutRedirect } from "@/features/commerce-onboarding/secure-checkout-redirect";
import { plansBySlug, type PlanSlug } from "@/lib/plans";
import type { BillingCycle } from "@/components/marketing/billing-toggle";

export const metadata: Metadata = {
  title: "Secure Checkout",
  description: "Redirecting to our secure checkout partner.",
};

export default async function SecureCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; billing?: string }>;
}) {
  const { plan: planSlug, billing: billingParam } = await searchParams;
  const plan = planSlug ? plansBySlug[planSlug as PlanSlug] : undefined;
  if (!plan) redirect("/performance/plans");

  const billing: BillingCycle = billingParam === "annual" ? "annual" : "monthly";

  return (
    <main>
      <CommerceProgressHeader current="checkout" />
      <div className="container-shell py-14 md:py-20">
        <SecureCheckoutRedirect planSlug={plan.slug} billing={billing} />
      </div>
    </main>
  );
}
