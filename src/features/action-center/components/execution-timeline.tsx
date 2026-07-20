import {
  Check,
  Clock3,
} from "lucide-react";

import type {
  ExecutionWorkspace,
} from "../domain";

type ExecutionTimelineProps = {
  workspace: ExecutionWorkspace;
};

function formatTimestamp(
  timestamp: string,
): string {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(new Date(timestamp));
}

export function ExecutionTimeline({
  workspace,
}: ExecutionTimelineProps) {
  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
        <Clock3 className="h-4 w-4" />
        Execution timeline
      </p>

      <ol className="mt-6 space-y-0">
        {workspace.timeline.map(
          (event, index) => {
            const isLast =
              index ===
              workspace.timeline.length -
                1;

            return (
              <li
                key={`${event.type}-${event.timestamp}`}
                className="relative grid grid-cols-[32px_minmax(0,1fr)] gap-4"
              >
                {!isLast ? (
                  <span className="absolute left-[15px] top-8 h-full w-px bg-stone-200" />
                ) : null}

                <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-stone-950 text-white">
                  <Check className="h-4 w-4" />
                </span>

                <div className="pb-7">
                  <p className="text-sm font-semibold text-stone-950">
                    {event.label}
                  </p>

                  <p className="mt-1 text-xs text-stone-500">
                    {formatTimestamp(
                      event.timestamp,
                    )}
                  </p>
                </div>
              </li>
            );
          },
        )}
      </ol>
    </section>
  );
}
