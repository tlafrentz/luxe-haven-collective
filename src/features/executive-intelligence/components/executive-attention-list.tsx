import { CheckCircle2 } from "lucide-react";
import type { ExecutiveAttentionItem, ExecutiveAttentionSummary } from "../domain";
import { ExecutiveAttentionCard } from "./executive-attention-card";
import { SectionHeading } from "./section-heading";

type ExecutiveAttentionListProps = Readonly<{ attention: ExecutiveAttentionSummary }>;

export function ExecutiveAttentionList({ attention }: ExecutiveAttentionListProps) {
  const categorized = new Set([...attention.risks, ...attention.opportunities].map((item) => item.id));
  const other = attention.priorities.filter((item) => !categorized.has(item.id));
  const groups: readonly Readonly<{ label: string; items: readonly ExecutiveAttentionItem[] }>[] = [
    { label: "Risks", items: attention.risks },
    { label: "Opportunities", items: attention.opportunities },
    { label: "Other priorities", items: other },
  ];
  return (
    <section>
      <SectionHeading eyebrow="Attention queue" title="Today’s priorities" description="Ranked by the Executive attention policy over canonical lifecycle records." />
      {attention.priorities.length === 0 ? (
        <div className="mt-5 rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
          <h3 className="mt-4 text-base font-semibold text-emerald-950">No current attention items</h3>
          <p className="mt-2 text-sm text-emerald-700">Connected providers returned no recommendations, actions, intelligence alerts, or failed outcomes requiring attention.</p>
        </div>
      ) : (
        <div className="mt-5 space-y-7">
          {groups.filter((group) => group.items.length > 0).map((group) => (
            <div key={group.label}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">{group.label}</h3>
              <div className="space-y-4">{group.items.map((item) => <ExecutiveAttentionCard key={item.id} item={item} />)}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
