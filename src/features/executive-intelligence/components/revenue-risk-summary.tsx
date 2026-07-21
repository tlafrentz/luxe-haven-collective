import { ShieldAlert } from "lucide-react";
import type { ExecutiveAttentionItem } from "../domain";

type RevenueRiskSummaryProps = Readonly<{ risks: readonly ExecutiveAttentionItem[] }>;

export function RevenueRiskSummary({ risks }: RevenueRiskSummaryProps) {
  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Risks requiring attention</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-stone-950">{risks.length}</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-700"><ShieldAlert className="h-5 w-5" /></div>
      </div>
      <div className="mt-5 space-y-3">
        {risks.slice(0, 3).map((item) => (
          <div key={item.id} className="rounded-xl bg-stone-50 p-3">
            <div className="flex items-start justify-between gap-3"><p className="text-sm font-medium text-stone-900">{item.title}</p><p className="text-xs font-semibold uppercase text-rose-700">{item.urgency}</p></div>
            <p className="mt-1 text-xs leading-5 text-stone-500">{item.summary}</p>
          </div>
        ))}
        {risks.length === 0 ? <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">Connected providers returned no current risk items.</p> : null}
      </div>
    </section>
  );
}
