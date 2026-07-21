import { Database, Info } from "lucide-react";
import type { ExecutiveDataQualitySummary, ExecutiveHealthSummary } from "../domain";
import { HpmPillarGrid } from "./hpm-pillar-grid";
import { SectionHeading } from "./section-heading";

type PortfolioHealthOverviewProps = Readonly<{ health: ExecutiveHealthSummary; dataQuality: ExecutiveDataQualitySummary }>;

function statusLabel(status: ExecutiveHealthSummary["status"]): string {
  return status === "unavailable" ? "Insufficient data" : status.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
}

export function PortfolioHealthOverview({ health, dataQuality }: PortfolioHealthOverviewProps) {
  return (
    <section>
      <SectionHeading eyebrow="Hospitality performance" title="Business health" description="Canonical HPM scores appear only when supported pillar scores are available." />
      <div className="mt-5 rounded-3xl border border-stone-200 bg-stone-100/60 p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div><p className="text-xs text-stone-500">Health score</p><p className="mt-1 text-2xl font-semibold text-stone-950">{health.score ?? "Unavailable"}</p></div>
          <div><p className="text-xs text-stone-500">Confidence</p><p className="mt-1 text-2xl font-semibold text-stone-950">{health.confidence === null ? "Unavailable" : `${health.confidence}%`}</p></div>
          <div><p className="text-xs text-stone-500">Status</p><p className="mt-1 text-lg font-semibold text-stone-950">{statusLabel(health.status)}</p></div>
        </div>
        <p className="mt-4 text-sm leading-6 text-stone-600">{health.summary}</p>
        <div className="mt-4 flex items-start gap-3 rounded-xl bg-white p-3">
          <Database className="mt-0.5 h-4 w-4 text-stone-500" />
          <p className="text-xs leading-5 text-stone-600">{health.availablePillars} of {health.totalPillars} HPM pillars are available.</p>
        </div>
        {health.availablePillars < health.totalPillars ? (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-800">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />This is a partial view. Missing pillars remain unavailable and do not reduce the score.
          </div>
        ) : null}
      </div>
      <div className="mt-4"><HpmPillarGrid dataQuality={dataQuality} /></div>
    </section>
  );
}
