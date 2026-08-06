import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CommerceProgressHeader } from "@/components/commerce/commerce-progress-header";
import { ReviewSubscription } from "@/features/commerce-onboarding/review-subscription";
import { createClient } from "@/lib/supabase/server";
import { plansBySlug, type PlanSlug } from "@/lib/plans";
import type { BillingCycle } from "@/components/marketing/billing-toggle";
import type {
  BusinessType,
  PrimaryGoal,
  PropertyCount,
} from "@/features/commerce-onboarding/types";

export const metadata: Metadata = {
  title: "Review Subscription",
  description: "Review your plan and workspace details before checkout.",
};

type BusinessProfileRow = {
  business_type: BusinessType;
  property_count: PropertyCount;
  primary_goal: PrimaryGoal;
  integrations: string[];
};

export default async function ReviewSubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; billing?: string }>;
}) {
  const { plan: planSlug, billing: billingParam } = await searchParams;
  const plan = planSlug ? plansBySlug[planSlug as PlanSlug] : undefined;
  if (!plan) redirect("/performance/plans");

  const billing: BillingCycle = billingParam === "annual" ? "annual" : "monthly";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/commerce/review?plan=${plan.slug}&billing=${billing}`)}`);

  const { data: profileRow } = await supabase
    .from("commerce_business_profiles")
    .select("business_type,property_count,primary_goal,integrations")
    .eq("profile_id", user.id)
    .maybeSingle<BusinessProfileRow>();

  if (!profileRow) {
    redirect(`/commerce/configure-workspace?plan=${plan.slug}&billing=${billing}`);
  }

  return (
    <main>
      <CommerceProgressHeader current="review" />
      <div className="container-shell py-10 md:py-14">
        <h1 className="font-serif text-4xl">Review your subscription.</h1>
        <p className="mt-2 max-w-2xl text-sm text-stone-600">
          Confirm your plan and workspace details before continuing to secure checkout.
        </p>
        <div className="mt-8">
          <ReviewSubscription
            plan={plan}
            billing={billing}
            businessProfile={{
              businessType: profileRow.business_type,
              propertyCount: profileRow.property_count,
              primaryGoal: profileRow.primary_goal,
              integrations: profileRow.integrations ?? [],
            }}
          />
        </div>
      </div>
    </main>
  );
}
