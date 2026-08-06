import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { WorkspaceCard, WorkspacePage } from "@/components/application-layout";
import type { Plan } from "@/lib/plans";
import type { SetupProgress } from "../domain/setup-steps";

export function WelcomeScreen({
  displayName,
  plan,
  progress,
  returning,
}: {
  displayName?: string | null;
  plan: Plan | null;
  progress: SetupProgress;
  returning: boolean;
}) {
  const continueHref = progress.currentStep?.href ?? "/dashboard/setup/ready";

  return (
    <WorkspacePage width="narrow">
      <WorkspaceCard level={1} className="p-8 text-center sm:p-12">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
          {returning ? "Continue setup" : "Welcome"}
        </p>
        <h1 className="mt-3 font-serif text-4xl text-stone-950">
          {returning
            ? "Let's finish setting up your workspace."
            : `Welcome to Hospitality Performance${displayName ? `, ${displayName}` : ""}!`}
        </h1>
        <p className="mt-4 text-sm leading-7 text-stone-600">
          {returning
            ? `${progress.completionPercent}% complete. Pick up where you left off.`
            : "Your workspace is ready. Let's get you set up so you can start making better decisions."}
        </p>

        {plan ? (
          <div className="mt-8 grid gap-4 rounded-2xl border border-stone-200 bg-stone-50 p-5 text-left sm:grid-cols-3">
            <Summary label="Your plan" value={plan.name} />
            <Summary label="Properties" value={plan.comparisonRow.properties} />
            <Summary label="Est. setup time" value="8-10 minutes" />
          </div>
        ) : null}

        {returning ? (
          <ol className="mt-8 grid gap-2 text-left">
            {progress.steps.map((step) => (
              <li
                key={step.id}
                className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3"
              >
                {step.complete ? (
                  <CheckCircle2 className="size-5 shrink-0 text-emerald-700" aria-hidden />
                ) : (
                  <Circle className="size-5 shrink-0 text-stone-400" aria-hidden />
                )}
                <span className="font-medium text-stone-900">{step.label}</span>
                {step.skipped ? (
                  <span className="ml-auto text-xs font-semibold uppercase text-stone-400">Skipped</span>
                ) : null}
              </li>
            ))}
          </ol>
        ) : null}

        <div className="mt-9 flex flex-col items-center gap-3">
          <Link
            href={continueHref}
            className="inline-flex min-h-11 items-center rounded-full bg-stone-950 px-6 text-sm font-semibold text-white"
          >
            {returning ? "Continue Setup →" : "Let's Get Started →"}
          </Link>
          {!returning ? (
            <Link href="/dashboard" className="text-sm font-semibold text-stone-500 hover:text-stone-800">
              Skip for now
            </Link>
          ) : null}
        </div>
      </WorkspaceCard>
    </WorkspacePage>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-500">{label}</p>
      <p className="mt-1 font-semibold text-stone-950">{value}</p>
    </div>
  );
}
