"use client";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { StrMarketSnapshot } from "@/features/market-intelligence/str/domain";

type Sort = "similarity" | "distance" | "adr" | "occupancy" | "revenue";
export function ComparableExplorer({ snapshot }: { snapshot: StrMarketSnapshot }) {
  const [sort, setSort] = useState<Sort>("similarity"), [status, setStatus] = useState<"all" | "included" | "excluded">("all");
  const [maxDistance, setMaxDistance] = useState(10), [bedrooms, setBedrooms] = useState("");
  const rows = useMemo(() => snapshot.comparables.filter(item =>
    (status === "all" || (status === "included" ? item.eligibility === "eligible" : item.eligibility === "excluded"))
    && (item.location.distanceMiles ?? 0) <= maxDistance && (!bedrooms || item.property.bedrooms === Number(bedrooms)))
    .sort((a, b) => metric(b, sort) - metric(a, sort)), [snapshot, sort, status, maxDistance, bedrooms]);
  const qualified = snapshot.comparables.filter(item => item.eligibility === "eligible");
  return <section aria-labelledby="comparable-explorer-title" className="space-y-5">
    <header><p className="text-xs font-semibold uppercase tracking-widest text-stone-500">Market evidence</p><h2 id="comparable-explorer-title" className="mt-1 text-2xl font-semibold">Comparable Explorer</h2>
      <p className="mt-2 text-sm text-stone-600">{snapshot.comparables.length} received · {qualified.length} qualified · {snapshot.confidence.level} confidence</p></header>
    <div className="grid gap-3 rounded-2xl bg-stone-50 p-4 sm:grid-cols-4">
      <Control label="Sort"><select value={sort} onChange={event => setSort(event.target.value as Sort)}>{["similarity","distance","adr","occupancy","revenue"].map(value => <option key={value}>{value}</option>)}</select></Control>
      <Control label="Status"><select value={status} onChange={event => setStatus(event.target.value as typeof status)}><option value="all">All</option><option value="included">Included</option><option value="excluded">Excluded</option></select></Control>
      <Control label="Bedrooms"><input inputMode="numeric" value={bedrooms} onChange={event => setBedrooms(event.target.value)} placeholder="Any" /></Control>
      <Control label={`Maximum distance: ${maxDistance} mi`}><input type="range" min="1" max="20" value={maxDistance} onChange={event => setMaxDistance(Number(event.target.value))} /></Control>
    </div>
    {!qualified.length ? <p className="rounded-2xl bg-amber-50 p-5 text-sm text-amber-900">No sufficiently similar STR comparables were found. Continue with market-level evidence or manual assumptions; confidence is reduced.</p> : null}
    <div className="grid gap-4 lg:grid-cols-2">{rows.map(item => <article key={item.id} className="rounded-2xl border border-stone-200 p-5">
      <div className="flex justify-between gap-3"><div><p className="font-semibold">{item.location.marketLabel ?? "STR comparable"}</p><p className="text-xs text-stone-500">{item.property.propertyType ?? "Property type unavailable"} · {item.property.bedrooms ?? "—"} bd · {item.property.bathrooms ?? "—"} ba · {item.location.distanceMiles?.toFixed(1) ?? "—"} mi</p></div>
        <span className={`h-fit rounded-full px-2.5 py-1 text-xs font-semibold ${item.eligibility === "eligible" ? "bg-emerald-50 text-emerald-800" : "bg-stone-100 text-stone-600"}`}>{item.eligibility === "eligible" ? `Included · ${item.similarityScore}%` : "Excluded"}</span></div>
      <dl className="mt-4 grid grid-cols-4 gap-2 text-sm"><Fact label="ADR" value={currency(item.performance.adr?.amount)} /><Fact label="Occupancy" value={percent(item.performance.occupancy?.value)} /><Fact label="RevPAR" value={currency(item.performance.revPar?.amount)} /><Fact label="Revenue" value={currency(item.performance.annualRevenue?.amount)} /></dl>
      <p className="mt-3 text-xs text-stone-500">Weight {(item.weight * 100).toFixed(1)}% · Retrieved {date(item.retrievedAt)} · Source {item.providerReference.provider}</p>
      {item.exclusionReasons.length ? <p className="mt-2 text-xs text-amber-800">Why excluded: {item.exclusionReasons.join(", ")}</p> : <p className="mt-2 text-xs text-emerald-800">Strong match based on property attributes, distance, and evidence quality.</p>}
    </article>)}</div>
  </section>;
}
function metric(item: StrMarketSnapshot["comparables"][number], sort: Sort) { return sort === "similarity" ? item.similarityScore : sort === "distance" ? -(item.location.distanceMiles ?? 999) : sort === "adr" ? item.performance.adr?.amount ?? 0 : sort === "occupancy" ? item.performance.occupancy?.value ?? 0 : item.performance.annualRevenue?.amount ?? 0; }
function Control({label,children}:{label:string;children:ReactNode}) { return <label className="text-xs font-semibold text-stone-600">{label}<span className="mt-1 block [&>*]:w-full [&>*]:rounded-lg [&>*]:border [&>*]:bg-white [&>*]:p-2">{children}</span></label>; }
function Fact({label,value}:{label:string;value:string}) { return <div><dt className="text-xs text-stone-400">{label}</dt><dd className="font-semibold">{value}</dd></div>; }
const currency=(value?:number)=>value===undefined?"—":new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(value);
const percent=(value?:number)=>value===undefined?"—":`${value.toFixed(0)}%`;
const date=(value:string)=>new Intl.DateTimeFormat("en-US",{dateStyle:"medium",timeZone:"UTC"}).format(new Date(value));
