import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { WorkspaceCard, WorkspacePage } from "@/components/application-layout";
import { completeWorkspaceSetupAction } from "@/app/actions/workspace-setup";
import type { Plan } from "@/lib/plans";

export function ReadyScreen({ plan }: { plan: Plan | null }) {
  const benefits = plan ? Object.values(plan.featuresByStage).flat().slice(0, 4) : [];

  return (
    <WorkspacePage width="narrow">
      <WorkspaceCard level={1} className="p-8 text-center sm:p-12">
        <CheckCircle2 className="mx-auto size-14 text-emerald-700" aria-hidden />
        <h1 className="mt-5 font-serif text-4xl text-stone-950">Your workspace is ready!</h1>
        <p className="mt-4 text-sm leading-7 text-stone-600">
          You&apos;re all set to explore your data and unlock powerful insights.
        </p>

        {benefits.length ? (
          <div className="mt-8 text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">What&apos;s next?</p>
            <ul className="mt-3 grid gap-2">
              {benefits.map((benefit) => (
                <li key={benefit} className="flex items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-700" aria-hidden />
                  <span className="text-sm font-medium text-stone-900">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-9 flex flex-col items-center gap-3">
          <form action={completeWorkspaceSetupAction}>
            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded-full bg-stone-950 px-6 text-sm font-semibold text-white"
            >
              Go to Observe Dashboard →
            </button>
          </form>
          <Link href="/performance/overview" className="text-sm font-semibold text-stone-500 hover:text-stone-800">
            Learn the Platform
          </Link>
        </div>
      </WorkspaceCard>
    </WorkspacePage>
  );
}
