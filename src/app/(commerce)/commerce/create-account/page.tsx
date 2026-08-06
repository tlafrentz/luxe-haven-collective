import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CommerceProgressHeader } from "@/components/commerce/commerce-progress-header";
import { CreateAccountForm } from "@/features/commerce-onboarding/create-account-form";
import { plansBySlug, type PlanSlug } from "@/lib/plans";
import type { BillingCycle } from "@/components/marketing/billing-toggle";

export const metadata: Metadata = {
  title: "Create Account",
  description: "Create your Luxe Haven account to continue.",
};

export default async function CreateAccountPage({
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
      <CommerceProgressHeader current="account" />
      <div className="container-shell py-10 md:py-14">
        <div className="mx-auto max-w-xl">
          <CreateAccountForm plan={plan} billing={billing} />
        </div>
      </div>
    </main>
  );
}
