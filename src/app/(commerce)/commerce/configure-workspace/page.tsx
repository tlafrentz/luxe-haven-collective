import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CommerceProgressHeader } from "@/components/commerce/commerce-progress-header";
import { ConfigureWorkspaceForm } from "@/features/commerce-onboarding/configure-workspace-form";
import { plansBySlug, type PlanSlug } from "@/lib/plans";
import type { BillingCycle } from "@/components/marketing/billing-toggle";

export const metadata: Metadata = {
  title: "Configure Workspace",
  description: "Prepare your workspace before creating your account.",
};

export default async function ConfigureWorkspacePage({
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
      <CommerceProgressHeader current="workspace" />
      <div className="container-shell py-10 md:py-14">
        <div className="mx-auto max-w-3xl">
          <ConfigureWorkspaceForm plan={plan} billing={billing} />
        </div>
      </div>
    </main>
  );
}
