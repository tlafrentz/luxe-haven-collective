import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { WorkspaceCard, WorkspacePage } from "@/components/application-layout";
import { SupabaseTeamAccessRepository, TeamAccessManager } from "@/features/workspace";
import { requireUser } from "@/lib/auth/session";
import { loadSetupContext } from "@/features/workspace-setup/application/load-setup-context";
import { isStepReachable } from "@/features/workspace-setup/domain/setup-steps";
import { SkipTeamButton } from "@/features/workspace-setup/presentation/skip-team-button";

export const metadata: Metadata = {
  title: "Invite Your Team",
  description: "Add teammates now or skip and invite later.",
};

export default async function SetupTeamPage() {
  const { user, profile } = await requireUser();
  const { context, members, invitations, progress } = await loadSetupContext(user.id, profile?.full_name ?? null);

  if (!isStepReachable("team", progress)) {
    redirect(progress.currentStep?.href ?? "/dashboard/setup");
  }

  const step = progress.steps.find((s) => s.id === "team")!;
  const properties = await new SupabaseTeamAccessRepository().properties(context);

  return (
    <WorkspacePage width="medium">
      <h1 className="font-serif text-3xl text-stone-950">Invite your team (optional).</h1>
      <p className="mt-2 text-sm text-stone-600">Add teammates now or skip and invite later.</p>
      <WorkspaceCard level={1} className="mt-6 p-6 sm:p-8">
        <TeamAccessManager context={context} members={members} invitations={invitations} properties={properties} />
      </WorkspaceCard>
      <div className="mt-6 flex items-center justify-between">
        <Link href="/dashboard/setup/import" className="text-sm font-semibold text-stone-500 hover:text-stone-800">
          ← Back
        </Link>
        <div className="flex gap-3">
          {!step.complete ? <SkipTeamButton /> : null}
          <Link
            href="/dashboard/setup/ready"
            className="inline-flex min-h-11 items-center rounded-full bg-stone-950 px-6 text-sm font-semibold text-white"
          >
            {step.complete ? "Continue →" : "Send Invitations & Continue"}
          </Link>
        </div>
      </div>
    </WorkspacePage>
  );
}
