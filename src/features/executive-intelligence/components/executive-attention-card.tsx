import Link from "next/link";
import { ArrowRight, CircleAlert, Gauge } from "lucide-react";

import type { ExecutiveAttentionItem } from "../domain";

type ExecutiveAttentionCardProps = Readonly<{ item: ExecutiveAttentionItem }>;

const urgencyClasses = {
  critical: "border-rose-200 bg-rose-50 text-rose-700",
  high: "border-rose-200 bg-rose-50 text-rose-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  low: "border-stone-200 bg-stone-50 text-stone-600",
};

export function getExecutiveAttentionDestination(item: ExecutiveAttentionItem): string | undefined {
  if (item.source === "action") return "/dashboard/actions";
  if (item.category === "investment" || item.category.startsWith("investment.")) return "/dashboard/investments";
  if (item.source === "recommendation" && ["revenue", "pricing", "occupancy", "distribution", "operations"].includes(item.category)) {
    return "/dashboard/insights";
  }
  return undefined;
}

function sourceLabel(item: ExecutiveAttentionItem): string {
  if (item.source === "recommendation") return "Recommendation · Decide";
  if (item.source === "action") return "Action · Execute";
  if (item.source === "outcome") return "Outcome · Learn";
  return "Intelligence · Understand";
}

export function ExecutiveAttentionCard({ item }: ExecutiveAttentionCardProps) {
  const destination = getExecutiveAttentionDestination(item);
  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:border-stone-300 hover:shadow-md">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-950 text-sm font-semibold text-white">{item.rank}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={["rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide", urgencyClasses[item.urgency]].join(" ")}>{item.urgency}</span>
            <span className="text-xs text-stone-500">{sourceLabel(item)}</span>
          </div>
          <h3 className="mt-3 text-base font-semibold text-stone-950">{item.title}</h3>
          <p className="mt-2 text-sm leading-6 text-stone-600">{item.summary}</p>
          <div className="mt-4 grid gap-3 rounded-xl bg-stone-50 p-4 sm:grid-cols-2">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold text-stone-700"><Gauge className="h-3.5 w-3.5" />Why this matters</p>
              <p className="mt-1 text-xs leading-5 text-stone-500">Ranked from canonical {item.source} data with an attention score of {item.attentionScore.toFixed(1)}.</p>
            </div>
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold text-stone-700"><CircleAlert className="h-3.5 w-3.5" />Confidence</p>
              <p className="mt-1 text-xs leading-5 text-stone-500">{item.confidence.toFixed(0)}% confidence</p>
            </div>
          </div>
          {destination ? (
            <div className="mt-4 flex justify-end">
              <Link href={destination} className="inline-flex items-center gap-2 text-sm font-semibold text-stone-950 transition hover:text-amber-700">Review source<ArrowRight className="h-4 w-4" /></Link>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
