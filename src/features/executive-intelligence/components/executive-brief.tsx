import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Focus,
} from "lucide-react";

import type {
  ExecutiveBrief as ExecutiveBriefType,
} from "../domain";

type ExecutiveBriefProps = {
  brief: ExecutiveBriefType;
};

const toneClasses: Record<
  ExecutiveBriefType["tone"],
  string
> = {
  positive:
    "border-emerald-200 bg-emerald-950 text-white",
  balanced:
    "border-stone-800 bg-stone-950 text-white",
  warning:
    "border-amber-300 bg-amber-950 text-white",
  critical:
    "border-rose-300 bg-rose-950 text-white",
};

export function ExecutiveBrief({
  brief,
}: ExecutiveBriefProps) {
  return (
    <section
      className={[
        "overflow-hidden rounded-3xl border p-6 shadow-sm sm:p-8",
        toneClasses[brief.tone],
      ].join(" ")}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
        Executive brief
      </p>

      <h2 className="mt-3 max-w-3xl text-2xl font-semibold tracking-tight sm:text-3xl">
        {brief.headline}
      </h2>

      <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70 sm:text-base">
        {brief.summary}
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/50">
            <CheckCircle2 className="h-4 w-4" />
            Positive signals
          </p>

          <div className="mt-3 space-y-3">
            {brief.highlights.length > 0 ? (
              brief.highlights.map((highlight) => (
                <p
                  key={highlight}
                  className="text-sm leading-6 text-white/75"
                >
                  {highlight}
                </p>
              ))
            ) : (
              <p className="text-sm leading-6 text-white/45">
                No positive changes were detected for this
                reporting period.
              </p>
            )}
          </div>
        </div>

        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/50">
            <AlertTriangle className="h-4 w-4" />
            Watch items
          </p>

          <div className="mt-3 space-y-3">
            {brief.concerns.length > 0 ? (
              brief.concerns.map((concern) => (
                <p
                  key={concern}
                  className="text-sm leading-6 text-white/75"
                >
                  {concern}
                </p>
              ))
            ) : (
              <p className="text-sm leading-6 text-white/45">
                No immediate concerns were detected.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/50">
            <Focus className="h-4 w-4" />
            Recommended focus
          </p>

          <p className="mt-2 text-sm font-medium leading-6 text-white">
            {brief.recommendedFocus}
          </p>
        </div>

        <ArrowRight className="hidden h-5 w-5 shrink-0 text-white/40 sm:block" />
      </div>
    </section>
  );
}
