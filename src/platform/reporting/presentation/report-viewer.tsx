import type { ReportProjection } from "../domain";

export function ReportViewer({ projection, metadata }: Readonly<{ projection: ReportProjection; metadata?: Readonly<{ reportNumber?: string; generatedAt?: string; templateVersion?: number }> }>) {
  return <article className="mx-auto max-w-5xl bg-white px-5 py-10 text-stone-900 sm:px-10 lg:px-16 print:max-w-none print:px-0 print:py-0">
    <header className="min-h-72 border-b-2 border-stone-200 pb-10">
      <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-700">Luxe Haven Collective</p>
      <h1 className="mt-6 max-w-4xl font-serif text-4xl font-semibold leading-tight sm:text-5xl">{projection.title}</h1>
      {projection.subtitle ? <p className="mt-4 text-xl text-stone-600">{projection.subtitle}</p> : null}
      <dl className="mt-10 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Metadata label="Scope" value={`${projection.scope.label}${projection.scope.partial ? " — Partial scope" : ""}`} />
        <Metadata label="Period" value={projection.period?.label ?? `As of ${projection.evaluatedAt.slice(0,10)}`} />
        <Metadata label="Confidence" value={projection.confidence.replaceAll("-", " ")} />
        <Metadata label="Freshness" value={projection.freshness} />
      </dl>
    </header>
    <section aria-labelledby="report-summary" className="py-10"><h2 id="report-summary" className="font-serif text-3xl font-semibold">Executive Summary</h2><p className="mt-4 max-w-3xl text-lg leading-8 text-stone-700">{projection.summary}</p></section>
    {projection.sections.filter((section) => section.status !== "omitted").sort((a,b)=>a.order-b.order).map((section) => <section aria-labelledby={`report-${section.key}`} className="border-t border-stone-200 py-10" key={section.key}>
      <h2 id={`report-${section.key}`} className="font-serif text-3xl font-semibold">{section.title}</h2>
      {section.status === "unavailable" ? <p role="note" className="mt-4 rounded-xl bg-amber-50 p-4 text-amber-950">This section was unavailable at generation time.</p> : null}
      {section.narrative ? <p className="mt-4 max-w-4xl leading-7 text-stone-700">{section.narrative}</p> : null}
      {section.metrics.length ? <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{section.metrics.map((metric) => <div className="rounded-2xl border border-stone-200 p-5" key={metric.key}><dt className="text-sm text-stone-600">{metric.label}</dt><dd className="mt-2 text-2xl font-semibold">{metric.displayValue}</dd><p className="mt-2 text-xs capitalize text-stone-500">{metric.qualification}. {metric.accessibleDescription}</p></div>)}</dl> : null}
      {section.rows?.length ? <div className="mt-6 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr>{Object.keys(section.rows[0]).map((heading) => <th className="border-b p-3" key={heading} scope="col">{heading}</th>)}</tr></thead><tbody>{section.rows.map((row,index) => <tr key={index}>{Object.keys(section.rows![0]).map((heading) => <td className="border-b p-3" key={heading}>{row[heading]}</td>)}</tr>)}</tbody></table></div> : null}
      <p className="mt-5 text-xs capitalize text-stone-500">Confidence: {section.confidence?.replaceAll("-"," ") ?? "Unavailable"} · Freshness: {section.freshness ?? "Unknown"}</p>
    </section>)}
    <footer className="border-t border-stone-300 py-8 text-xs text-stone-500"><p>{metadata?.reportNumber ? `${metadata.reportNumber} · ` : ""}Projection {projection.projectionVersion}{metadata?.templateVersion ? ` · Template v${metadata.templateVersion}` : ""}</p><p className="mt-2">Generated from an immutable, permission-filtered platform snapshot. Luxe Haven Collective © {new Date(metadata?.generatedAt ?? projection.evaluatedAt).getUTCFullYear()}.</p></footer>
  </article>;
}
function Metadata({label,value}:{label:string;value:string}){return <div><dt className="font-semibold uppercase tracking-wide text-stone-500">{label}</dt><dd className="mt-1 capitalize">{value}</dd></div>;}
