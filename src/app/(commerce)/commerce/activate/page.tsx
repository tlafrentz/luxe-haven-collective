import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BeginActivation } from "@/features/commerce-onboarding/begin-activation";
import { createClient } from "@/lib/supabase/server";
import { plansBySlug, type PlanSlug } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Begin Activation",
  description: "Connect your first property to activate your workspace.",
};

export default async function BeginActivationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profileRow } = await supabase
    .from("commerce_business_profiles")
    .select("plan_slug")
    .eq("profile_id", user.id)
    .maybeSingle<{ plan_slug: string }>();

  const plan = profileRow ? plansBySlug[profileRow.plan_slug as PlanSlug] : undefined;
  if (!plan) redirect("/performance/plans");

  return (
    <main className="container-shell py-14 md:py-20">
      <BeginActivation plan={plan} />
    </main>
  );
}
