import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { WorkspaceCard, WorkspacePage } from "@/components/application-layout";
import { OrganizationForm } from "@/features/workspace";
import { requireUser } from "@/lib/auth/session";
import { loadSetupContext } from "@/features/workspace-setup/application/load-setup-context";
import { isStepReachable } from "@/features/workspace-setup/domain/setup-steps";

export const metadata: Metadata = {
  title: "Set Up Your Workspace",
  description: "Tell us about your workspace.",
};

export default async function SetupWorkspacePage() {
  const { user, profile } = await requireUser();
  const { organization, progress } = await loadSetupContext(user.id, profile?.full_name ?? null);

  if (!isStepReachable("workspace", progress)) {
    redirect(progress.currentStep?.href ?? "/dashboard/setup");
  }

  const step = progress.steps.find((s) => s.id === "workspace")!;

  return (
    <WorkspacePage width="narrow">
      <h1 className="font-serif text-3xl text-stone-950">Tell us about your workspace.</h1>
      <p className="mt-2 text-sm text-stone-600">This helps us personalize your experience.</p>
      <WorkspaceCard level={1} className="mt-6 p-6 sm:p-8">
        <OrganizationForm profile={organization} />
      </WorkspaceCard>
      <div className="mt-6 flex items-center justify-between">
        <Link href="/dashboard/setup" className="text-sm font-semibold text-stone-500 hover:text-stone-800">
          ← Back
        </Link>
        {step.complete ? (
          <Link
            href="/dashboard/setup/connect"
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-stone-950 px-6 text-sm font-semibold text-white"
          >
            <CheckCircle2 className="size-4" aria-hidden />
            Continue →
          </Link>
        ) : (
          <p className="text-sm text-stone-500">Save your workspace details to continue.</p>
        )}
      </div>
    </WorkspacePage>
  );
}
