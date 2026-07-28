import Link from "next/link";
import { generateReportAction, getReportComposerContext } from "@/app/actions/reporting";
import type { ReportType } from "@/platform/reporting";

export default async function NewReportPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const params=await searchParams;
  const reportType=single(params.type) as ReportType|undefined;
  const sourceId=single(params.source);
  const scenarioId=single(params.scenario);
  const analysisVersionId=single(params.analysis);
  const comparisonScenarioIds=single(params.comparison);
  const context=await getReportComposerContext({workspaceId:single(params.workspace),reportType,sourceId,scenarioId,analysisVersionId});
  if(!("workspaceId" in context)) return <State title="Reporting is unavailable" message={context.message} href={context.nextAction}/>;
  const selected=context.definitions.find(item=>item.key===context.selectedType)!;
  const ready=context.state==="ready";
  return <main className="mx-auto max-w-4xl space-y-8 px-5 py-10">
    <header><p className="eyebrow">Reports</p><h1 className="mt-2 text-4xl font-semibold">Review report configuration</h1><p className="mt-3 text-stone-600">Generation creates a permanent, permission-filtered snapshot. Canonical metrics cannot be edited here.</p></header>
    <form action={generateReportAction} className="space-y-6 rounded-3xl border bg-white p-6 sm:p-8">
      <input name="workspaceId" type="hidden" value={context.workspaceId}/>
      <input name="idempotencyKey" type="hidden" value={crypto.randomUUID()}/>
      {comparisonScenarioIds?<input name="comparisonScenarioIds" type="hidden" value={comparisonScenarioIds}/>:null}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Report type"><select className="mt-2 w-full rounded-xl border p-3" name="reportType" defaultValue={context.selectedType}>{context.definitions.map(item=><option disabled={!item.enabled} key={item.key} value={item.key}>{item.name}{item.enabled?"":" — access required"}</option>)}</select></Field>
        <Field label="Audience"><select className="mt-2 w-full rounded-xl border p-3" name="audience"><option>Owner and operator</option><option>Investor or advisor</option><option>Finance stakeholder</option></select></Field>
        <Field label="Report title"><input className="mt-2 w-full rounded-xl border p-3" maxLength={160} name="title" placeholder={selected.name}/></Field>
        <Field label="Optional subtitle"><input className="mt-2 w-full rounded-xl border p-3" maxLength={240} name="subtitle"/></Field>
        {context.selectedType==="property-performance"?<Field label="Property"><select className="mt-2 w-full rounded-xl border p-3" name="sourceId" defaultValue={sourceId??""} required><option value="">Choose a property</option>{context.properties.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>:null}
        {context.selectedType==="investment-decision"?<><Field label="Opportunity"><select className="mt-2 w-full rounded-xl border p-3" name="sourceId" defaultValue={sourceId??""} required><option value="">Choose an opportunity</option>{context.opportunities.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Analysis version"><select className="mt-2 w-full rounded-xl border p-3" name="analysisVersionId" defaultValue={context.selectedAnalysisVersion??analysisVersionId??""} required><option value="">{sourceId?"Choose a saved version":"Choose an opportunity first"}</option>{context.versions.map(item=><option key={item.id} value={item.id}>Analysis {item.sequence} · {new Date(item.createdAt).toLocaleDateString()}</option>)}</select></Field><Field label="Optional scenario branch"><select className="mt-2 w-full rounded-xl border p-3" name="scenarioId" defaultValue={context.selectedScenario??scenarioId??""}><option value="">Use the selected analysis version</option>{context.scenarios.map(item=><option key={item.id} value={item.id}>{item.name}{item.preferred?" · Preferred":""} · v{item.version}</option>)}</select></Field></>:null}
        <Field label="Reporting period"><select className="mt-2 w-full rounded-xl border p-3" name="periodPreset"><option value="current-month">Current month</option><option value="year-to-date">Year to date</option><option value="trailing-12-months">Trailing 12 months</option></select></Field>
      </div>
      <section aria-labelledby="snapshot-preview" className="rounded-2xl border bg-stone-50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="snapshot-preview" className="font-semibold">Snapshot preflight</h2><span className={`rounded-full px-3 py-1 text-xs font-semibold ${ready?"bg-emerald-100 text-emerald-900":"bg-amber-100 text-amber-950"}`}>{label(context.state)}</span></div>
        <p className="mt-3 text-sm text-stone-700">{context.message}</p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3"><Meta label="Projection" value={`${context.selectedType}.report.v1`}/><Meta label="Template" value="Luxe Haven v1"/><Meta label="Evaluated" value={new Date(context.evaluatedAt).toLocaleString()}/></dl>
        <div className="mt-5"><p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Required sections</p><ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">{selected.requiredSections.map(section=><li key={section}>✓ {section.replaceAll("-"," ")}</li>)}</ul></div>
        {comparisonScenarioIds?<p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">The immutable report will include the canonical comparison projection for {comparisonScenarioIds.split(",").length} selected scenarios.</p>:null}
      </section>
      <Field label="Internal notes (not included in the report)"><textarea className="mt-2 min-h-24 w-full rounded-xl border p-3" name="internalNotes" maxLength={2000}/></Field>
      <div className="flex flex-wrap items-center gap-4"><button disabled={!ready} className="rounded-full bg-stone-950 px-6 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40" type="submit">Generate immutable report</button>{context.nextAction?<Link className="font-semibold underline" href={context.nextAction}>Review access options</Link>:null}</div>
    </form>
  </main>;
}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="block text-sm font-semibold">{label}{children}</label>;}
function Meta({label,value}:{label:string;value:string}){return <div><dt className="text-xs uppercase tracking-wide text-stone-500">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>;}
function State({title,message,href}:{title:string;message:string;href?:string}){return <main className="mx-auto max-w-2xl px-5 py-16"><h1 className="text-3xl font-semibold">{title}</h1><p className="mt-4 text-stone-600">{message}</p>{href?<Link className="mt-6 inline-block font-semibold underline" href={href}>Continue</Link>:null}</main>;}
function single(value:string|string[]|undefined){return Array.isArray(value)?value[0]:value;}
function label(value:string){return value.replaceAll("-"," ").replace(/^\w/,letter=>letter.toUpperCase());}
