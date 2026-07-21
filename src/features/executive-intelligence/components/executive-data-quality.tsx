import { Database, Info } from "lucide-react";
import type { ExecutiveDataQualitySummary } from "../domain";

export function ExecutiveDataQuality({ dataQuality }: Readonly<{ dataQuality: ExecutiveDataQualitySummary }>) {
  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3"><Database className="h-5 w-5 text-stone-500" /><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Data quality</p><h3 className="mt-1 text-lg font-semibold text-stone-950">Coverage and limitations</h3></div></div>
      <p className="mt-4 text-sm leading-6 text-stone-600">{dataQuality.summary}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-emerald-50 p-3"><p className="text-xs font-semibold text-emerald-800">Available pillars</p><p className="mt-1 text-xs text-emerald-700">{dataQuality.availablePillars.length ? dataQuality.availablePillars.join(", ") : "None"}</p></div>
        <div className="rounded-xl bg-stone-100 p-3"><p className="text-xs font-semibold text-stone-700">Unavailable pillars</p><p className="mt-1 text-xs text-stone-600">{dataQuality.unavailablePillars.length ? dataQuality.unavailablePillars.join(", ") : "None"}</p></div>
      </div>
      <p className="mt-4 text-xs text-stone-500">Overall confidence: {dataQuality.confidence === null ? "Unavailable" : `${dataQuality.confidence}%`}</p>
      <div className="mt-4 space-y-2">{dataQuality.gaps.map((gap, index) => <div key={`${gap.type}-${index}`} className="flex gap-2 rounded-xl border border-stone-200 p-3"><Info className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" /><div><p className="text-xs font-semibold capitalize text-stone-700">{gap.type.replaceAll("-", " ")}</p><p className="mt-1 text-xs leading-5 text-stone-600">{gap.message}</p></div></div>)}</div>
    </section>
  );
}
