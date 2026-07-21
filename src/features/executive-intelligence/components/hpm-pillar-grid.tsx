import { CircleDashed, CircleGauge } from "lucide-react";
import { HPM_PILLARS, HPM_PILLAR_LABELS } from "@/features/hpm";
import type { ExecutiveDataQualitySummary } from "../domain";

type HpmPillarGridProps = Readonly<{ dataQuality: ExecutiveDataQualitySummary }>;

export function HpmPillarGrid({ dataQuality }: HpmPillarGridProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
      {HPM_PILLARS.map((pillar) => {
        const available = dataQuality.availablePillars.includes(pillar);
        const Icon = available ? CircleGauge : CircleDashed;
        return (
          <div key={pillar} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-600"><Icon className="h-4 w-4" /></div>
              <div>
                <p className="text-sm font-semibold text-stone-950">{HPM_PILLAR_LABELS[pillar]}</p>
                <p className="mt-0.5 text-xs text-stone-500">{available ? "Canonical score available" : "Unavailable"}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
