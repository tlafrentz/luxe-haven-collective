import { CheckCircle2, ExternalLink } from "lucide-react";
import type { ReactNode } from "react";

export type EvidenceItem = Readonly<{ id: string; statement: string; source: string; observedAt?: string; sourceLink?: ReactNode }>;
export function EvidenceList({ label = "Supporting evidence", items }: Readonly<{ label?: string; items: readonly EvidenceItem[] }>) {
  return <ul aria-label={label} className="space-y-3">{items.map(item => <li key={item.id} className="flex gap-3 text-sm"><CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" /><span className="min-w-0"><span className="block leading-6 text-stone-700">{item.statement}</span><span className="mt-1 flex flex-wrap items-center gap-1 text-xs text-stone-500">{item.source}{item.observedAt ? ` · ${item.observedAt}` : ""}{item.sourceLink ? <><ExternalLink aria-hidden="true" className="ml-1 h-3 w-3" />{item.sourceLink}</> : null}</span></span></li>)}</ul>;
}
