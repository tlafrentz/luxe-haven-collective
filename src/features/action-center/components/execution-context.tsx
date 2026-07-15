import {
  Gauge,
} from "lucide-react";

import type {
  ExecutionWorkspace,
} from "../domain";

type ExecutionContextProps = {
  workspace: ExecutionWorkspace;
};

export function ExecutionContext({
  workspace,
}: ExecutionContextProps) {
  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
        <Gauge className="h-4 w-4" />
        Why now
      </p>

      <p className="mt-4 max-w-3xl text-base leading-7 text-stone-700">
        {workspace.whyNow}
      </p>

      {workspace.evidence.length > 0 ? (
        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          {workspace.evidence.map(
            (item) => (
              <div
                key={item.label}
                className="rounded-2xl bg-stone-50 p-5"
              >
                <dt className="text-xs font-medium text-stone-500">
                  {item.label}
                </dt>

                <dd className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
                  {item.value}
                </dd>
              </div>
            ),
          )}
        </dl>
      ) : null}
    </section>
  );
}
