import { AlertTriangle, Info } from "lucide-react";
import type { ExecutiveAttentionItem } from "../domain";
import { SectionHeading } from "./section-heading";

type RecentChangesFeedProps = Readonly<{ items: readonly ExecutiveAttentionItem[] }>;

export function RecentChangesFeed({ items }: RecentChangesFeedProps) {
  return (
    <section>
      <SectionHeading eyebrow="Current signals" title="What requires attention" description="The latest ranked signals from connected canonical providers." />
      <div className="mt-5 overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
        {items.length > 0 ? items.map((item, index) => {
          const Icon = item.urgency === "critical" || item.urgency === "high" ? AlertTriangle : Info;
          return (
            <div key={item.id} className={["flex gap-4 p-5", index > 0 ? "border-t border-stone-100" : ""].join(" ")}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-600"><Icon className="h-4 w-4" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm font-semibold text-stone-950">{item.title}</p><p className="text-xs text-stone-400">{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(item.occurredAt)}</p></div>
                <p className="mt-1 text-sm leading-6 text-stone-600">{item.summary}</p>
              </div>
            </div>
          );
        }) : <p className="p-6 text-sm text-stone-500">Connected providers returned no recent canonical attention signals.</p>}
      </div>
    </section>
  );
}
