import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { loadSetupContext } from "@/features/workspace-setup/application/load-setup-context";
import { ReadyScreen } from "@/features/workspace-setup/presentation/ready-screen";
import { plansBySlug, type PlanSlug } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Workspace Ready",
  description: "Your workspace is set up and ready to go.",
};

const REQUIRED_TASK_CODES = ["organization_required", "property_included", "owner_membership"];

export default async function SetupReadyPage() {
  const { user, profile } = await requireUser();
  const { health } = await loadSetupContext(user.id, profile?.full_name ?? null);

  const taskByCode = new Map(health.onboarding.tasks.map((task) => [task.code, task]));
  const requiredConditionsMet = REQUIRED_TASK_CODES.every((code) => taskByCode.get(code)?.complete ?? false);

  if (!requiredConditionsMet) {
    redirect("/dashboard/setup");
  }

  const supabase = await createClient();
  const { data: businessProfile } = await supabase
    .from("commerce_business_profiles")
    .select("plan_slug")
    .eq("profile_id", user.id)
    .maybeSingle<{ plan_slug: string }>();
  const plan = businessProfile ? (plansBySlug[businessProfile.plan_slug as PlanSlug] ?? null) : null;

  return <ReadyScreen plan={plan} />;
}
