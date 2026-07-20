import {
  BookOpenCheck,
  Clock3,
} from "lucide-react";

import type {
  ExecutionWorkspace,
} from "../domain";

type ExecutionLearningProps = {
  workspace: ExecutionWorkspace;
};

export function ExecutionLearning({
  workspace,
}: ExecutionLearningProps) {
  const outcome =
    workspace.learning.outcome;

  if (
    workspace.learning.status ===
    "pending"
  ) {
    return (
      <section className="rounded-3xl border border-dashed border-stone-300 bg-stone-50 p-6 sm:p-8">
        <Clock3 className="h-6 w-6 text-stone-400" />

        <h2 className="mt-4 text-lg font-semibold text-stone-950">
          Learning pending
        </h2>

        <p className="mt-2 text-sm leading-6 text-stone-600">
          Complete and measure this action
          to capture its business impact and
          lessons for future decisions.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 sm:p-8">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
        <BookOpenCheck className="h-4 w-4" />
        Learning captured
      </p>

      <h2 className="mt-4 text-lg font-semibold text-emerald-950">
        {outcome?.summary ??
          "Outcome measured"}
      </h2>

      {outcome?.lessonsLearned &&
      outcome.lessonsLearned.length >
        0 ? (
        <ul className="mt-4 space-y-2 text-sm leading-6 text-emerald-800">
          {outcome.lessonsLearned.map(
            (lesson) => (
              <li key={lesson}>
                • {lesson}
              </li>
            ),
          )}
        </ul>
      ) : null}
    </section>
  );
}
