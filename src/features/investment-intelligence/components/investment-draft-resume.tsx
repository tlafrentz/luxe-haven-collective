"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type DraftSummary = Readonly<{ strategy: "purchase" | "rental-arbitrage"; property: string; savedAt: string | null }>;

export function InvestmentDraftResume({ ownerScope }: { ownerScope?: string }) {
  const [draft, setDraft] = useState<DraftSummary | null>(null);
  useEffect(() => {
    if (!ownerScope) return;
    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(`luxe-haven:investment-workspace-draft.v1:${ownerScope}`);
        if (!raw) return;
        const stored = JSON.parse(raw) as { schemaVersion?: string; ownerScope?: string; savedAt?: string; values?: Record<string, unknown> };
        const strategy = stored.values?.acquisitionType;
        if (stored.schemaVersion !== "investment-workspace-draft.v1" || stored.ownerScope !== ownerScope || (strategy !== "purchase" && strategy !== "rental-arbitrage")) return;
        const address = typeof stored.values?.address1 === "string" ? stored.values.address1.trim() : "";
        setDraft({ strategy, property: address || "Property not identified yet", savedAt: stored.savedAt ?? null });
      } catch {
        // An invalid local draft is ignored; the guided workspace will recover safely.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [ownerScope]);
  if (!draft) return null;
  return <section aria-labelledby="active-draft-heading" className="mt-7 flex flex-col gap-4 rounded-xl border border-teal-200 bg-teal-50 p-5 sm:flex-row sm:items-center sm:justify-between">
    <div><p className="eyebrow">Active draft</p><h2 id="active-draft-heading" className="mt-1 text-lg font-semibold text-stone-950">{draft.property}</h2><p className="mt-1 text-sm text-stone-600">{draft.strategy === "purchase" ? "Purchase" : "Rental Arbitrage"} · {draft.savedAt ? `Saved ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(draft.savedAt))}` : "Ready to continue"}</p></div>
    <Link href="/dashboard/investments/new" className="inline-flex min-h-11 items-center justify-center rounded-full bg-stone-950 px-5 text-sm font-semibold text-white">Continue Analysis</Link>
  </section>;
}
