import {
  CircleDashed,
  CircleGauge,
  ShieldAlert,
} from "lucide-react";

import {
  HPM_PILLARS,
  HPM_PILLAR_LABELS,
  type HpmHealthStatus,
  type HpmPerformanceReport,
} from "@/features/hpm";

type HpmPillarGridProps = {
  performance: HpmPerformanceReport;
};

const healthClasses: Record<
  HpmHealthStatus,
  string
> = {
  excellent:
    "border-emerald-200 bg-emerald-50 text-emerald-800",
  healthy:
    "border-emerald-200 bg-emerald-50 text-emerald-800",
  watch:
    "border-amber-200 bg-amber-50 text-amber-800",
  "needs-attention":
    "border-orange-200 bg-orange-50 text-orange-800",
  critical:
    "border-rose-200 bg-rose-50 text-rose-800",
  unavailable:
    "border-stone-200 bg-stone-50 text-stone-500",
};

function formatHealthStatus(
  status: HpmHealthStatus,
) {
  return status
    .split("-")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1),
    )
    .join(" ");
}

export function HpmPillarGrid({
  performance,
}: HpmPillarGridProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
      {HPM_PILLARS.map((pillar) => {
        const result =
          performance.pillars[pillar];

        const Icon =
          pillar === "risk"
            ? ShieldAlert
            : result.score === null
              ? CircleDashed
              : CircleGauge;

        return (
          <div
            key={pillar}
            className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-600">
                  <Icon className="h-4 w-4" />
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-stone-950">
                    {HPM_PILLAR_LABELS[pillar]}
                  </p>

                  <p className="mt-0.5 text-xs capitalize text-stone-500">
                    {result.measurementStatus}
                  </p>
                </div>
              </div>

              {result.score !== null ? (
                <p className="text-xl font-semibold text-stone-950">
                  {result.score}
                </p>
              ) : (
                <p className="text-xs font-medium text-stone-400">
                  Connecting
                </p>
              )}
            </div>

            <div
              className={[
                "mt-4 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                healthClasses[result.healthStatus],
              ].join(" ")}
            >
              {formatHealthStatus(
                result.healthStatus,
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
