import {
  ArrowRight,
  ClipboardCheck,
} from "lucide-react";

import type {
  ExecutionWorkspace,
} from "../domain";

type ExecutionPlanProps = {
  workspace: ExecutionWorkspace;
};

const nextStepLabels = {
  start: "Start execution",
  complete: "Complete action",
  measure: "Measure outcome",
  archive: "Archive action",
  none: "No action available",
} as const;

export function ExecutionPlan({
  workspace,
}: ExecutionPlanProps) {
  return (
    <section className="rounded-3xl bg-stone-950 p-6 text-white shadow-xl sm:p-8">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
        <ClipboardCheck className="h-4 w-4" />
        Recommended action
      </p>

      <h2 className="mt-4 text-2xl font-semibold tracking-tight">
        {
          workspace.recommendedAction
            .title
        }
      </h2>

      <p className="mt-3 text-sm leading-7 text-stone-300">
        {
          workspace.recommendedAction
            .summary
        }
      </p>

      <button
        type="button"
        disabled={
          workspace.nextStep === "none"
        }
        className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-stone-950 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:bg-stone-700 disabled:text-stone-400"
      >
        {
          nextStepLabels[
            workspace.nextStep
          ]
        }

        {workspace.nextStep !==
        "none" ? (
          <ArrowRight className="h-4 w-4" />
        ) : null}
      </button>

      <p className="mt-3 text-center text-xs text-stone-500">
        Workflow controls will be enabled
        when persistence is connected.
      </p>
    </section>
  );
}
