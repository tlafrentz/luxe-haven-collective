import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { WorkspaceCard, WorkspacePage } from "@/components/application-layout";
import { ProviderPicker } from "@/features/workspace-setup/presentation/provider-picker";
import { requireUser } from "@/lib/auth/session";
import { loadSetupContext } from "@/features/workspace-setup/application/load-setup-context";
import { isStepReachable } from "@/features/workspace-setup/domain/setup-steps";

export const metadata: Metadata = {
  title: "Connect Your PMS",
  description: "Connect your property management system or listing platform.",
};

export default async function SetupConnectPage() {
  const { user, profile } = await requireUser();
  const { progress } = await loadSetupContext(user.id, profile?.full_name ?? null);

  if (!isStepReachable("connect", progress)) {
    redirect(progress.currentStep?.href ?? "/dashboard/setup");
  }

  const step = progress.steps.find((s) => s.id === "connect")!;

  return (
    <WorkspacePage width="narrow">
      <h1 className="font-serif text-3xl text-stone-950">Connect your PMS or listing platform.</h1>
      <p className="mt-2 text-sm text-stone-600">Securely import your properties and data.</p>
      <WorkspaceCard level={1} className="mt-6 p-6 sm:p-8">
        <ProviderPicker alreadyRequested={step.complete} />
      </WorkspaceCard>
      <div className="mt-6">
        <Link href="/dashboard/setup/workspace" className="text-sm font-semibold text-stone-500 hover:text-stone-800">
          ← Back
        </Link>
      </div>
    </WorkspacePage>
  );
}
