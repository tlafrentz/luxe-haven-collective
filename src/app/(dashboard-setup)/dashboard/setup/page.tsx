import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { loadSetupContext } from "@/features/workspace-setup/application/load-setup-context";
import { WelcomeScreen } from "@/features/workspace-setup/presentation/welcome-screen";
import { plansBySlug, type PlanSlug } from "@/lib/plans";
import { track } from "@/lib/analytics/track";

export const metadata: Metadata = {
  title: "Welcome to Your Workspace",
  description: "Set up your Hospitality Performance workspace.",
};

export default async function WorkspaceSetupPage() {
  const { user, profile } = await requireUser();
  const { progress } = await loadSetupContext(user.id, profile?.full_name ?? null);

  if (progress.allComplete) {
    redirect("/dashboard/setup/ready");
  }

  const supabase = await createClient();
  const { data: businessProfile } = await supabase
    .from("commerce_business_profiles")
    .select("plan_slug")
    .eq("profile_id", user.id)
    .maybeSingle<{ plan_slug: string }>();
  const plan = businessProfile ? (plansBySlug[businessProfile.plan_slug as PlanSlug] ?? null) : null;

  const returning = progress.steps.some((step) => step.complete);
  if (!returning) {
    track("workspace_setup_started", { workspaceId: progress.currentStep?.id });
  }

  return (
    <WelcomeScreen
      displayName={profile?.full_name}
      plan={plan}
      progress={progress}
      returning={returning}
    />
  );
}
