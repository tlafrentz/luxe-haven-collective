import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { WorkspacePropertiesPage } from "@/features/workspace";
import { ManualPropertyForm } from "@/features/workspace-setup/presentation/manual-property-form";
import { requireUser } from "@/lib/auth/session";
import { loadSetupContext } from "@/features/workspace-setup/application/load-setup-context";
import { isStepReachable } from "@/features/workspace-setup/domain/setup-steps";

export const metadata: Metadata = {
  title: "Add Your Properties",
  description: "Select or add the properties that belong in your workspace.",
};

export default async function SetupImportPage() {
  const { user, profile } = await requireUser();
  const { context, propertySystems, progress } = await loadSetupContext(user.id, profile?.full_name ?? null);

  if (!isStepReachable("import", progress)) {
    redirect(progress.currentStep?.href ?? "/dashboard/setup");
  }

  const step = progress.steps.find((s) => s.id === "import")!;

  return (
    <div>
      <WorkspacePropertiesPage
        overview={propertySystems}
        canManage={context.permissions.has("properties.manage")}
        title="Add your properties"
        description="Select which properties belong in this workspace, or add one manually below."
      />
      <div className="mx-auto -mt-4 max-w-[1440px] px-4 pb-10 sm:px-6 lg:px-8">
        <ManualPropertyForm />
        <div className="mt-6 flex items-center justify-between">
          <Link href="/dashboard/setup/connect" className="text-sm font-semibold text-stone-500 hover:text-stone-800">
            ← Back
          </Link>
          {step.complete ? (
            <Link
              href="/dashboard/setup/team"
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-stone-950 px-6 text-sm font-semibold text-white"
            >
              <CheckCircle2 className="size-4" aria-hidden />
              Confirm &amp; Continue →
            </Link>
          ) : (
            <p className="text-sm text-stone-500">Add at least one property to continue.</p>
          )}
        </div>
      </div>
    </div>
  );
}
