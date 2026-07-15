import {
  CheckCircle2,
} from "lucide-react";

import type {
  ActionCenterItem,
} from "../domain";

import {
  ActionCard,
} from "./action-card";

type ActionQueueProps = {
  actions: ActionCenterItem[];
};

export function ActionQueue({
  actions,
}: ActionQueueProps) {
  return (
    <section>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
          Execution queue
        </p>

        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
          Active actions
        </h2>

        <p className="mt-2 text-sm text-stone-600">
          Work currently accepted, scheduled,
          active, or blocked.
        </p>
      </div>

      <div className="mt-5 space-y-4">
        {actions.length > 0 ? (
          actions.map((action) => (
            <ActionCard
              key={action.id}
              action={action}
            />
          ))
        ) : (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />

            <h3 className="mt-4 text-base font-semibold text-emerald-950">
              No active actions
            </h3>

            <p className="mt-2 text-sm text-emerald-700">
              The execution queue is clear.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
