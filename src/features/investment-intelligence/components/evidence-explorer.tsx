import type { InvestmentAnalysisMarketContext } from "../application/market-intelligence-experience";
export function EvidenceExplorer({ context }: { context: InvestmentAnalysisMarketContext }) {
  const snapshot = context.snapshot;
  if (!snapshot) return <p className="rounded-2xl bg-stone-50 p-5 text-sm text-stone-600">No persisted market evidence is attached to this analysis.</p>;
  return <section aria-labelledby="evidence-explorer-title"><h2 id="evidence-explorer-title" className="text-2xl font-semibold">Evidence Explorer</h2>
    <p className="mt-2 text-sm text-stone-600">Canonical evidence preserved with snapshot <span className="font-mono text-xs">{snapshot.id}</span>.</p>
    <div className="mt-5 space-y-3">{snapshot.evidence.map(item => <article key={item.id} className="rounded-2xl border border-stone-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{label(item.rawMetricName ?? item.sourceOperation)}</p>
        <p className="mt-1 text-xs text-stone-500">Source: {item.provider} · Retrieved {date(item.retrievedAt)}</p></div>
        <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold">{item.derivation === "provider-supplied" ? "Provider supplied" : "Luxe Haven calculated"}</span></div>
      <p className="mt-2 text-xs text-stone-500">Mapping {item.mappingVersion}{item.calculationVersion ? ` · Calculation ${item.calculationVersion}` : ""}</p>
    </article>)}</div>
    {snapshot.confidence.limitations.length ? <aside className="mt-5 rounded-2xl bg-amber-50 p-5"><h3 className="font-semibold text-amber-950">Limitations</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">{snapshot.confidence.limitations.map(value => <li key={value}>{value}</li>)}</ul></aside> : null}
  </section>;
}
const label=(value:string)=>value.replaceAll("_"," ").replace(/\b\w/g,letter=>letter.toUpperCase());
const date=(value:string)=>new Intl.DateTimeFormat("en-US",{dateStyle:"medium",timeZone:"UTC"}).format(new Date(value));
