"use client";

import { ArrowRight, Building2, Check, House, Plus, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type Strategy = "purchase" | "rental-arbitrage";

export function NewAnalysisDialog({ buttonLabel = "New Analysis" }: { buttonLabel?: string }) {
  const [open, setOpen] = useState(false);
  const [strategy, setStrategy] = useState<Strategy>("purchase");

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  return <>
    <Link href="/dashboard/investments/new" onClick={event => { event.preventDefault(); setOpen(true); }} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-stone-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-stone-800 focus-visible:outline-2 focus-visible:outline-offset-2">
      <Plus aria-hidden="true" className="h-4 w-4" />{buttonLabel}
    </Link>
    {open ? <div role="dialog" aria-modal="true" aria-labelledby="new-analysis-title" className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/35 p-4 backdrop-blur-[2px]" onMouseDown={event => event.target === event.currentTarget && setOpen(false)}>
      <div className="w-full max-w-2xl rounded-xl border border-stone-200 bg-white p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-6">
          <div><h2 id="new-analysis-title" className="font-serif text-2xl text-stone-950">New Investment Analysis</h2><p className="mt-2 text-sm text-stone-600">How do you plan to control this property?</p></div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          <StrategyCard selected={strategy === "purchase"} onSelect={() => setStrategy("purchase")} icon={<House className="h-6 w-6" />} title="Purchase" description="Acquire and own the property." bullets={["STR properties", "Hotels", "Vacation rentals", "Apartments"]} />
          <StrategyCard selected={strategy === "rental-arbitrage"} onSelect={() => setStrategy("rental-arbitrage")} icon={<Building2 className="h-6 w-6" />} title="Rental Arbitrage" description="Lease and operate the property." bullets={["Lower capital", "Faster scaling", "Master leases", "Corporate housing"]} />
        </div>
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-lg border border-stone-200 text-sm font-semibold text-stone-800 hover:bg-stone-50">Cancel</button>
          <Link href={`/dashboard/investments/new?strategy=${strategy}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-stone-950 text-sm font-semibold text-white hover:bg-stone-800">Continue <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </div>
    </div> : null}
  </>;
}

function StrategyCard({ selected, onSelect, icon, title, description, bullets }: { selected: boolean; onSelect: () => void; icon: React.ReactNode; title: string; description: string; bullets: string[] }) {
  return <button type="button" role="radio" aria-checked={selected} onClick={onSelect} className={`relative rounded-xl border p-5 text-left transition ${selected ? "border-[#b58a49] bg-[#fdfaf5] shadow-sm" : "border-stone-200 bg-white hover:border-stone-300"}`}>
    {selected ? <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#a87931] text-white"><Check className="h-3 w-3" /></span> : null}
    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f7efe3] text-[#a87931]">{icon}</span>
    <span className="mt-4 block font-serif text-xl text-stone-950">{title}</span>
    <span className="mt-2 block text-sm leading-6 text-stone-600">{description}</span>
    <span className="mt-5 block text-xs font-semibold text-stone-700">Best for:</span>
    <span className="mt-2 block space-y-1.5 text-sm text-stone-600">{bullets.map(item => <span key={item} className="block">•&nbsp; {item}</span>)}</span>
  </button>;
}
