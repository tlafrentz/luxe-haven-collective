"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type FinancialKpiCard = Readonly<{
  id: string; label: string; value: string; unavailableReason?: string; deltaLine: string; captionLine: string;
}>;
export type FinancialKpiDrawerContent = Readonly<{
  id: string; label: string; definition: string; currentValue: string; comparisonValue: string;
  absoluteChange: string; percentageChange: string; includedCategories: readonly string[];
  excludedCategories: readonly string[]; dataSources: string; lastRefreshed: string;
  destination?: Readonly<{ href: string; label: string }>;
}>;

export function FinancialKpiRow({ cards, drawers }: { cards: readonly FinancialKpiCard[]; drawers: readonly FinancialKpiDrawerContent[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const drawer = drawers.find(item => item.id === openId);
  useEffect(() => {
    if (!openId) return;
    dialogRef.current?.focus();
    function onKey(event: KeyboardEvent) { if (event.key === "Escape") setOpenId(null); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openId]);
  return <>
    <section aria-label="Key financial metrics" className="grid overflow-hidden rounded-xl border bg-white sm:grid-cols-2 lg:grid-cols-4">
      {cards.map(card => <button key={card.id} type="button" onClick={() => setOpenId(card.id)} aria-haspopup="dialog" className="min-h-32 border-b border-r p-5 text-left last:border-r-0 hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-950 sm:border-b-0">
        <p className="text-xs font-semibold">{card.label}</p>
        <p className="mt-3 text-2xl font-semibold">{card.value}</p>
        {card.unavailableReason
          ? <p className="mt-2 text-[10px] text-stone-500">{card.unavailableReason}</p>
          : <><p className="mt-2 text-[10px] text-stone-500">{card.deltaLine}</p><p className="text-[10px] text-stone-400">{card.captionLine}</p></>}
      </button>)}
    </section>
    {drawer ? <div className="fixed inset-0 z-50 flex justify-end bg-black/35" onMouseDown={event => { if (event.target === event.currentTarget) setOpenId(null); }}>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="kpi-drawer-title" className="h-full w-full max-w-md overflow-y-auto bg-white p-6 outline-none">
        <div className="flex items-start justify-between gap-4">
          <h2 id="kpi-drawer-title" className="text-xl font-semibold">{drawer.label}</h2>
          <button type="button" onClick={() => setOpenId(null)} aria-label="Close metric detail" className="grid min-h-11 min-w-11 place-items-center rounded-lg hover:bg-stone-100">✕</button>
        </div>
        <p className="mt-3 text-sm leading-6 text-stone-600">{drawer.definition}</p>
        <dl className="mt-6 space-y-4 text-sm">
          <Row label="Current value" value={drawer.currentValue}/>
          <Row label="Comparison value" value={drawer.comparisonValue}/>
          <Row label="Absolute change" value={drawer.absoluteChange}/>
          <Row label="Percentage change" value={drawer.percentageChange}/>
        </dl>
        <CategoryList title="Included categories" items={drawer.includedCategories}/>
        <CategoryList title="Excluded categories" items={drawer.excludedCategories}/>
        <dl className="mt-6 space-y-4 text-sm">
          <Row label="Data sources" value={drawer.dataSources}/>
          <Row label="Last refreshed" value={drawer.lastRefreshed}/>
        </dl>
        {drawer.destination ? <Link href={drawer.destination.href} className="mt-6 inline-flex text-sm font-semibold text-emerald-800 underline">{drawer.destination.label}</Link> : null}
      </div>
    </div> : null}
  </>;
}
function Row({ label, value }: { label: string; value: string }) { return <div className="flex items-start justify-between gap-4"><dt className="text-stone-500">{label}</dt><dd className="text-right font-semibold text-stone-900">{value}</dd></div>; }
function CategoryList({ title, items }: { title: string; items: readonly string[] }) { return <div className="mt-5"><h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">{title}</h3>{items.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-stone-700">{items.map(item => <li key={item}>{item}</li>)}</ul> : <p className="mt-2 text-sm text-stone-500">None specified.</p>}</div>; }
